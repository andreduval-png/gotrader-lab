#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { loadLrsBaselineModules } from "./support/liquidity-reclaim-scalper-baseline-runner.mjs";
import { createHistoricalDatasetNodeStorage } from "./support/historical-dataset-node-storage.mjs";
import { finalizeR1EvidenceArchive, prepareR1CompletedTrialEvidenceArchive } from "./support/liquidity-reclaim-scalper-r1-evidence-capacity.mjs";
import { assertR1TrialProgress, buildR1ChildTelemetry, classifyR1ChildRss, createR1CompletionBudget,
  enforceR1ResourceBounds, openR1Controller, readR1TrialProgress, R1_MAX_RSS_BYTES,
  summarizeR1StageSamples, verifyAcceptedR1Inputs, verifyR1TrialReport, writeImmutableR1Artifact, writeR1ChildTelemetry,
  writeR1ControllerCheckpoint } from "./support/liquidity-reclaim-scalper-r1-executor.mjs";

const root = process.cwd();
const outputRoot = process.env.GOTRADER_LRS_R1_ROOT;
const mode = process.env.GOTRADER_LRS_R1_MODE ?? "pilot";
if (!outputRoot || !["pilot", "family"].includes(mode)) throw new Error("R1 output root and mode pilot|family are required.");
const controllerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const modules = await loadLrsBaselineModules(path.join(root, ".gotrader/liquidity-reclaim-scalper-v1/compiled-r1-controller"));
const { definitions } = await verifyAcceptedR1Inputs({ modules,
  acceptancePath: path.join(root, "docs/gotrader-strategies/liquidity-reclaim-scalper/r1-trial-controls-acceptance.json") });
const pilotCount = Number(process.env.GOTRADER_LRS_R1_PILOT_UNIQUE_TRIALS) || 2;
if (!Number.isInteger(pilotCount) || pilotCount < 1 || pilotCount > 3) throw new Error("R1 pilot must remain within 1..3 earliest unique trials.");
const selected = mode === "pilot" ? definitions.filter((item) => item.initialDisposition === "planned_unique").slice(0, pilotCount) : definitions;
const selectedTrialIds = selected.map((item) => item.trialId);
const { storage, checkpoint: initial } = await openR1Controller({ modules, outputRoot, mode, selectedTrialIds, controllerCommit });
let checkpoint = initial;
const controlRepository = new modules.trialControls.LrsR1TrialControlRepository(storage.adapter);
const dispositionFor = (trialId) => checkpoint.dispositions.find((item) => item.trialId === trialId);
const update = async (patch = {}) => {
  checkpoint = await writeR1ControllerCheckpoint({ modules, storage, input: { mode, selectedTrialIds,
    nextPosition: checkpoint.nextPosition, dispositions: checkpoint.dispositions, orderedEventIds: checkpoint.orderedEventIds,
    controllerCommit, startedAtUtc: checkpoint.startedAtUtc, childRuns: checkpoint.childRuns,
    maximumObservedRssBytes: checkpoint.maximumObservedRssBytes,
    telemetryStartChildRun: checkpoint.telemetryStartChildRun,
    orderedChildTelemetryIds: checkpoint.orderedChildTelemetryIds, ...patch } });
};
const appendEvent = async (trial, disposition, reasonCodes, evidenceIds, previousEventId) => {
  const event = await modules.trialControls.buildLrsR1TrialEvent({ trialId: trial.trialId,
    sequence: previousEventId ? 1 : 0, disposition, recordedAtUtc: new Date().toISOString(), reasonCodes, evidenceIds,
    ...(previousEventId ? { previousEventId } : {}) });
  await controlRepository.writeEvent(event);
  return event;
};

