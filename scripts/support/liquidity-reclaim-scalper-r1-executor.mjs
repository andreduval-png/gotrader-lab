import fs from "node:fs";
import path from "node:path";
import { createHistoricalDatasetNodeStorage } from "./historical-dataset-node-storage.mjs";
import { verifyAndFinalizeCommittedR1EvidenceArchives } from "./liquidity-reclaim-scalper-r1-evidence-capacity.mjs";

export const R1_EXECUTOR_SCHEMA_VERSION = "gotrader-lrs-r1-bounded-executor-v3";
export const R1_PREVIOUS_EXECUTOR_SCHEMA_VERSION = "gotrader-lrs-r1-bounded-executor-v2";
export const R1_LEGACY_EXECUTOR_SCHEMA_VERSION = "gotrader-lrs-r1-bounded-executor-v1";
export const R1_CHILD_TELEMETRY_SCHEMA_VERSION = "gotrader-lrs-r1-child-telemetry-v1";
export const R1_FAMILY_ID = "sha256:e89903741561b76b56adc5feac12b311d7154036e7dff9f4c9cbf75afd405fed";
export const R1_PLAN_ID = "sha256:2218b36fae572a2411c35da3fae6788090d4b58a452ed1a9a5b2df65edab6476";
export const R1_SAMPLE_SET_ID = "sha256:e844dab5fb0567e012147877a2414ac656b8bb749d5ce8c8fd16102c089f7004";
export const R1_CERTIFICATE_ID = "sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193";
export const R1_DATASET_ID = "sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d";
export const R1_SOURCE_FINGERPRINT = "sha256:e164236affb51072322ce78bf297c03b3c403243e206a685b917792ac6db07bd";
export const R1_ACCEPTANCE_ID = "sha256:7b6c1fb6a0896f496895eb30d6dc091f08ee804b0d75c10248e17a5fa65a11ae";
export const R1_MAX_RSS_BYTES = 1_073_741_824;
export const R1_MAX_STORAGE_BYTES = 134_217_728;
export const R1_AUTHORITY = Object.freeze({ executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" });

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const directoryBytes = (root) => fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }).reduce((sum, entry) => {
  const file = path.join(root, entry.name);
  return sum + (entry.isDirectory() ? directoryBytes(file) : fs.statSync(file).size);
}, 0) : 0;

export async function verifyAcceptedR1Inputs({ modules, acceptancePath }) {
  const acceptance = readJson(acceptancePath);
  const { acceptanceId, ...core } = acceptance;
  if (await modules.canonical.canonicalHash(core) !== acceptanceId || acceptanceId !== R1_ACCEPTANCE_ID ||
      acceptance.experimentFamilyId !== R1_FAMILY_ID || acceptance.samplingPlanId !== R1_PLAN_ID ||
      acceptance.sampleSetId !== R1_SAMPLE_SET_ID || acceptance.attemptCount !== 128 ||
      acceptance.uniqueParameterCount !== 125 || acceptance.duplicateAttemptCount !== 3 ||
      acceptance.operatorAuthorized !== false || acceptance.researchValidated !== false ||
      acceptance.productionAdoptionAllowed !== false) {
    throw new Error("LRS R1 accepted trial-control evidence is invalid.");
  }
  const definitions = await modules.trialControls.buildLrsR1TrialDefinitions();
  const uniqueCount = new Set(definitions.map((item) => item.parameterHash)).size;
  const duplicates = definitions.filter((item) => item.initialDisposition === "coalesced_duplicate");
  if (definitions.length !== 128 || uniqueCount !== 125 || duplicates.length !== 3 ||
      definitions[0]?.trialId !== acceptance.firstTrialId || definitions.at(-1)?.trialId !== acceptance.lastTrialId ||
      definitions.some((item) => item.experimentFamilyId !== R1_FAMILY_ID || item.samplingPlanId !== R1_PLAN_ID ||
        item.datasetId !== R1_DATASET_ID || item.sourceFingerprint !== R1_SOURCE_FINGERPRINT ||
        item.authority.executionAuthority !== "none" || item.capabilities.canPlaceOrder !== false)) {
    throw new Error("LRS R1 regenerated sample definitions do not match accepted evidence.");
  }
  return Object.freeze({ acceptance, definitions });
}

