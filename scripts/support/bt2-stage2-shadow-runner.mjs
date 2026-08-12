import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";
import { createHistoricalDatasetNodeStorage } from "./historical-dataset-node-storage.mjs";

const HASH = /^sha256:[0-9a-f]{64}$/;
const authorityNone = Object.freeze({ executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" });

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const coreWithout = (value, key) => Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));

export async function loadStage2Modules(outRoot) {
  compileTypescriptModules({
    files: [
      path.join(process.cwd(), "src/lib/backtestSimulation/index.ts"),
      path.join(process.cwd(), "src/lib/historicalData/historicalDatasetRepository.ts")
    ],
    outRoot
  });
  const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
  return Object.freeze({
    simulation: await load("index"),
    historical: await load("historicalDatasetRepository"),
    canonical: await load("canonicalValueSerialization")
  });
}

export async function verifyQualifiedInput({ modules, certificatePath, registryPath, repositoryRoot }) {
  const certificate = readJson(certificatePath);
  const registry = readJson(registryPath);
  const blockers = [];
  if (await modules.canonical.canonicalHash(coreWithout(certificate, "certificateId")) !== certificate.certificateId) blockers.push("bt2_certificate_hash_invalid");
  if (await modules.canonical.canonicalHash(coreWithout(registry, "registryId")) !== registry.registryId) blockers.push("bt2_registry_hash_invalid");
  const entry = registry.entries?.find((item) => item.certificateId === certificate.certificateId);
  if (!entry || entry.status !== "qualified" || entry.datasetId !== certificate.datasetId) blockers.push("bt2_registry_qualification_missing");
  if (!certificate.readOnlySafetyVerified || !certificate.strategyNeutral || certificate.providerDriftStatus !== "not_detected") blockers.push("bt2_certificate_scope_invalid");
  if (JSON.stringify(certificate.authority) !== JSON.stringify(authorityNone) || JSON.stringify(registry.authority) !== JSON.stringify(authorityNone)) blockers.push("bt2_input_authority_invalid");
  if (!HASH.test(certificate.datasetId) || !HASH.test(certificate.lineageRoot)) blockers.push("bt2_input_identity_invalid");
  if (blockers.length) return Object.freeze({ certificate, registry, blockers: Object.freeze([...new Set(blockers)].sort()) });
  const historical = new modules.historical.HistoricalDatasetRepository({
    storage: createHistoricalDatasetNodeStorage({ root: repositoryRoot }).adapter
  });
  const verification = await historical.verifyDataset(certificate.datasetId);
  if (verification.status !== "verified" || verification.blockers.length) blockers.push(...verification.blockers, "bt2_dataset_verification_failed");
  const manifest = await historical.readManifest(certificate.datasetId);
  if (manifest.datasetId !== certificate.datasetId || manifest.datasetChecksum !== certificate.datasetChecksum) blockers.push("bt2_manifest_certificate_mismatch");
  return Object.freeze({ certificate, registry, manifest, verification, blockers: Object.freeze([...new Set(blockers)].sort()) });
}

export function readBoundedM1Candles({ repositoryRoot, manifest, maximumPartitions }) {
  const root = path.resolve(repositoryRoot);
  const m1 = manifest.timeframes.find((item) => item.timeframe === "1m");
  if (!m1) throw new Error("Qualified dataset has no M1 seal.");
  const selected = m1.partitionIds.slice(0, maximumPartitions);
  const candles = [];
  for (const id of selected) {
    const file = path.resolve(root, "partitions", `${id.replace(":", "_")}.json`);
    if (!file.startsWith(`${root}${path.sep}`)) throw new Error("Partition path escaped qualified repository.");
    const envelope = readJson(file);
    if (envelope.payload?.partitionId !== id || envelope.payload?.timeframe !== "1m") throw new Error("Partition identity mismatch.");
    candles.push(...envelope.payload.candles);
  }
  candles.sort((a, b) => a.openTimeUtc.localeCompare(b.openTimeUtc));
  return Object.freeze({ partitionIds: Object.freeze(selected), candles: Object.freeze(candles) });
}