for (let position = checkpoint.nextPosition; position < selected.length; position += 1) {
  const trial = selected[position];
  await controlRepository.writeTrial(trial);
  if (trial.initialDisposition === "coalesced_duplicate") {
    const event = await appendEvent(trial, "coalesced", ["accepted_duplicate_parameter_hash"], [trial.duplicateOfTrialId]);
    await update({ nextPosition: position + 1,
      dispositions: [...checkpoint.dispositions, { trialId: trial.trialId, ordinal: trial.ordinal, disposition: "coalesced", duplicateOfTrialId: trial.duplicateOfTrialId, eventId: event.eventId }],
      orderedEventIds: [...checkpoint.orderedEventIds, event.eventId] });
    continue;
  }
  let disposition = dispositionFor(trial.trialId);
  if (!disposition) {
    const attempted = await appendEvent(trial, "attempted", ["bounded_certified_trial_started"], []);
    disposition = { trialId: trial.trialId, ordinal: trial.ordinal, disposition: "attempted", eventId: attempted.eventId };
    await update({ dispositions: [...checkpoint.dispositions, disposition], orderedEventIds: [...checkpoint.orderedEventIds, attempted.eventId] });
  }
  const trialRoot = path.join(outputRoot, "trials", trial.trialId.replace(":", "_"));
  let completed = fs.existsSync(path.join(trialRoot, "baseline-report.json"));
  let progress = readR1TrialProgress(trialRoot);
  let completionBudget = createR1CompletionBudget(progress);
  let stageChildRuns = 0;
  for (let childOrdinal = 0; !completed; childOrdinal += 1) {
    if (stageChildRuns >= completionBudget.maximumChildren) {
      throw new Error(`R1 trial ${trial.ordinal} exhausted its progress-derived ${completionBudget.stage} completion bound.`);
    }
    const beforeProgress = progress;
    const childRun = checkpoint.childRuns + 1;
    const childStartedAtUtc = new Date().toISOString();
    const child = spawnSync(process.execPath, ["--expose-gc", "scripts/run-liquidity-reclaim-scalper-r1-trial.mjs"], { cwd: root, encoding: "utf8",
      env: { ...process.env, GOTRADER_LRS_R1_TRIAL_ROOT: trialRoot, GOTRADER_LRS_R1_TRIAL_ORDINAL: String(trial.ordinal),
        GOTRADER_LRS_R1_PARAMETER_HASH: trial.parameterHash, GOTRADER_LRS_R1_CONTROLLER_COMMIT: controllerCommit,
        GOTRADER_LRS_MAX_SEGMENTS: "10", GOTRADER_LRS_MAX_RECORDS: "5" }, maxBuffer: 4 * 1024 * 1024 });
    const line = child.stdout?.split(/\r?\n/).findLast((item) => item.startsWith("R1_RESULT "));
    const result = line ? JSON.parse(line.slice(10)) : {};
    const stageSamples = (child.stdout?.split(/\r?\n/) ?? []).filter((item) => item.startsWith("R1_STAGE "))
      .map((item) => JSON.parse(item.slice(9)));
    const stageTelemetry = summarizeR1StageSamples(stageSamples);
    const childRssBytes = Math.max(Number(result.rssBytes) || 0,
      ...stageTelemetry.map((item) => item.maximumRssBytes), 0);
    const resourceDecision = classifyR1ChildRss(childRssBytes);
    const telemetry = await buildR1ChildTelemetry(modules, {
      childRun,
      trialId: trial.trialId,
      trialOrdinal: trial.ordinal,
      childOrdinal,
      startedAtUtc: childStartedAtUtc,
      completedAtUtc: new Date().toISOString(),
      exitStatus: child.status ?? -1,
      exitSignal: child.signal,
      resultReason: result.reason ?? (result.failed ? "child_reported_failure" : "unreported"),
      maximumObservedRssBytes: childRssBytes,
      resourceDecision,
      trialCheckpointId: result.checkpointId,
      completionProgress: beforeProgress,
      completionBudget: { ...completionBudget, stageChildRun: stageChildRuns + 1 },
      stageTelemetry,
      previousTelemetryId: checkpoint.orderedChildTelemetryIds.at(-1)
    });
    await writeR1ChildTelemetry({ modules, storage, telemetry });
    const maximumObservedRssBytes = Math.max(checkpoint.maximumObservedRssBytes, childRssBytes);
    await update({ childRuns: childRun, maximumObservedRssBytes,
      orderedChildTelemetryIds: [...checkpoint.orderedChildTelemetryIds, telemetry.telemetryId] });
    if (resourceDecision === "hard_limit_exceeded") {
      const failed = await appendEvent(trial, "failed", ["child_hard_rss_bound_exceeded"], [telemetry.telemetryId], disposition.eventId);
      await update({ dispositions: checkpoint.dispositions.map((item) => item.trialId === trial.trialId ? { ...item, disposition: "failed", eventId: failed.eventId } : item),
        orderedEventIds: [...checkpoint.orderedEventIds, failed.eventId] });
      throw new Error(`R1 trial child exceeded the fixed 1 GiB RSS bound for ordinal ${trial.ordinal}: ${childRssBytes} > ${R1_MAX_RSS_BYTES}.`);
    }
    enforceR1ResourceBounds(outputRoot, checkpoint.maximumObservedRssBytes);
    if (![0, 75].includes(child.status ?? -1)) {
      const failed = await appendEvent(trial, "failed", ["bounded_child_failed"], [telemetry.telemetryId], disposition.eventId);
      await update({ dispositions: checkpoint.dispositions.map((item) => item.trialId === trial.trialId ? { ...item, disposition: "failed", eventId: failed.eventId } : item),
        orderedEventIds: [...checkpoint.orderedEventIds, failed.eventId] });
      throw new Error(`R1 trial child failed for ordinal ${trial.ordinal}: ${child.stderr || child.stdout}`);
    }
    completed = fs.existsSync(path.join(trialRoot, "baseline-report.json"));
    progress = assertR1TrialProgress(beforeProgress, readR1TrialProgress(trialRoot));
    stageChildRuns += 1;
    if (!completed && progress.stage !== completionBudget.stage) {
      completionBudget = createR1CompletionBudget(progress);
      stageChildRuns = 0;
    }
    if (Number(process.env.GOTRADER_LRS_R1_INTERRUPT_AFTER_CHILDREN) === checkpoint.childRuns) process.exit(75);
  }
  const report = await verifyR1TrialReport({ modules, reportPath: path.join(trialRoot, "baseline-report.json"), trial });
  const archive = await prepareR1CompletedTrialEvidenceArchive({ modules, storage, outputRoot, trial,
    orderedChildTelemetryIds: checkpoint.orderedChildTelemetryIds });
  const completedEvent = await appendEvent(trial, "completed", ["verified_trial_report_bt2_ledger_and_evidence_archive"],
    [report.reportId, report.ledgerSealId, archive.archiveId], disposition.eventId);
  await update({ nextPosition: position + 1,
    dispositions: checkpoint.dispositions.map((item) => item.trialId === trial.trialId ? { ...item, disposition: "completed", eventId: completedEvent.eventId,
      reportId: report.reportId, ledgerSealId: report.ledgerSealId, evidenceArchiveId: archive.archiveId } : item),
    orderedEventIds: [...checkpoint.orderedEventIds, completedEvent.eventId] });
  await finalizeR1EvidenceArchive({ storage, manifest: archive });
  enforceR1ResourceBounds(outputRoot, checkpoint.maximumObservedRssBytes);
}

const resources = enforceR1ResourceBounds(outputRoot, checkpoint.maximumObservedRssBytes);
const reportCore = Object.freeze({ schemaVersion: "gotrader-lrs-r1-family-operator-report-v1", mode,
  experimentFamilyId: checkpoint.experimentFamilyId, samplingPlanId: checkpoint.samplingPlanId, sampleSetId: checkpoint.sampleSetId,
  selectedTrialCount: selected.length, completedCount: checkpoint.dispositions.filter((item) => item.disposition === "completed").length,
  coalescedCount: checkpoint.dispositions.filter((item) => item.disposition === "coalesced").length,
  dispositions: checkpoint.dispositions, childRuns: checkpoint.childRuns, resources, holdoutUsed: false, adaptiveSearchUsed: false,
  researchValidated: false, productionAdoptionAllowed: false, authority: checkpoint.authority });
const report = Object.freeze({ ...reportCore, reportId: await modules.canonical.canonicalHash(reportCore) });
await writeImmutableR1Artifact({ modules, storage, relativePath: `${mode}-report.json`, artifact: report });
console.log(JSON.stringify(report, null, 2));