const checkpointCore = ({ mode, selectedTrialIds, nextPosition, dispositions, orderedEventIds, controllerCommit, startedAtUtc,
  childRuns, maximumObservedRssBytes, orderedChildTelemetryIds = [], telemetryStartChildRun = 0 }) => Object.freeze({ schemaVersion: R1_EXECUTOR_SCHEMA_VERSION, mode,
  experimentFamilyId: R1_FAMILY_ID, samplingPlanId: R1_PLAN_ID, sampleSetId: R1_SAMPLE_SET_ID,
  datasetCertificateId: R1_CERTIFICATE_ID, datasetId: R1_DATASET_ID, sourceFingerprint: R1_SOURCE_FINGERPRINT,
  selectedTrialIds: Object.freeze([...selectedTrialIds]), nextPosition, dispositions: Object.freeze([...dispositions]),
  orderedEventIds: Object.freeze([...orderedEventIds]), controllerCommit, startedAtUtc, childRuns,
  maximumObservedRssBytes, telemetryStartChildRun, orderedChildTelemetryIds: Object.freeze([...orderedChildTelemetryIds]),
  authority: R1_AUTHORITY, researchValidated: false, productionAdoptionAllowed: false,
  holdoutUsed: false, adaptiveSearchUsed: false });

const legacyCheckpointCore = (checkpoint) => Object.freeze({
  schemaVersion: R1_LEGACY_EXECUTOR_SCHEMA_VERSION,
  mode: checkpoint.mode,
  experimentFamilyId: checkpoint.experimentFamilyId,
  samplingPlanId: checkpoint.samplingPlanId,
  sampleSetId: checkpoint.sampleSetId,
  datasetCertificateId: checkpoint.datasetCertificateId,
  datasetId: checkpoint.datasetId,
  sourceFingerprint: checkpoint.sourceFingerprint,
  selectedTrialIds: checkpoint.selectedTrialIds,
  nextPosition: checkpoint.nextPosition,
  dispositions: checkpoint.dispositions,
  orderedEventIds: checkpoint.orderedEventIds,
  controllerCommit: checkpoint.controllerCommit,
  startedAtUtc: checkpoint.startedAtUtc,
  childRuns: checkpoint.childRuns,
  maximumObservedRssBytes: checkpoint.maximumObservedRssBytes,
  authority: checkpoint.authority,
  researchValidated: checkpoint.researchValidated,
  productionAdoptionAllowed: checkpoint.productionAdoptionAllowed,
  holdoutUsed: checkpoint.holdoutUsed,
  adaptiveSearchUsed: checkpoint.adaptiveSearchUsed
});

export async function sealR1ControllerCheckpoint(modules, input) {
  const core = checkpointCore(input);
  return Object.freeze({ ...core, checkpointId: await modules.canonical.canonicalHash(core) });
}

export async function validateR1ControllerCheckpoint(modules, checkpoint, expected) {
  const { checkpointId, ...core } = checkpoint;
  if (checkpoint.schemaVersion !== R1_EXECUTOR_SCHEMA_VERSION || checkpoint.mode !== expected.mode ||
      checkpoint.controllerCommit !== expected.controllerCommit ||
      modules.canonical.canonicalSerialize(checkpoint.selectedTrialIds) !== modules.canonical.canonicalSerialize(expected.selectedTrialIds) ||
      checkpoint.experimentFamilyId !== R1_FAMILY_ID || checkpoint.samplingPlanId !== R1_PLAN_ID ||
      checkpoint.sampleSetId !== R1_SAMPLE_SET_ID || checkpoint.datasetCertificateId !== R1_CERTIFICATE_ID ||
      checkpoint.datasetId !== R1_DATASET_ID || checkpoint.sourceFingerprint !== R1_SOURCE_FINGERPRINT ||
      !Number.isInteger(checkpoint.telemetryStartChildRun) || checkpoint.telemetryStartChildRun < 0 ||
      !Array.isArray(checkpoint.orderedChildTelemetryIds) ||
      checkpoint.orderedChildTelemetryIds.length !== checkpoint.childRuns - checkpoint.telemetryStartChildRun ||
      new Set(checkpoint.orderedChildTelemetryIds).size !== checkpoint.orderedChildTelemetryIds.length ||
      checkpoint.holdoutUsed !== false || checkpoint.adaptiveSearchUsed !== false ||
      await modules.canonical.canonicalHash(core) !== checkpointId) {
    throw new Error("LRS R1 controller checkpoint identity or integrity failure.");
  }
  return checkpoint;
}

