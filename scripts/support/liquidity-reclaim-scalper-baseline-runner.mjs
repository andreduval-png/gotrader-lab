import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";
import { createHistoricalDatasetNodeStorage } from "./historical-dataset-node-storage.mjs";
import { verifyQualifiedInput } from "./bt2-stage2-shadow-runner.mjs";

export const LRS_BASELINE_SCHEMA_VERSION = "gotrader-lrs-certified-descriptive-baseline-v1";
export const LRS_BASELINE_MAX_RSS_BYTES = 1_073_741_824;
export const LRS_BASELINE_MAX_STORAGE_BYTES = 134_217_728;
export const LRS_BASELINE_MAX_FORWARD_CANDLES = 50_000;
export const LRS_BASELINE_AUTHORITY = Object.freeze({ executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" });

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const safeId = (id) => id.replace(":", "_");
const quantile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position), upper = Math.ceil(position);
  return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};
const bounded = (value) => Object.freeze(value);

export async function loadLrsBaselineModules(outRoot) {
  compileTypescriptModules({ outRoot, files: [
    "src/lib/v2/identity/v2Identity.ts",
    "src/lib/v2/candles/v2CandleWindowBuilder.ts",
    "src/lib/v2/context/v2ContextBuilder.ts",
    "src/lib/v2/strategyAdapters/liquidityReclaimScalper/liquidityReclaimScalperDetector.ts",
    "src/lib/strategyLibrary/liquidityReclaimScalper/liquidityReclaimScalperParameters.ts",
    "src/lib/backtestStrategyAdapters/liquidityReclaimScalperCanonicalAdapter.ts",
    "src/lib/backtestSimulation/index.ts",
    "src/lib/historicalData/historicalDatasetRepository.ts"
  ].map((file) => path.join(process.cwd(), file)) });
  const load = (name) => import(`${pathToFileURL(path.join(outRoot, `${name}.mjs`)).href}?v=${Date.now()}`);
  return bounded({ identity: await load("v2Identity"), candle: await load("v2CandleWindowBuilder"), context: await load("v2ContextBuilder"),
    detector: await load("liquidityReclaimScalperDetector"), parameters: await load("liquidityReclaimScalperParameters"), adapter: await load("liquidityReclaimScalperCanonicalAdapter"),
    simulation: await load("index"), historical: await load("historicalDatasetRepository"), canonical: await load("canonicalValueSerialization") });
}

const readPartition = (repositoryRoot, id, expectedTimeframe) => {
  const root = path.resolve(repositoryRoot);
  const file = path.resolve(root, "partitions", `${safeId(id)}.json`);
  if (!file.startsWith(`${root}${path.sep}`)) throw new Error("Partition path escaped certified repository.");
  const envelope = readJson(file);
  if (envelope.payload?.partitionId !== id || envelope.payload?.timeframe !== expectedTimeframe) throw new Error("Certified partition identity mismatch.");
  return envelope.payload.candles;
};

export function loadCertifiedTimeframe({ repositoryRoot, manifest, timeframe }) {
  const seal = manifest.timeframes.find((item) => item.timeframe === timeframe);
  if (!seal) throw new Error(`Certified dataset has no ${timeframe} seal.`);
  const candles = seal.partitionIds.flatMap((id) => readPartition(repositoryRoot, id, timeframe));
  candles.sort((a, b) => a.openTimeUtc.localeCompare(b.openTimeUtc));
  if (candles.length !== seal.candleCount || candles[0]?.openTimeUtc !== seal.firstCandleTimeUtc || candles.at(-1)?.closeTimeUtc !== seal.lastCandleTimeUtc) {
    throw new Error(`Certified ${timeframe} coverage mismatch.`);
  }
  return bounded(candles);
}

