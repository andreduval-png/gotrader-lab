#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { loadLrsBaselineModules } from "./support/liquidity-reclaim-scalper-baseline-runner.mjs";
import { createHistoricalDatasetNodeStorage } from "./support/historical-dataset-node-storage.mjs";
import { enforceR1ResourceBounds, openR1Controller, verifyAcceptedR1Inputs, verifyR1TrialReport,
  writeImmutableR1Artifact, writeR1ControllerCheckpoint } from "./support/liquidity-reclaim-scalper-r1-executor.mjs";

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
    maximumObservedRssBytes: checkpoint.maximumObservedRssBytes, ...patch } });
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
  for (let childOrdinal = 0; !completed && childOrdinal < 200; childOrdinal += 1) {
    const child = spawnSync(process.execPath, ["--expose-gc", "scripts/run-liquidity-reclaim-scalper-r1-trial.mjs"], { cwd: root, encoding: "utf8",
      env: { ...process.env, GOTRADER_LRS_R1_TRIAL_ROOT: trialRoot, GOTRADER_LRS_R1_TRIAL_ORDINAL: String(trial.ordinal),
        GOTRADER_LRS_R1_PARAMETER_HASH: trial.parameterHash, GOTRADER_LRS_R1_CONTROLLER_COMMIT: controllerCommit,
        GOTRADER_LRS_MAX_SEGMENTS: "10", GOTRADER_LRS_MAX_RECORDS: "5" }, maxBuffer: 4 * 1024 * 1024 });
    const line = child.stdout?.split(/\r?\n/).findLast((item) => item.startsWith("R1_RESULT "));
    const result = line ? JSON.parse(line.slice(10)) : {};
    const maximumObservedRssBytes = Math.max(checkpoint.maximumObservedRssBytes, Number(result.rssBytes) || 0);
    await update({ childRuns: checkpoint.childRuns + 1, maximumObservedRssBytes });
    if (![0, 75].includes(child.status ?? -1)) {
      const failed = await appendEvent(trial, "failed", ["bounded_child_failed"], [], disposition.eventId);
      await update({ dispositions: checkpoint.dispositions.map((item) => item.trialId === trial.trialId ? { ...item, disposition: "failed", eventId: failed.eventId } : item),
        orderedEventIds: [...checkpoint.orderedEventIds, failed.eventId] });
      throw new Error(`R1 trial child failed for ordinal ${trial.ordinal}: ${child.stderr || child.stdout}`);
    }
    completed = fs.existsSync(path.join(trialRoot, "baseline-report.json"));
    if (Number(process.env.GOTRADER_LRS_R1_INTERRUPT_AFTER_CHILDREN) === checkpoint.childRuns) process.exit(75);
  }
  if (!completed) throw new Error(`R1 trial ${trial.ordinal} exhausted its bounded child limit.`);
  const report = await verifyR1TrialReport({ modules, reportPath: path.join(trialRoot, "baseline-report.json"), trial });
  const completedEvent = await appendEvent(trial, "completed", ["verified_trial_report_and_bt2_ledger"], [report.reportId, report.ledgerSealId], disposition.eventId);
  await update({ nextPosition: position + 1,
    dispositions: checkpoint.dispositions.map((item) => item.trialId === trial.trialId ? { ...item, disposition: "completed", eventId: completedEvent.eventId,
      reportId: report.reportId, ledgerSealId: report.ledgerSealId } : item), orderedEventIds: [...checkpoint.orderedEventIds, completedEvent.eventId] });
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