export async function migrateLegacyR1ControllerCheckpoint(modules, checkpoint, expected) {
  if (![R1_LEGACY_EXECUTOR_SCHEMA_VERSION, R1_PREVIOUS_EXECUTOR_SCHEMA_VERSION].includes(checkpoint.schemaVersion)) return checkpoint;
  if (checkpoint.schemaVersion === R1_PREVIOUS_EXECUTOR_SCHEMA_VERSION) {
    const { checkpointId, ...core } = checkpoint;
    if (checkpoint.mode !== expected.mode || checkpoint.controllerCommit !== expected.controllerCommit ||
        modules.canonical.canonicalSerialize(checkpoint.selectedTrialIds) !== modules.canonical.canonicalSerialize(expected.selectedTrialIds) ||
        checkpoint.experimentFamilyId !== R1_FAMILY_ID || checkpoint.samplingPlanId !== R1_PLAN_ID ||
        checkpoint.sampleSetId !== R1_SAMPLE_SET_ID || checkpoint.datasetCertificateId !== R1_CERTIFICATE_ID ||
        checkpoint.datasetId !== R1_DATASET_ID || checkpoint.sourceFingerprint !== R1_SOURCE_FINGERPRINT ||
        checkpoint.holdoutUsed !== false || checkpoint.adaptiveSearchUsed !== false ||
        await modules.canonical.canonicalHash(core) !== checkpointId) {
      throw new Error("LRS R1 previous controller checkpoint identity or integrity failure.");
    }
    return sealR1ControllerCheckpoint(modules, checkpoint);
  }
  if (checkpoint.mode !== expected.mode || checkpoint.controllerCommit !== expected.controllerCommit ||
      modules.canonical.canonicalSerialize(checkpoint.selectedTrialIds) !== modules.canonical.canonicalSerialize(expected.selectedTrialIds) ||
      checkpoint.experimentFamilyId !== R1_FAMILY_ID || checkpoint.samplingPlanId !== R1_PLAN_ID ||
      checkpoint.sampleSetId !== R1_SAMPLE_SET_ID || checkpoint.datasetCertificateId !== R1_CERTIFICATE_ID ||
      checkpoint.datasetId !== R1_DATASET_ID || checkpoint.sourceFingerprint !== R1_SOURCE_FINGERPRINT ||
      checkpoint.holdoutUsed !== false || checkpoint.adaptiveSearchUsed !== false ||
      await modules.canonical.canonicalHash(legacyCheckpointCore(checkpoint)) !== checkpoint.checkpointId) {
    throw new Error("LRS R1 legacy controller checkpoint identity or integrity failure.");
  }
  return sealR1ControllerCheckpoint(modules, {
    mode: checkpoint.mode,
    selectedTrialIds: checkpoint.selectedTrialIds,
    nextPosition: checkpoint.nextPosition,
    dispositions: checkpoint.dispositions,
    orderedEventIds: checkpoint.orderedEventIds,
    controllerCommit: checkpoint.controllerCommit,
    startedAtUtc: checkpoint.startedAtUtc,
    childRuns: checkpoint.childRuns,
    maximumObservedRssBytes: checkpoint.maximumObservedRssBytes,
    telemetryStartChildRun: checkpoint.childRuns,
    orderedChildTelemetryIds: []
  });
}