export function buildCertifiedPartitionIndex({ repositoryRoot, manifest, timeframe }) {
  const seal = manifest.timeframes.find((item) => item.timeframe === timeframe);
  if (!seal) throw new Error(`Certified dataset has no ${timeframe} seal.`);
  const partitions = seal.partitionIds.map((id) => {
    const candles = readPartition(repositoryRoot, id, timeframe);
    if (!candles.length) throw new Error(`Certified ${timeframe} partition is empty.`);
    return bounded({ partitionId: id, firstOpenTimeUtc: candles[0].openTimeUtc, lastCloseTimeUtc: candles.at(-1).closeTimeUtc, candleCount: candles.length });
  }).sort((a, b) => a.firstOpenTimeUtc.localeCompare(b.firstOpenTimeUtc));
  const count = partitions.reduce((sum, item) => sum + item.candleCount, 0);
  if (count !== seal.candleCount || partitions[0]?.firstOpenTimeUtc !== seal.firstCandleTimeUtc ||
      partitions.at(-1)?.firstOpenTimeUtc > seal.lastCandleTimeUtc || partitions.at(-1)?.lastCloseTimeUtc !== seal.lastCandleTimeUtc) {
    throw new Error(`Certified ${timeframe} partition index mismatch.`);
  }
  return bounded({ timeframe, partitions: bounded(partitions), candleCount: count });
}

export function readCertifiedForwardCandles({ repositoryRoot, index, startUtc, maximumCandles }) {
  const selected = index.partitions.filter((item) => item.lastCloseTimeUtc > startUtc);
  const candles = [];
  for (const item of selected) {
    candles.push(...readPartition(repositoryRoot, item.partitionId, index.timeframe).filter((candle) => candle.closeTimeUtc > startUtc));
    if (candles.length >= maximumCandles) break;
  }
  candles.sort((a, b) => a.openTimeUtc.localeCompare(b.openTimeUtc));
  return bounded(candles.slice(0, maximumCandles));
}

const legacy = (candle) => bounded({ openTime: candle.openTimeUtc, closeTime: candle.closeTimeUtc, open: candle.open, high: candle.high,
  low: candle.low, close: candle.close, volume: candle.volume, isClosed: true });
const before = (candles, time) => {
  let low = 0, high = candles.length;
  while (low < high) { const mid = (low + high) >>> 1; if (candles[mid].closeTimeUtc <= time) low = mid + 1; else high = mid; }
  return low;
};
const inversionEventKey = (fact) => [fact.payload.direction, fact.payload.confirmationCandleTime, fact.payload.lowerBound,
  fact.payload.upperBound, fact.payload.inversionTime].join(":");

export async function buildCertifiedContext({ modules, source, m5, m15, asOf }) {
  const makeWindow = async (candles, timeframe, limit) => modules.candle.buildV2CanonicalCandleWindow({
    adapterId: "gotrader-lrs-certified-baseline-v1", adapterVersion: "v1", asOf, closurePolicy: "historical_dataset",
    legacyCandles: candles.slice(Math.max(0, before(candles, asOf) - limit), before(candles, asOf)).map(legacy),
    query: { source, timeframe, end: asOf, limit, closedOnly: true, purpose: "context_shadow" }, source,
    timeContractVerificationStatus: "verified", timeVerificationScope: "historical",
    sourceTimeEligibility: { currentLiveEligible: false, historicalEligible: true, blockers: [], warnings: [] }
  });
  const windows = [await makeWindow(m5, "5m", 600), await makeWindow(m15, "15m", 200)];
  return modules.context.buildV2CanonicalMarketContext({ source, requestedSymbol: source.requestedSymbol, brokerSymbol: source.brokerSymbol,
    asOfMarketTime: asOf, requiredTimeframes: ["5m", "15m"], windows, purpose: "deterministic_fixture",
    requestedFactFamilies: ["session", "opening_price", "dealing_range", "liquidity", "displacement", "fair_value_gap"], builtAt: asOf });
}

export const buildScanCheckpointCore = ({ nextSegment, candidates, seenFactIds }) => bounded({
  schemaVersion: "gotrader-lrs-baseline-scan-checkpoint-v1", nextSegment,
  candidates: bounded([...candidates]), seenFactIds: bounded([...seenFactIds].sort()), authority: LRS_BASELINE_AUTHORITY
});

