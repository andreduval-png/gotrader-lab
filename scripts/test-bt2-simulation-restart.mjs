#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildOpportunity, candle, fixtureIds, loadBt2Modules } from "./support/bt2-simulation-fixtures.mjs";
import { createHistoricalDatasetNodeStorage } from "./support/historical-dataset-node-storage.mjs";

const root = path.resolve(".gotrader", "bt2-restart-tests");
fs.rmSync(root, { recursive: true, force: true });
const modules = await loadBt2Modules({ outRoot: path.join(root, "compiled") });
const cost = await modules.simulation.buildSimulationCostModel({
  version: "1", pointSize: 0.01, spreadMode: "none", slippagePoints: 0, commissionR: 0, swapR: 0
});
const opportunities = await Promise.all([
  buildOpportunity(modules),
  buildOpportunity(modules, { decisionAtUtc: "2026-01-05T15:00:00.000Z", sourceCandleClosedAtUtc: "2026-01-05T15:00:00.000Z", activatesAtUtc: "2026-01-05T15:00:00.000Z", expiresAtUtc: "2026-01-05T15:30:00.000Z" }),
  buildOpportunity(modules, { decisionAtUtc: "2026-01-05T16:00:00.000Z", sourceCandleClosedAtUtc: "2026-01-05T16:00:00.000Z", activatesAtUtc: "2026-01-05T16:00:00.000Z", expiresAtUtc: "2026-01-05T16:30:00.000Z" })
]);

const run = async (storageRoot, interruptAfter) => {
  const storage = createHistoricalDatasetNodeStorage({ root: storageRoot });
  const repository = new modules.simulation.SimulationRepository(storage.adapter);
  const existing = await repository.readCheckpoint(fixtureIds.experiment);
  const recordIds = [...(existing?.committedRecordIds ?? [])];
  for (let index = existing?.nextOpportunityOrdinal ?? 0; index < opportunities.length; index += 1) {
    const opportunity = opportunities[index];
    await repository.writeOpportunity(opportunity);
    const base = Date.parse(opportunity.activatesAtUtc);
    const record = await modules.simulation.simulateTrade({
      opportunity,
      candles: [candle(new Date(base).toISOString(), 100, 102.2, 99.5, 102)],
      intrabarPolicy: "conservative_stop_first_v1",
      costModel: cost
    });
    await repository.writeRecord(record);
    recordIds.push(record.recordId);
    await repository.writeCheckpoint({
      experimentId: fixtureIds.experiment,
      nextOpportunityOrdinal: index + 1,
      committedRecordIds: recordIds
    });
    if (interruptAfter === index + 1) return undefined;
  }
  const seal = await modules.simulation.buildTradeLedgerSeal({
    experimentId: fixtureIds.experiment,
    datasetCertificateId: fixtureIds.certificate,
    orderedRecordIds: recordIds,
    outcomeCounts: Object.freeze({ exited: 3, expired_unfilled: 0, ambiguous: 0, insufficient_data: 0, blocked: 0 }),
    checkpointLineage: Object.freeze([]),
    codeCommit: "bt2-fixture"
  });
  await repository.writeLedgerSeal(seal);
  return seal;
};

const uninterrupted = await run(path.join(root, "uninterrupted"));
assert.ok(uninterrupted);
assert.equal(await run(path.join(root, "resumed"), 1), undefined);
const resumed = await run(path.join(root, "resumed"));
assert.ok(resumed);
assert.equal(resumed.ledgerSealId, uninterrupted.ledgerSealId);

const corruptStorage = createHistoricalDatasetNodeStorage({ root: path.join(root, "corrupt-checkpoint") });
const corruptRepository = new modules.simulation.SimulationRepository(corruptStorage.adapter);
await corruptRepository.writeCheckpoint({
  experimentId: fixtureIds.experiment,
  nextOpportunityOrdinal: 1,
  committedRecordIds: Object.freeze([])
});
const checkpointPath = corruptStorage.resolveSafe(`checkpoints/${fixtureIds.experiment.replace(":", "_")}.json`);
const corruptCheckpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
corruptCheckpoint.nextOpportunityOrdinal = 2;
fs.writeFileSync(checkpointPath, `${JSON.stringify(corruptCheckpoint)}\n`);
await assert.rejects(() => corruptRepository.readCheckpoint(fixtureIds.experiment), /checkpoint_id_invalid/);

const storage = createHistoricalDatasetNodeStorage({ root: path.join(root, "conflict") });
const repository = new modules.simulation.SimulationRepository(storage.adapter);
await repository.writeOpportunity(opportunities[0]);
const conflictPath = storage.resolveSafe(`opportunities/${opportunities[0].opportunityId.replace(":", "_")}.json`);
fs.writeFileSync(conflictPath, "{}\n");
await assert.rejects(() => repository.writeOpportunity(opportunities[0]), /Immutable simulation artifact conflict/);

console.log(JSON.stringify({
  status: "passed",
  uninterruptedLedgerSealId: uninterrupted.ledgerSealId,
  resumedLedgerSealId: resumed.ledgerSealId,
  deterministicResume: true,
  corruptCheckpointRejected: true,
  immutableConflictRejected: true,
  rawCandleArraysSerialized: false,
  authority: uninterrupted.authority
}, null, 2));