export async function openR1Controller({ modules, outputRoot, mode, selectedTrialIds, controllerCommit }) {
  const storage = createHistoricalDatasetNodeStorage({ root: outputRoot });
  const text = await storage.adapter.readText("checkpoints/controller.json");
  if (text) {
    const parsed = JSON.parse(text);
    const migrated = await migrateLegacyR1ControllerCheckpoint(modules, parsed, { mode, selectedTrialIds, controllerCommit });
    const checkpoint = await validateR1ControllerCheckpoint(modules, migrated, { mode, selectedTrialIds, controllerCommit });
    if (migrated !== parsed) {
      await storage.adapter.writeTextAtomic("checkpoints/controller.json", `${modules.canonical.canonicalSerialize(checkpoint)}\n`);
    }
    await verifyAndFinalizeCommittedR1EvidenceArchives({ modules, storage, checkpoint });
    await verifyR1ChildTelemetryLedger({ modules, storage, checkpoint });
    return { storage, checkpoint };
  }
  const checkpoint = await sealR1ControllerCheckpoint(modules, { mode, selectedTrialIds, nextPosition: 0, dispositions: [], orderedEventIds: [],
    controllerCommit, startedAtUtc: new Date().toISOString(), childRuns: 0, maximumObservedRssBytes: 0,
    telemetryStartChildRun: 0, orderedChildTelemetryIds: [] });
  await storage.adapter.writeTextAtomic("checkpoints/controller.json", `${modules.canonical.canonicalSerialize(checkpoint)}\n`);
  return { storage, checkpoint };
}

export async function buildR1ChildTelemetry(modules, input) {
  const core = Object.freeze({
    schemaVersion: R1_CHILD_TELEMETRY_SCHEMA_VERSION,
    childRun: input.childRun,
    trialId: input.trialId,
    trialOrdinal: input.trialOrdinal,
    childOrdinal: input.childOrdinal,
    startedAtUtc: input.startedAtUtc,
    completedAtUtc: input.completedAtUtc,
    exitStatus: input.exitStatus,
    exitSignal: input.exitSignal ?? null,
    resultReason: input.resultReason ?? "unreported",
    maximumObservedRssBytes: input.maximumObservedRssBytes,
    resourceDecision: input.resourceDecision,
    trialCheckpointId: input.trialCheckpointId ?? null,
    stageTelemetry: Object.freeze([...(input.stageTelemetry ?? [])]),
    previousTelemetryId: input.previousTelemetryId ?? null,
    experimentFamilyId: R1_FAMILY_ID,
    samplingPlanId: R1_PLAN_ID,
    sampleSetId: R1_SAMPLE_SET_ID,
    datasetCertificateId: R1_CERTIFICATE_ID,
    datasetId: R1_DATASET_ID,
    sourceFingerprint: R1_SOURCE_FINGERPRINT,
    authority: R1_AUTHORITY,
    holdoutUsed: false,
    adaptiveSearchUsed: false
  });
  return Object.freeze({ ...core, telemetryId: await modules.canonical.canonicalHash(core) });
}

export async function writeR1ChildTelemetry({ modules, storage, telemetry }) {
  const ordinal = String(telemetry.childRun).padStart(6, "0");
  const identity = telemetry.telemetryId.replace("sha256:", "");
  await writeImmutableR1Artifact({ modules, storage, relativePath: `telemetry/child-${ordinal}-${identity}.json`, artifact: telemetry });
  return telemetry;
}

export async function verifyR1ChildTelemetryLedger({ modules, storage, checkpoint }) {
  let previousTelemetryId = null;
  for (let index = 0; index < checkpoint.orderedChildTelemetryIds.length; index += 1) {
    const telemetryId = checkpoint.orderedChildTelemetryIds[index];
    const identity = telemetryId.replace("sha256:", "");
    const childRun = checkpoint.telemetryStartChildRun + index + 1;
    const relativePath = `telemetry/child-${String(childRun).padStart(6, "0")}-${identity}.json`;
    const text = await storage.adapter.readText(relativePath);
    if (!text) throw new Error(`LRS R1 child telemetry is missing for run ${childRun}.`);
    const telemetry = JSON.parse(text);
    const { telemetryId: storedId, ...core } = telemetry;
    if (storedId !== telemetryId || telemetry.schemaVersion !== R1_CHILD_TELEMETRY_SCHEMA_VERSION ||
        telemetry.childRun !== childRun || telemetry.previousTelemetryId !== previousTelemetryId ||
        telemetry.experimentFamilyId !== R1_FAMILY_ID || telemetry.samplingPlanId !== R1_PLAN_ID ||
        telemetry.sampleSetId !== R1_SAMPLE_SET_ID || telemetry.datasetCertificateId !== R1_CERTIFICATE_ID ||
        telemetry.datasetId !== R1_DATASET_ID || telemetry.sourceFingerprint !== R1_SOURCE_FINGERPRINT ||
        telemetry.holdoutUsed !== false || telemetry.adaptiveSearchUsed !== false ||
        telemetry.authority?.executionAuthority !== "none" ||
        await modules.canonical.canonicalHash(core) !== storedId) {
      throw new Error(`LRS R1 child telemetry identity or integrity failure for run ${childRun}.`);
    }
    previousTelemetryId = telemetryId;
  }
  return Object.freeze({ verifiedCount: checkpoint.orderedChildTelemetryIds.length, latestTelemetryId: previousTelemetryId });
}