export async function discoverCandidates({ modules, qualified, m5, m15, checkpoint, writeCheckpoint, interruptAfterSegments, maximumSegmentsThisProcess }) {
  const source = modules.identity.createV2SourceIdentity({ sourceId: `certified:${qualified.certificate.datasetId}`,
    provider: qualified.certificate.provider, requestedSymbol: qualified.certificate.requestedSymbol, brokerSymbol: qualified.certificate.brokerSymbol,
    sourceFingerprint: qualified.certificate.sourceFingerprint, sourceKind: "imported_historical" });
  const start = Date.parse(qualified.certificate.startUtc), end = Date.parse(qualified.certificate.endUtc), day = 86_400_000;
  const candidates = [...(checkpoint?.candidates ?? [])], seenFacts = new Set(checkpoint?.seenFactIds ?? []);
  let nextSegment = checkpoint?.nextSegment ?? 0;
  let processedThisProcess = 0;
  const segmentCount = Math.ceil((end - start) / day);
  for (; nextSegment < segmentCount; nextSegment += 1) {
    const segmentEnd = new Date(Math.min(end, start + (nextSegment + 1) * day)).toISOString();
    const segmentCandle = m5[Math.max(0, before(m5, segmentEnd) - 1)];
    if (!segmentCandle || segmentCandle.closeTimeUtc < qualified.certificate.startUtc) continue;
    const context = await buildCertifiedContext({ modules, source, m5, m15, asOf: segmentCandle.closeTimeUtc });
    if (context.diagnostics.status === "blocked") throw new Error(`Certified context blocked: ${context.diagnostics.blockers.join(", ")}`);
    const events = context.facts.filter((fact) => fact.kind === "fair_value_gap" && fact.payload.gapType === "fvg" &&
      fact.payload.state === "inverted" && fact.payload.inversionTime && fact.payload.preInversionUsage === "unused" &&
      fact.payload.inversionBarsAfterConfirmation <= 36 && !seenFacts.has(inversionEventKey(fact)));
    for (const event of events) {
      seenFacts.add(inversionEventKey(event));
      const exact = await buildCertifiedContext({ modules, source, m5, m15, asOf: event.causalClosedCandleTime });
      const triggerIndex = Math.max(0, before(m5, event.causalClosedCandleTime) - 1);
      const trigger = m5[triggerIndex];
      const expiresAt = new Date(Date.parse(event.causalClosedCandleTime) + 12 * 60_000).toISOString();
      const candidate = await modules.detector.detectLiquidityReclaimScalper({ context: exact,
        datasetCertificateId: qualified.certificate.certificateId, triggerCandleId: `${qualified.certificate.datasetId}:5m:${trigger.openTimeUtc}`,
        setupCreatedAt: event.causalClosedCandleTime, expiresAt });
      candidates.push(candidate);
    }
    const next = buildScanCheckpointCore({ nextSegment: nextSegment + 1, candidates, seenFactIds: [...seenFacts] });
    await writeCheckpoint(next);
    processedThisProcess += 1;
    if (interruptAfterSegments === nextSegment + 1 || processedThisProcess === maximumSegmentsThisProcess) {
      return bounded({ interrupted: true, reason: processedThisProcess === maximumSegmentsThisProcess ? "controlled_process_recycle" : "injected_interruption", checkpoint: next });
    }
    if (process.memoryUsage().rss > LRS_BASELINE_MAX_RSS_BYTES) throw new Error("LRS baseline exceeded the fixed 1 GiB RSS bound.");
  }
  return bounded({ interrupted: false, checkpoint: buildScanCheckpointCore({ nextSegment, candidates, seenFactIds: [...seenFacts] }) });
}