export async function buildSyntheticCases({ modules, qualified, sample, maximumOpportunities }) {
  const cases = [];
  const stride = 256;
  const parameterHash = await modules.canonical.canonicalHash({ generator: "bt2-stage2-synthetic-canary-v1", stride });
  for (let index = 16; index + 31 < sample.candles.length && cases.length < maximumOpportunities; index += stride) {
    const source = sample.candles[index];
    const future = sample.candles.slice(index + 1, index + 31);
    if (!future.length || future[0].openTimeUtc < source.closeTimeUtc) continue;
    const direction = cases.length % 2 === 0 ? "long" : "short";
    const distance = Math.max(1, Math.round(Math.max(source.high - source.low, 1) * 100) / 100);
    const opportunity = await modules.simulation.buildCanonicalOpportunity({
      adapterVersion: "bt2-stage2-synthetic-canary-v1",
      datasetCertificateId: qualified.certificate.certificateId,
      datasetId: qualified.certificate.datasetId,
      strategyId: "synthetic_stage2_canary_not_a_strategy",
      profileVersion: "1",
      parameterHash,
      requestedSymbol: qualified.certificate.requestedSymbol,
      brokerSymbol: qualified.certificate.brokerSymbol,
      timeframe: "1m",
      decisionAtUtc: source.closeTimeUtc,
      sourceCandleClosedAtUtc: source.closeTimeUtc,
      contextLineageRoot: qualified.certificate.lineageRoot,
      direction,
      orderPolicy: "market_at_next_open",
      activatesAtUtc: future[0].openTimeUtc,
      expiresAtUtc: new Date(Date.parse(future[0].openTimeUtc) + 30 * 60_000).toISOString(),
      signalPrice: source.close,
      entryPrice: source.close,
      stopPrice: direction === "long" ? source.close - distance : source.close + distance,
      targetPrices: Object.freeze([direction === "long" ? source.close + distance * 2 : source.close - distance * 2]),
      eligible: true,
      blockers: Object.freeze([])
    });
    cases.push(Object.freeze({ opportunity, candles: Object.freeze(future) }));
  }
  return Object.freeze(cases);
}

export async function runShadowLane({ modules, outputRoot, cases, qualified, sample, codeCommit, interruptAfterRecords }) {
  const storage = createHistoricalDatasetNodeStorage({ root: outputRoot });
  const repository = new modules.simulation.SimulationRepository(storage.adapter);
  const experimentId = await modules.canonical.canonicalHash({
    schemaVersion: "gotrader-bt2-stage2-experiment-v1",
    certificateId: qualified.certificate.certificateId,
    registryId: qualified.registry.registryId,
    partitionIds: sample.partitionIds,
    opportunityIds: cases.map((item) => item.opportunity.opportunityId),
    engineVersion: "bt2-pure-simulator-v1"
  });
  const costModel = await modules.simulation.buildSimulationCostModel({
    version: "bt2-stage2-observed-spread-v1", pointSize: 0.01, spreadMode: "candle",
    slippagePoints: 0, commissionR: 0, swapR: 0
  });
  const existing = await repository.readCheckpoint(experimentId);
  const recordIds = [...(existing?.committedRecordIds ?? [])];
  const checkpointLineage = [];
  const startedRss = process.memoryUsage().rss;
  let peakRss = startedRss;
  for (let ordinal = existing?.nextOpportunityOrdinal ?? 0; ordinal < cases.length; ordinal += 1) {
    const item = cases[ordinal];
    await repository.writeOpportunity(item.opportunity);
    const record = await modules.simulation.simulateTrade({
      opportunity: item.opportunity, candles: item.candles,
      intrabarPolicy: "conservative_stop_first_v1", costModel
    });
    if (record.blockers.length || record.terminalState === "blocked") throw new Error(`Stage 2 simulation blocked: ${record.blockers.join(", ")}`);
    await repository.writeRecord(record);
    recordIds.push(record.recordId);
    const checkpoint = await repository.writeCheckpoint({ experimentId, nextOpportunityOrdinal: ordinal + 1, committedRecordIds: recordIds });
    checkpointLineage.push(checkpoint.checkpointId);
    peakRss = Math.max(peakRss, process.memoryUsage().rss);
    if (interruptAfterRecords === ordinal + 1) return Object.freeze({ interrupted: true, experimentId, checkpointId: checkpoint.checkpointId });
  }
  const records = recordIds.map((id) => readJson(storage.resolveSafe(`records/${id.replace(":", "_")}.json`)));
  const states = ["exited", "expired_unfilled", "ambiguous", "insufficient_data", "blocked"];
  const outcomeCounts = Object.fromEntries(states.map((state) => [state, records.filter((item) => item.terminalState === state).length]));
  const seal = await modules.simulation.buildTradeLedgerSeal({
    experimentId, datasetCertificateId: qualified.certificate.certificateId,
    orderedRecordIds: recordIds, outcomeCounts, checkpointLineage: Object.freeze([]), codeCommit
  });
  await repository.writeLedgerSeal(seal);
  const reportCore = Object.freeze({
    schemaVersion: "gotrader-bt2-stage2-shadow-report-v1", status: "passed",
    experimentId, certificateId: qualified.certificate.certificateId,
    registryId: qualified.registry.registryId, datasetId: qualified.certificate.datasetId,
    ledgerSealId: seal.ledgerSealId, opportunityCount: cases.length,
    partitionIds: sample.partitionIds, sourceCandleCount: sample.candles.length,
    outcomeCounts, peakRssBytes: peakRss, rssIncreaseBytes: Math.max(0, peakRss - startedRss),
    maximumPartitions: sample.partitionIds.length, maximumWorkers: 1,
    rawCandlesSerialized: false, mt5Contacted: false, syntheticOnly: true,
    authority: authorityNone
  });
  const report = Object.freeze({ ...reportCore, reportId: await modules.canonical.canonicalHash(reportCore) });
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(path.join(outputRoot, "stage2-report.json"), `${modules.canonical.canonicalSerialize(report)}\n`);
  return Object.freeze({ interrupted: false, seal, report });
}
