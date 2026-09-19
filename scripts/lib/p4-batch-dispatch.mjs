import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { canonicalHash } from "./bt-g1-3-certified-dataset.mjs";

const persisted = (value) => JSON.parse(JSON.stringify(value));
const atomicWrite = (file, value) => {
  const temporary = `${file}.${randomUUID()}.tmp`;
  const fd = fs.openSync(temporary, "wx");
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
};

// One complete fold identity/schedule across every batch: no shortened scoring horizons.
export const dispatchHistoricalFold = ({ directory, binding, input, runFold,
  batchSize = 6, maxBatches = Number.MAX_SAFE_INTEGER }) => {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 ||
      !Number.isSafeInteger(maxBatches) || maxBatches < 1 ||
      !input.evaluationTimes?.length || new Set(input.evaluationTimes).size !== input.evaluationTimes.length ||
      input.evaluationTimes.some((time, index, times) => !Number.isFinite(Date.parse(time)) ||
        (index > 0 && Date.parse(time) <= Date.parse(times[index - 1])))) {
    throw new Error("BATCH_INVALID_SCHEDULE_OR_BUDGET");
  }
  fs.mkdirSync(directory, { recursive: true });
  const lock = path.join(directory, "dispatch.lock"), token = randomUUID();
  const fd = fs.openSync(lock, "wx");
  fs.writeFileSync(fd, JSON.stringify({ token, pid: process.pid }));
  fs.closeSync(fd);
  const stateFile = path.join(directory, "state.json");
  const identity = canonicalHash({ binding, schedule: input.evaluationTimes, batchSize });
  let checkpoint = input.resumeFrom;
  try {
    if (fs.existsSync(stateFile)) {
      if (checkpoint) throw new Error("BATCH_REVIEWED_CHECKPOINT_REQUIRES_NEW_STATE");
      const { stateHash, ...state } = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      if (canonicalHash(state) !== stateHash || state.identity !== identity) throw new Error("BATCH_STATE_IDENTITY_MISMATCH");
      checkpoint = state.checkpoint;
    }
    for (let batch = 0; batch < maxBatches; batch += 1) {
      const previousPosition = checkpoint?.nextPosition ?? 0;
      const stop = new Error("CONTROLLED_BATCH_BOUNDARY");
      let result;
      try {
        result = runFold({ ...input, resumeFrom: checkpoint, checkpointEvery: batchSize,
          onCheckpoint(next) {
            if (next.nextPosition <= previousPosition || next.nextPosition > input.evaluationTimes.length) {
              throw new Error("BATCH_NON_MONOTONIC_PROGRESS");
            }
            checkpoint = persisted(next);
            const state = { identity, checkpoint };
            atomicWrite(stateFile, { ...state, stateHash: canonicalHash(state) });
            if (next.nextPosition < input.evaluationTimes.length) throw stop;
          }
        });
        if (result?.then) throw new Error("BATCH_SYNCHRONOUS_RUNNER_REQUIRED");
      } catch (error) {
        if (error !== stop) throw error;
        // Release per-batch fact graphs before the next synchronous fold invocation.
        if (typeof global.gc === "function") global.gc();
        continue;
      }
      const terminal = result.result ?? result;
      if (terminal.counts.evaluated !== input.evaluationTimes.length ||
          checkpoint?.nextPosition !== input.evaluationTimes.length ||
          canonicalHash(terminal.detections.map((item) => item.asOf)) !== canonicalHash(input.evaluationTimes)) {
        throw new Error("BATCH_TERMINAL_COVERAGE_MISMATCH");
      }
      return { status: "COMPLETED", result, identity, batchesExecuted: batch + 1 };
    }
    return { status: "CHECKPOINTED", nextPosition: checkpoint?.nextPosition ?? 0, identity };
  } finally {
    // A crashed process leaves its lock for explicit diagnosis, never auto-restart.
    if (JSON.parse(fs.readFileSync(lock, "utf8")).token === token) fs.unlinkSync(lock);
  }
};