export const buildDescriptiveMetrics = (records) => {
  const exited = records.filter((item) => item.terminalState === "exited"), gross = exited.map((item) => item.grossR), net = exited.map((item) => item.netR);
  const wins = net.filter((value) => value > 0), losses = net.filter((value) => value <= 0);
  let equity = 0, peak = 0, maxDrawdownR = 0, winStreak = 0, lossStreak = 0, maxWinStreak = 0, maxLossStreak = 0;
  for (const value of net) { equity += value; peak = Math.max(peak, equity); maxDrawdownR = Math.max(maxDrawdownR, peak - equity);
    if (value > 0) { winStreak += 1; lossStreak = 0; } else { lossStreak += 1; winStreak = 0; }
    maxWinStreak = Math.max(maxWinStreak, winStreak); maxLossStreak = Math.max(maxLossStreak, lossStreak); }
  return bounded({ records: records.length, filled: records.filter((item) => item.fillPrice !== undefined).length,
    expiredUnfilled: records.filter((item) => item.terminalState === "expired_unfilled").length,
    ambiguous: records.filter((item) => item.terminalState === "ambiguous").length,
    insufficientData: records.filter((item) => item.terminalState === "insufficient_data").length,
    wins: wins.length, losses: losses.length, grossWinRate: exited.length ? gross.filter((v) => v > 0).length / exited.length : null,
    netWinRate: exited.length ? wins.length / exited.length : null, averageGrossR: gross.length ? gross.reduce((a, b) => a + b, 0) / gross.length : null,
    averageNetR: net.length ? net.reduce((a, b) => a + b, 0) / net.length : null, medianNetR: quantile(net, .5),
    expectancyNetR: net.length ? net.reduce((a, b) => a + b, 0) / net.length : null,
    profitFactor: losses.length ? wins.reduce((a, b) => a + b, 0) / Math.abs(losses.reduce((a, b) => a + b, 0)) : wins.length ? null : 0,
    maxDrawdownR, maxWinStreak, maxLossStreak });
};

const newYorkParts = (iso) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric",
  month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).map((item) => [item.type, item.value]));
const sessionFor = (iso) => { const hour = Number(newYorkParts(iso).hour); return hour < 3 ? "overnight" : hour < 8 ? "london" : hour < 12 ? "new_york_am" : hour < 16 ? "new_york_pm" : "after_hours"; };
const groupedMetrics = (items, keyFor) => Object.fromEntries([...new Set(items.map(keyFor))].sort().map((key) => [key,
  buildDescriptiveMetrics(items.filter((item) => keyFor(item) === key).map((item) => item.record))]));
export const buildBaselineBreakdowns = (items) => bounded({
  byDirection: groupedMetrics(items, (item) => item.opportunity.direction),
  bySession: groupedMetrics(items, (item) => sessionFor(item.opportunity.decisionAtUtc)),
  byMonth: groupedMetrics(items, (item) => item.opportunity.decisionAtUtc.slice(0, 7)),
  byYear: groupedMetrics(items, (item) => item.opportunity.decisionAtUtc.slice(0, 4))
});

const averageHoldMinutes = (records) => {
  const values = records.flatMap((record) => { const fill = record.transitions.find((item) => item.state === "filled");
    const terminal = record.transitions.find((item) => ["exited", "ambiguous", "blocked"].includes(item.state));
    return fill && terminal ? [(Date.parse(terminal.atUtc) - Date.parse(fill.atUtc)) / 60_000] : []; });
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
};

const directoryBytes = (root) => fs.existsSync(root) ? fs.readdirSync(root, { withFileTypes: true }).reduce((sum, entry) => {
  const file = path.join(root, entry.name); return sum + (entry.isDirectory() ? directoryBytes(file) : fs.statSync(file).size);
}, 0) : 0;