export const classifyR1ChildRss = (rssBytes) => {
  if (!Number.isFinite(rssBytes) || rssBytes < 0) throw new Error("LRS R1 child RSS sample is invalid.");
  if (rssBytes > R1_MAX_RSS_BYTES) return "hard_limit_exceeded";
  return rssBytes >= 805_306_368 ? "soft_limit_recycle" : "within_limit";
};

export const summarizeR1StageSamples = (samples) => {
  const stages = new Map();
  for (const sample of samples) {
    if (!sample || typeof sample.stage !== "string" || !sample.stage || !Number.isFinite(sample.rssBytes) || sample.rssBytes < 0) {
      throw new Error("LRS R1 child stage telemetry sample is invalid.");
    }
    const current = stages.get(sample.stage) ?? { stage: sample.stage, sampleCount: 0, maximumRssBytes: 0, lastRssBytes: 0 };
    stages.set(sample.stage, {
      stage: sample.stage,
      sampleCount: current.sampleCount + 1,
      maximumRssBytes: Math.max(current.maximumRssBytes, sample.rssBytes),
      lastRssBytes: sample.rssBytes
    });
  }
  return Object.freeze([...stages.values()].map(Object.freeze));
};

export async function writeR1ControllerCheckpoint({ modules, storage, input }) {
  const checkpoint = await sealR1ControllerCheckpoint(modules, input);
  await storage.adapter.writeTextAtomic("checkpoints/controller.json", `${modules.canonical.canonicalSerialize(checkpoint)}\n`);
  return checkpoint;
}

export async function writeImmutableR1Artifact({ modules, storage, relativePath, artifact }) {
  const serialized = `${modules.canonical.canonicalSerialize(artifact)}\n`;
  const existing = await storage.adapter.readText(relativePath);
  if (existing !== undefined && existing !== serialized) throw new Error(`Immutable R1 artifact conflict: ${relativePath}`);
  if (existing === undefined) await storage.adapter.writeTextAtomic(relativePath, serialized);
}

export async function verifyR1TrialReport({ modules, reportPath, trial }) {
  const report = readJson(reportPath);
  const { reportId, ...core } = report;
  if (await modules.canonical.canonicalHash(core) !== reportId || report.parameterHash !== trial.parameterHash ||
      report.certificateId !== R1_CERTIFICATE_ID || report.datasetId !== R1_DATASET_ID || report.status !== "passed" ||
      report.researchValidated !== false || report.productionAdoptionAllowed !== false || report.rawCandlesSerialized !== false ||
      report.mt5Contacted !== false || report.authority?.executionAuthority !== "none" || !report.ledgerSealId) {
    throw new Error(`LRS R1 trial report failed verification: ${trial.trialId}`);
  }
  return report;
}

export function enforceR1ResourceBounds(outputRoot, maximumObservedRssBytes) {
  const storageBytes = directoryBytes(outputRoot);
  if (maximumObservedRssBytes > R1_MAX_RSS_BYTES) throw new Error("LRS R1 child exceeded the fixed 1 GiB RSS bound.");
  if (storageBytes > R1_MAX_STORAGE_BYTES) throw new Error("LRS R1 evidence exceeded the fixed 128 MiB storage bound.");
  return Object.freeze({ storageBytes, maximumObservedRssBytes });
}