export const reconcileHistoricalResults = ({ results, expectedOwners, expectedSchedule }) => {
  if (results.length !== expectedOwners.length || new Set(expectedOwners).size !== expectedOwners.length ||
      new Set(results.map((item) => item.strategyId)).size !== results.length ||
      results.some((item) => !expectedOwners.includes(item.strategyId))) throw new Error("AGGREGATE_OWNER_COVERAGE_MISMATCH");
  const owners = results.map((result) => {
    const fail = () => { throw new Error(`AGGREGATE_RECONCILIATION_FAILED: ${result.strategyId}`); };
    const { detections, outcomes, geometryEnvelopes: envelopes } = result;
    if (canonicalHash(detections.map((item) => item.asOf)) !== canonicalHash(expectedSchedule) ||
        new Set(envelopes.map((item) => item.geometryId)).size !== envelopes.length ||
        new Set(outcomes.map((item) => item.geometryId)).size !== outcomes.length ||
        result.researchValidated !== false || result.authority.executionAuthority !== "none" ||
        result.authority.brokerAuthority !== "none" || result.authority.readinessOverrideAuthority !== "none") fail();
    const identityKeys = ["datasetId", "datasetCertificateId", "datasetChecksum", "sourceFingerprint", "configurationId", "costModelId", "fillModelId"];
    if (identityKeys.some((key) => result[key] !== results[0][key])) fail();
    for (const outcome of outcomes) {
      const envelope = envelopes.find((item) => item.geometryId === outcome.geometryId);
      if (!envelope?.actionable || envelope.geometryStatus !== "VALID_ACTIONABLE" ||
          outcome.canonicalGeometryParityHash !== envelope.canonicalGeometryParityHash ||
          !Number.isFinite(outcome.realizedR) || !Number.isFinite(outcome.costR)) fail();
      if (["target_hit", "stop_hit"].includes(outcome.outcome) && outcome.entryIndex === undefined) fail();
    }
    const wins = outcomes.filter((item) => item.outcome === "target_hit");
    const losses = outcomes.filter((item) => item.outcome === "stop_hit");
    const resolved = outcomes.filter((item) => item.outcome === "target_hit" || item.outcome === "stop_hit");
    const counts = {
      evaluated: detections.length,
      candidates: new Set(detections.filter((item) => item.geometryId).map((item) => item.candidateId)).size,
      geometryComplete: detections.filter((item) => item.geometryValid).length,
      sourceBlocked: detections.filter((item) => /source.block/i.test(item.status) || item.blockers.some((blocker) => /source.block/i.test(blocker))).length,
      belowRR: detections.filter((item) => item.geometryStatus === "VALID_BELOW_RR_THRESHOLD").length,
      entryMissed: detections.filter((item) => item.entryMissed).length,
      entryNotRetraced: outcomes.filter((item) => item.outcome === "entry_not_retraced").length,
      targetConsumed: detections.filter((item) => item.targetConsumed).length,
      expired: outcomes.filter((item) => item.outcome === "expired").length,
      eligible: envelopes.filter((item) => item.actionable && item.geometryStatus === "VALID_ACTIONABLE").length,
      fillAttempted: outcomes.length,
      fills: outcomes.filter((item) => item.entryIndex !== undefined).length,
      completedTrades: resolved.length
    };
    if (canonicalHash(counts) !== canonicalHash(result.counts)) fail();
    const round = (value) => Number(value.toFixed(6));
    const net = resolved.reduce((sum, item) => sum + item.realizedR, 0);
    const metrics = { wins: wins.length, losses: losses.length,
      unresolved: outcomes.filter((item) => item.entryIndex !== undefined && item.outcome === "expired").length,
      grossRealizedR: round(resolved.reduce((sum, item) => sum + item.realizedR + item.costR, 0)),
      netRealizedR: round(net), averageNetR: resolved.length ? round(net / resolved.length) : null,
      winRate: resolved.length ? round(wins.length / resolved.length) : null };
    if (canonicalHash(metrics) !== canonicalHash(result.metrics)) fail();
    return { strategyId: result.strategyId, resultIdentityHash: result.resultIdentityHash, counts, metrics };
  });
  const report = { schemaVersion: "gotrader.batch-reconciliation.v1", owners,
    totalEvaluated: owners.reduce((sum, owner) => sum + owner.counts.evaluated, 0),
    totalCompletedTrades: owners.reduce((sum, owner) => sum + owner.counts.completedTrades, 0),
    researchValidated: false, authority: "none/none/none" };
  return { ...report, reconciliationHash: canonicalHash(report) };
};