export async function runCertifiedBaseline(input) {
  const qualified = await verifyQualifiedInput(input);
  if (qualified.blockers.length) throw new Error(`Certified input rejected: ${qualified.blockers.join(", ")}`);
  const profile = await input.modules.parameters.buildLrsBaseProfile();
  if (profile.parameterHash !== input.expectedParameterHash || profile.researchValidated !== false || profile.productionAdoptionAllowed !== false) {
    throw new Error("Frozen LRS profile identity or authority mismatch.");
  }
  if (qualified.certificate.certificateId !== input.expectedCertificateId || qualified.certificate.datasetId !== input.expectedDatasetId ||
      qualified.certificate.startUtc !== "2024-08-01T00:00:00.000Z" || qualified.certificate.endUtc !== "2026-08-01T00:00:00.000Z") throw new Error("Frozen LRS baseline identity or coverage mismatch.");
  const manifest = qualified.manifest;
  const m5 = loadCertifiedTimeframe({ repositoryRoot: input.repositoryRoot, manifest, timeframe: "5m" });
  const m15 = loadCertifiedTimeframe({ repositoryRoot: input.repositoryRoot, manifest, timeframe: "15m" });
  const m1Index = buildCertifiedPartitionIndex({ repositoryRoot: input.repositoryRoot, manifest, timeframe: "1m" });
  const storage = createHistoricalDatasetNodeStorage({ root: input.outputRoot });
  const scanPath = "checkpoints/scan.json";
  const existingText = await storage.adapter.readText(scanPath);
  const writeCheckpoint = async (core) => storage.adapter.writeTextAtomic(scanPath, `${input.modules.canonical.canonicalSerialize({ ...core, checkpointId: await input.modules.canonical.canonicalHash(core) })}\n`);
  let scan;
  if (existingText) { scan = JSON.parse(existingText); const { checkpointId, ...core } = scan;
    if (await input.modules.canonical.canonicalHash(core) !== checkpointId) throw new Error("LRS scan checkpoint integrity failure."); }
  const discovery = await discoverCandidates({ modules: input.modules, qualified, m5, m15, checkpoint: scan, writeCheckpoint,
    interruptAfterSegments: input.interruptAfterSegments, maximumSegmentsThisProcess: input.maximumSegmentsThisProcess });
  if (discovery.interrupted) return discovery;
  const eligible = discovery.checkpoint.candidates.filter((item) => item.state === "ENTRY_ELIGIBLE" && item.blockers.length === 0);
  const simulationStorage = createHistoricalDatasetNodeStorage({ root: path.join(input.outputRoot, "bt2") });
  const repository = new input.modules.simulation.SimulationRepository(simulationStorage.adapter);
  const experimentId = await input.modules.canonical.canonicalHash({ schemaVersion: LRS_BASELINE_SCHEMA_VERSION,
    certificateId: qualified.certificate.certificateId, datasetId: qualified.certificate.datasetId, parameterHash: input.expectedParameterHash,
    candidateIds: eligible.map((item) => item.candidateId), intrabarPolicy: "conservative_stop_first_v1" });
  const costModel = await input.modules.simulation.buildSimulationCostModel({ version: "bt2-stage2-observed-spread-v1", pointSize: .01,
    spreadMode: "candle", slippagePoints: 0, commissionR: 0, swapR: 0 });
  const existing = await repository.readCheckpoint(experimentId), recordIds = [...(existing?.committedRecordIds ?? [])];
  for (let ordinal = existing?.nextOpportunityOrdinal ?? 0; ordinal < eligible.length; ordinal += 1) {
    const candidate = eligible[ordinal];
    const candles = readCertifiedForwardCandles({ repositoryRoot: input.repositoryRoot, index: m1Index,
      startUtc: candidate.entryEligibleAt, maximumCandles: LRS_BASELINE_MAX_FORWARD_CANDLES });
    const signal = m5[Math.max(0, before(m5, candidate.entryEligibleAt) - 1)]?.close;
    if (!Number.isFinite(signal)) throw new Error("Certified M1 future window is unavailable for an eligible candidate.");
    const opportunity = await input.modules.adapter.adaptLiquidityReclaimCandidateToBt2({ candidate, datasetId: qualified.certificate.datasetId,
      contextLineageRoot: qualified.certificate.lineageRoot, signalPrice: signal });
    const record = await input.modules.simulation.simulateTrade({ opportunity, candles, intrabarPolicy: "conservative_stop_first_v1", costModel });
    await repository.writeOpportunity(opportunity); await repository.writeRecord(record); recordIds.push(record.recordId);
    await repository.writeCheckpoint({ experimentId, nextOpportunityOrdinal: ordinal + 1, committedRecordIds: recordIds });
    if (input.interruptAfterRecords === ordinal + 1) return bounded({ interrupted: true, experimentId });
    if (process.memoryUsage().rss > LRS_BASELINE_MAX_RSS_BYTES) throw new Error("LRS baseline exceeded the fixed 1 GiB RSS bound.");
  }
  const records = recordIds.map((id) => readJson(simulationStorage.resolveSafe(`records/${safeId(id)}.json`)));
  const opportunities = records.map((record) => readJson(simulationStorage.resolveSafe(`opportunities/${safeId(record.opportunityId)}.json`)));
  const paired = records.map((record, index) => bounded({ record, opportunity: opportunities[index] }));
  const counts = Object.fromEntries(["exited", "expired_unfilled", "ambiguous", "insufficient_data", "blocked"].map((state) => [state, records.filter((item) => item.terminalState === state).length]));
  const seal = await input.modules.simulation.buildTradeLedgerSeal({ experimentId, datasetCertificateId: qualified.certificate.certificateId,
    orderedRecordIds: recordIds, outcomeCounts: counts, checkpointLineage: [], codeCommit: input.codeCommit });
  await repository.writeLedgerSeal(seal);
  const reportCore = bounded({ schemaVersion: LRS_BASELINE_SCHEMA_VERSION, status: counts.blocked ? "blocked" : "passed",
    strategyId: "liquidity_reclaim_scalper_v1", profileId: "liquidity_reclaim_scalper_v1_base_research", parameterHash: input.expectedParameterHash,
    certificateId: qualified.certificate.certificateId, datasetId: qualified.certificate.datasetId, startUtc: qualified.certificate.startUtc,
    endUtc: qualified.certificate.endUtc, setupCount: discovery.checkpoint.candidates.filter((item) => item.state !== "SEARCHING").length,
    candidateCount: discovery.checkpoint.candidates.length, eligibleCandidateCount: eligible.length,
    expiredSetupCount: discovery.checkpoint.candidates.filter((item) => ["SETUP_EXPIRED", "SESSION_EXPIRED"].includes(item.state)).length,
    tradeCount: records.length, filledTradeCount: records.filter((item) => item.fillPrice !== undefined).length,
    noFillCount: counts.expired_unfilled, ambiguousBarCount: counts.ambiguous,
    eligibleTradingDays: new Set(m5.map((candle) => candle.openTimeUtc.slice(0, 10))).size,
    metrics: bounded({ ...buildDescriptiveMetrics(records), averageHoldMinutes: averageHoldMinutes(records), tradesPerYear: records.length / 2 }),
    breakdowns: buildBaselineBreakdowns(paired), outcomeCounts: counts, experimentId, ledgerSealId: seal.ledgerSealId, costModelId: costModel.modelId,
    intrabarPolicy: "conservative_stop_first_v1", maximumForwardCandles: LRS_BASELINE_MAX_FORWARD_CANDLES,
    entryModel: profile.parameters.entryModel, stopModel: profile.parameters.stopModel, targetModel: profile.parameters.targetModel,
    researchValidated: false, productionAdoptionAllowed: false, rawCandlesSerialized: false, mt5Contacted: false,
    authority: LRS_BASELINE_AUTHORITY, peakRssBytes: process.memoryUsage().rss });
  const report = bounded({ ...reportCore, reportId: await input.modules.canonical.canonicalHash(reportCore) });
  await storage.adapter.writeTextAtomic("baseline-report.json", `${input.modules.canonical.canonicalSerialize(report)}\n`);
  const storageBytes = directoryBytes(input.outputRoot);
  if (storageBytes > LRS_BASELINE_MAX_STORAGE_BYTES) throw new Error("LRS baseline exceeded the fixed 128 MiB governed-storage bound.");
  return bounded({ interrupted: false, report, seal });
}
