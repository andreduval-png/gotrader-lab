import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const RUNBOOK_EVIDENCE_CONTRACT = "gotrader.simulation_runbook_evidence";
export const RUNBOOK_EVIDENCE_VERSION = "1.0";

export const RUNBOOK_CHECK_IDS = Object.freeze([
  "aiLabThesisGenerated",
  "handoffExported",
  "savedLatestHandoff",
  "readerConversionTested",
  "schedulerOneCycleCompleted",
  "signalLogged",
  "brokerExecutionSkipped",
  "positionsZero",
  "tradesZero",
  "shutdownComplete"
]);

const allowedSources = Object.freeze({
  aiLabThesisGenerated: ["research_cycle_artifact"],
  handoffExported: ["handoff_receipt"],
  savedLatestHandoff: ["handoff_receipt"],
  readerConversionTested: ["reader_receipt"],
  schedulerOneCycleCompleted: ["scheduler_receipt"],
  signalLogged: ["signal_receipt"],
  brokerExecutionSkipped: ["authority_snapshot"],
  positionsZero: ["position_snapshot"],
  tradesZero: ["trade_snapshot"],
  shutdownComplete: ["shutdown_receipt"]
});

const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
};

const stableJson = (value) => JSON.stringify(canonicalize(value));
const sha256 = (value) => `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
const compact = (value, maximum = 500) => String(value ?? "").trim().slice(0, maximum);
const isIso = (value) => Number.isFinite(Date.parse(String(value ?? "")));
const isSha256 = (value) => /^sha256:[a-f0-9]{64}$/i.test(String(value ?? ""));

const receiptIdentity = (receipt) => ({
  contract: receipt.contract,
  version: receipt.version,
  cycleId: receipt.cycleId,
  checkId: receipt.checkId,
  observedAt: receipt.observedAt,
  recordedAt: receipt.recordedAt,
  sourceKind: receipt.sourceKind,
  sourceId: receipt.sourceId,
  sourceDigest: receipt.sourceDigest,
  previousEvidenceId: receipt.previousEvidenceId,
  profileId: receipt.profileId,
  parameterFingerprint: receipt.parameterFingerprint,
  sourceFingerprint: receipt.sourceFingerprint,
  authority: receipt.authority
});

export const computeRunbookEvidenceId = (receipt) => sha256(stableJson(receiptIdentity(receipt)));

const validateInput = (input) => {
  const checkId = compact(input?.checkId, 80);
  const sourceKind = compact(input?.sourceKind, 80);
  if (!RUNBOOK_CHECK_IDS.includes(checkId)) throw new Error("runbook_check_unknown");
  if (!allowedSources[checkId].includes(sourceKind)) throw new Error("runbook_source_not_authorized_for_check");
  if (!compact(input?.cycleId, 200)) throw new Error("runbook_cycle_id_required");
  if (!compact(input?.sourceId, 300)) throw new Error("runbook_source_id_required");
  if (!isSha256(input?.sourceDigest)) throw new Error("runbook_source_digest_invalid");
  if (!isIso(input?.observedAt)) throw new Error("runbook_observed_at_invalid");
};

const validateStoredReceipt = (receipt, previousEvidenceId) => {
  validateInput(receipt);
  if (receipt.contract !== RUNBOOK_EVIDENCE_CONTRACT || receipt.version !== RUNBOOK_EVIDENCE_VERSION) {
    throw new Error("runbook_contract_invalid");
  }
  if (receipt.previousEvidenceId !== previousEvidenceId) throw new Error("runbook_hash_chain_invalid");
  if (computeRunbookEvidenceId(receipt) !== receipt.evidenceId) throw new Error("runbook_evidence_id_invalid");
};

const emptyChecklist = () => Object.fromEntries(RUNBOOK_CHECK_IDS.map((checkId) => [checkId, false]));

export function createRunbookEvidenceStore({ root, now = () => new Date().toISOString() }) {
  const evidencePath = path.join(root, "runbook-evidence.jsonl");
  const legacyPath = path.join(root, "runbook-legacy-archive.jsonl");
  const records = [];
  const legacySnapshots = [];

  const loadJsonl = async (filePath) => {
    try {
      const text = await fs.readFile(filePath, "utf8");
      return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  };

  const initialize = async () => {
    await fs.mkdir(root, { recursive: true });
    const loaded = await loadJsonl(evidencePath);
    const previousByCycle = new Map();
    const seenChecks = new Set();
    for (const receipt of loaded) {
      const previous = previousByCycle.get(receipt.cycleId) ?? null;
      validateStoredReceipt(receipt, previous);
      const uniqueKey = `${receipt.cycleId}:${receipt.checkId}`;
      if (seenChecks.has(uniqueKey)) throw new Error("runbook_duplicate_check_evidence");
      seenChecks.add(uniqueKey);
      previousByCycle.set(receipt.cycleId, receipt.evidenceId);
      records.push(Object.freeze(receipt));
    }
    legacySnapshots.push(...await loadJsonl(legacyPath));
  };

  const projectCycle = (cycleId) => {
    const cycleRecords = records.filter((record) => record.cycleId === cycleId);
    const checklist = emptyChecklist();
    for (const receipt of cycleRecords) checklist[receipt.checkId] = true;
    const complete = RUNBOOK_CHECK_IDS.every((checkId) => checklist[checkId]);
    return {
      status: cycleRecords.length ? "current_cycle" : "unavailable",
      currentCycleId: cycleId,
      evidenceChainValid: true,
      evidenceChainHead: cycleRecords.at(-1)?.evidenceId ?? null,
      verifiedAt: complete ? cycleRecords.at(-1)?.recordedAt : null,
      completedChecks: cycleRecords.length,
      totalChecks: RUNBOOK_CHECK_IDS.length,
      checklist,
      evidence: cycleRecords,
      legacyMigrationArchived: legacySnapshots.length > 0,
      authority
    };
  };

  const appendEvidence = async (input) => {
    validateInput(input);
    const cycleId = compact(input.cycleId, 200);
    const checkId = compact(input.checkId, 80);
    const existing = records.find((record) => record.cycleId === cycleId && record.checkId === checkId);
    if (existing) {
      if (existing.sourceDigest !== input.sourceDigest || existing.sourceId !== input.sourceId) {
        throw new Error("runbook_check_evidence_immutable");
      }
      return { accepted: true, coalesced: true, receipt: existing, state: projectCycle(cycleId) };
    }
    const previousEvidenceId = records.filter((record) => record.cycleId === cycleId).at(-1)?.evidenceId ?? null;
    const receipt = {
      contract: RUNBOOK_EVIDENCE_CONTRACT,
      version: RUNBOOK_EVIDENCE_VERSION,
      cycleId,
      checkId,
      observedAt: new Date(input.observedAt).toISOString(),
      recordedAt: now(),
      sourceKind: compact(input.sourceKind, 80),
      sourceId: compact(input.sourceId, 300),
      sourceDigest: String(input.sourceDigest).toLowerCase(),
      previousEvidenceId,
      profileId: compact(input.profileId, 200) || null,
      parameterFingerprint: compact(input.parameterFingerprint, 300) || null,
      sourceFingerprint: compact(input.sourceFingerprint, 500) || null,
      authority
    };
    receipt.evidenceId = computeRunbookEvidenceId(receipt);
    await fs.appendFile(evidencePath, `${JSON.stringify(receipt)}\n`, "utf8");
    records.push(Object.freeze(receipt));
    return { accepted: true, coalesced: false, receipt, state: projectCycle(cycleId) };
  };

  const archiveLegacy = async (snapshot) => {
    const serialized = stableJson(snapshot ?? {});
    const legacyState = snapshot && typeof snapshot === "object"
      ? {
          verifiedAt: compact(snapshot.rawState?.verifiedAt, 80) || null,
          latestResearchCycleId: compact(snapshot.rawState?.latestResearchCycleId, 200) || null,
          symbol: compact(snapshot.rawState?.symbol, 40) || null,
          timeframe: compact(snapshot.rawState?.timeframe, 40) || null,
          signal: compact(snapshot.rawState?.signal, 20) || null,
          checklist: snapshot.rawState?.checklist && typeof snapshot.rawState.checklist === "object"
            ? Object.fromEntries(RUNBOOK_CHECK_IDS.map((checkId) => [checkId, snapshot.rawState.checklist[checkId] === true]))
            : emptyChecklist(),
          notes: compact(snapshot.rawState?.notes, 4_000) || null
        }
      : null;
    const record = {
      archiveId: sha256(serialized),
      archivedAt: now(),
      trustedEvidence: false,
      source: "legacy_port_scoped_browser_storage",
      snapshotDigest: sha256(serialized),
      legacyState,
      authority
    };
    if (!legacySnapshots.some((item) => item.archiveId === record.archiveId)) {
      await fs.appendFile(legacyPath, `${JSON.stringify(record)}\n`, "utf8");
      legacySnapshots.push(Object.freeze(record));
    }
    return { accepted: true, archive: record };
  };

  return { initialize, appendEvidence, archiveLegacy, projectCycle, evidencePath, legacyPath };
}
