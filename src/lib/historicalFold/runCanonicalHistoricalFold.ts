import { scoreCanonicalHistoricalGeometryWithBt2 } from "@/lib/backtesting/canonicalBt2FoldScoring";
import { canonicalFingerprint, causalCandlesAt } from "@/lib/ictCanonical/canonicalIctIdentity";
import { buildCanonicalIctFactSnapshot } from "@/lib/ictCanonical/canonicalFactBuilder";
import { BT_G1_1_CERTIFIED_DATASET, adaptCanonicalStrategyGeometryForHistorical } from "@/lib/historicalGeometry";
import type { Candle, Timeframe } from "@/lib/types";
import { TRADE_GEOMETRY_VERSION } from "@/lib/tradeGeometry";
import type {
  CanonicalHistoricalFoldResult,
  HistoricalFoldCheckpoint,
  HistoricalFoldInterval,
  RunCanonicalHistoricalFoldInput
} from "./historicalFoldTypes";

const parse = (value: string) => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`HISTORICAL_FOLD_INVALID_TIME: ${value}`);
  return timestamp;
};
const inInterval = (value: string, interval: HistoricalFoldInterval) =>
  parse(value) >= parse(interval.startInclusive) && parse(value) < parse(interval.endExclusive);
const round = (value: number, digits = 6) => Number(value.toFixed(digits));

const assertPartitionSeparation = (input: RunCanonicalHistoricalFoldInput) => {
  const intervals = [input.fold.train, input.fold.validation, input.fold.oos].filter(Boolean) as HistoricalFoldInterval[];
  for (const interval of [input.fold.run, ...intervals]) {
    if (parse(interval.startInclusive) >= parse(interval.endExclusive)) throw new Error("HISTORICAL_FOLD_INVALID_INTERVAL");
  }
  const partition = input.fold[input.fold.partition];
  if (partition && (parse(input.fold.run.startInclusive) < parse(partition.startInclusive) ||
    parse(input.fold.run.endExclusive) > parse(partition.endExclusive))) {
    throw new Error("HISTORICAL_FOLD_RUN_OUTSIDE_PARTITION");
  }
  const sorted = [...intervals].sort((left, right) => parse(left.startInclusive) - parse(right.startInclusive));
  for (let index = 1; index < sorted.length; index += 1) {
    if (parse(sorted[index - 1].endExclusive) > parse(sorted[index].startInclusive)) {
      throw new Error("HISTORICAL_FOLD_PARTITION_OVERLAP");
    }
  }
  const certifiedStart = parse(BT_G1_1_CERTIFIED_DATASET.startUtc);
  const certifiedEnd = parse(BT_G1_1_CERTIFIED_DATASET.endUtc);
  for (const interval of [input.fold.run, ...intervals]) {
    if (parse(interval.startInclusive) < certifiedStart || parse(interval.endExclusive) > certifiedEnd) {
      throw new Error("HISTORICAL_FOLD_INTERVAL_OUTSIDE_CERTIFIED_DATASET");
    }
  }
};

const evaluationSchedule = (input: RunCanonicalHistoricalFoldInput) =>
  [...new Set((input.evaluationTimes ?? (input.candlesByTimeframe[input.primaryTimeframe] ?? []).map((bar) => bar.timestamp))
    .map((timestamp) => new Date(parse(timestamp)).toISOString()))]
    .filter((timestamp) => inInterval(timestamp, input.fold.run))
    .sort((left, right) => parse(left) - parse(right));

const foldIdentity = (input: RunCanonicalHistoricalFoldInput) => canonicalFingerprint({
  schema: "gotrader.historical-fold-identity.v2",
  scoringVersion: "gotrader.bt2.canonical-fold-scoring.v2",
  candleContent: canonicalFingerprint(input.candlesByTimeframe),
  evaluationSchedule: evaluationSchedule(input),
  narratives: evaluationSchedule(input).map((asOf) => input.narrativeAt?.(asOf) ?? null),
  fold: input.fold,
  configurationId: input.configurationId,
  adapterId: input.adapter.adapterId,
  adapterVersion: input.adapter.adapterVersion,
  strategyId: input.adapter.strategyId,
  strategyVersion: input.adapter.strategyVersion,
  profileId: input.adapter.profileId,
  profileVersion: input.adapter.profileVersion,
  parameterHash: input.adapter.parameterHash,
  geometryPolicyId: input.adapter.geometryPolicyId,
  geometryPolicyVersion: input.adapter.geometryPolicyVersion,
  sessionPolicyId: input.adapter.sessionPolicyId,
  dataset: input.dataset,
  costModelId: input.costModelId,
  fillModelId: input.fillModelId,
  executionPolicy: {
    primaryTimeframe: input.primaryTimeframe,
    tickSize: input.tickSize,
    spreadTicks: input.spreadTicks,
    slippageTicks: input.slippageTicks,
    commissionTicks: input.commissionTicks,
    maxBarsToResolveTrade: input.maxBarsToResolveTrade,
    randomSeed: input.randomSeed ?? null
  }
});

export const runCanonicalHistoricalFold = (input: RunCanonicalHistoricalFoldInput): CanonicalHistoricalFoldResult => {
  assertPartitionSeparation(input);
  for (const [timeframe, candles] of Object.entries(input.candlesByTimeframe)) {
    let previous = Number.NEGATIVE_INFINITY;
    let symbol: string | undefined;
    for (const candle of candles ?? []) {
      const timestamp = parse(candle.timestamp);
      if (timestamp <= previous || candle.timeframe !== timeframe || !candle.symbol ||
        (symbol !== undefined && candle.symbol !== symbol) ||
        ![candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) ||
        candle.high < Math.max(candle.open, candle.close) ||
        candle.low > Math.min(candle.open, candle.close) || candle.high < candle.low ||
        (candle.volume !== undefined && (!Number.isFinite(candle.volume) || candle.volume < 0))) {
        throw new Error("HISTORICAL_FOLD_CANDLE_INTEGRITY_INVALID");
      }
      previous = timestamp;
      symbol = candle.symbol;
    }
  }
  if (!input.candlesByTimeframe[input.primaryTimeframe]?.length) {
    throw new Error("HISTORICAL_FOLD_PRIMARY_TIMEFRAME_MISSING");
  }
  if (
    input.dataset.datasetId !== BT_G1_1_CERTIFIED_DATASET.datasetId ||
    input.dataset.datasetCertificateId !== BT_G1_1_CERTIFIED_DATASET.certificateId ||
    input.dataset.datasetChecksum !== BT_G1_1_CERTIFIED_DATASET.datasetChecksum ||
    input.dataset.sourceFingerprint !== BT_G1_1_CERTIFIED_DATASET.sourceFingerprint
  ) throw new Error("CERTIFIED_HISTORICAL_DATASET_IDENTITY_MISMATCH");
  if (input.adapter.classification === "SOURCE_BLOCKED" || input.adapter.classification === "FOLD_RUNNER_ADAPTER_REQUIRED") {
    throw new Error(`HISTORICAL_FOLD_NOT_ADMITTED: ${input.adapter.classification}`);
  }
  for (const timeframe of input.adapter.requiredTimeframes) {
    if (!(input.candlesByTimeframe[timeframe]?.length)) throw new Error(`HISTORICAL_FOLD_REQUIRED_TIMEFRAME_MISSING: ${timeframe}`);
  }

  const evaluationTimes = evaluationSchedule(input);
  const narratives = new Map(evaluationTimes.map((asOf) => [asOf, structuredClone(input.narrativeAt?.(asOf))]));
  input = { ...input, narrativeAt: (asOf) => narratives.get(asOf) };
  const identityHash = foldIdentity(input);
  if (input.resumeFrom && input.resumeFrom.foldIdentityHash !== identityHash) {
    throw new Error("HISTORICAL_FOLD_RESTART_IDENTITY_MISMATCH");
  }
  if (input.resumeFrom) {
    const { checkpointHash, ...body } = input.resumeFrom;
    const position = body.nextPosition;
    if (body.schemaVersion !== "gotrader.historical-fold-checkpoint.v2" ||
      checkpointHash !== canonicalFingerprint(body) ||
      !Number.isSafeInteger(position) || position < 0 || position > evaluationTimes.length ||
      body.detections.length !== position ||
      canonicalFingerprint(body.processedAsOf) !== canonicalFingerprint(evaluationTimes.slice(0, position)) ||
      body.detections.some((detection, index) => detection.asOf !== evaluationTimes[index])) {
      throw new Error("HISTORICAL_FOLD_CHECKPOINT_INVALID");
    }
    input = { ...input, resumeFrom: structuredClone(input.resumeFrom) };
  }
  const primary = [...(input.candlesByTimeframe[input.primaryTimeframe] ?? [])]
    .filter((candle) => inInterval(candle.timestamp, input.fold.run))
    .sort((left, right) => parse(left.timestamp) - parse(right.timestamp));
  const detections = [...(input.resumeFrom?.detections ?? [])];
  const outcomes = [...(input.resumeFrom?.outcomes ?? [])];
  const geometryEnvelopes: CanonicalHistoricalFoldResult["geometryEnvelopes"] = [
    ...(input.resumeFrom?.geometryEnvelopes ?? [])
  ];
  const seenGeometry = new Set([
    ...geometryEnvelopes.map((envelope) => envelope.geometryId),
    ...outcomes.map((outcome) => outcome.geometryId)
  ]);
  const startPosition = input.resumeFrom?.nextPosition ?? 0;

  for (let position = startPosition; position < evaluationTimes.length; position += 1) {
    const asOf = evaluationTimes[position];
    const causalByTimeframe = Object.fromEntries(Object.entries(input.candlesByTimeframe).map(([timeframe, candles]) => [
      timeframe,
      causalCandlesAt(candles ?? [], asOf)
    ])) as Partial<Record<Timeframe, Candle[]>>;
    const factSnapshots = Object.entries(causalByTimeframe).flatMap(([timeframe, candles]) => {
      if (!candles?.length) return [];
      return buildCanonicalIctFactSnapshot({
        candles,
        asOf,
        symbol: candles[0].symbol,
        timeframe: timeframe as Timeframe,
        sourceFingerprint: input.dataset.sourceFingerprint
      }).facts;
    });
    const detection = input.adapter.detect({
      asOf,
      sourceFingerprint: input.dataset.sourceFingerprint,
      candlesByTimeframe: causalByTimeframe,
      canonicalFacts: factSnapshots,
      narrative: input.narrativeAt?.(asOf),
      dataset: input.dataset
    });
    detections.push({
      asOf,
      candidateId: detection.candidateId,
      status: detection.status,
      geometryId: detection.geometry?.geometryId,
      geometryStatus: detection.geometry?.status,
      blockers: [...detection.blockers],
      entryMissed: detection.entryMissed === true,
      targetConsumed: detection.targetConsumed === true
    });
    if (detection.geometry && !seenGeometry.has(detection.geometry.geometryId)) {
      const envelope = adaptCanonicalStrategyGeometryForHistorical({
        geometry: detection.geometry,
        sourceFingerprint: input.dataset.sourceFingerprint,
        datasetId: input.dataset.datasetId,
        datasetCertificateId: input.dataset.datasetCertificateId,
        costModelId: input.costModelId,
        fillModelId: input.fillModelId,
        sessionPolicyId: input.adapter.sessionPolicyId,
        asOf
      }).envelope;
      geometryEnvelopes.push(envelope);
      seenGeometry.add(envelope.geometryId);
      if (envelope.geometryStatus === "VALID_ACTIONABLE" && envelope.actionable) {
        const decisionIndex = primary.findIndex((candle) => parse(candle.timestamp) === parse(asOf));
        if (decisionIndex >= 0) outcomes.push(scoreCanonicalHistoricalGeometryWithBt2({
          geometry: envelope,
          candles: primary,
          decisionIndex,
          maxBarsToResolveTrade: input.maxBarsToResolveTrade,
          tickSize: input.tickSize,
          spreadTicks: input.spreadTicks,
          slippageTicks: input.slippageTicks,
          commissionTicks: input.commissionTicks
        }));
      }
    }
    const checkpointEvery = Math.max(1, input.checkpointEvery ?? 50);
    if ((position + 1) % checkpointEvery === 0 || position === evaluationTimes.length - 1) {
      const checkpoint: Omit<HistoricalFoldCheckpoint, "checkpointHash"> = {
        schemaVersion: "gotrader.historical-fold-checkpoint.v2",
        foldIdentityHash: identityHash,
        identity: {
          strategyId: input.adapter.strategyId,
          strategyVersion: input.adapter.strategyVersion,
          adapterId: input.adapter.adapterId,
          adapterVersion: input.adapter.adapterVersion,
          geometryPolicyId: input.adapter.geometryPolicyId,
          geometryPolicyVersion: input.adapter.geometryPolicyVersion,
          sessionPolicyId: input.adapter.sessionPolicyId,
          parameterHash: input.adapter.parameterHash,
          datasetId: input.dataset.datasetId,
          datasetCertificateId: input.dataset.datasetCertificateId,
          sourceFingerprint: input.dataset.sourceFingerprint,
          partition: input.fold.partition,
          range: input.fold.run
        },
        nextPosition: position + 1,
        processedAsOf: evaluationTimes.slice(0, position + 1),
        detections: [...detections],
        outcomes: [...outcomes],
        geometryEnvelopes: [...geometryEnvelopes]
      };
      input.onCheckpoint?.(structuredClone({ ...checkpoint, checkpointHash: canonicalFingerprint(checkpoint) }));
    }
  }

  const completeGeometry = detections.filter((item) => item.geometryId);
  const actionableGeometry = geometryEnvelopes.filter((item) => item.actionable && item.geometryStatus === "VALID_ACTIONABLE");
  const belowRR = detections.filter((item) => item.geometryStatus === "VALID_BELOW_RR_THRESHOLD").length;
  const wins = outcomes.filter((item) => item.outcome === "target_hit").length;
  const losses = outcomes.filter((item) => item.outcome === "stop_hit").length;
  const resolved = outcomes.filter((item) => item.entryIndex !== undefined &&
    (item.outcome === "target_hit" || item.outcome === "stop_hit"));
  const unresolved = outcomes.filter((item) => item.entryIndex !== undefined && item.outcome === "expired").length;
  const netRealizedR = resolved.reduce((sum, item) => sum + item.realizedR, 0);
  const grossRealizedR = resolved.reduce(
    (sum, item) => sum + item.realizedR + (item.entryIndex === undefined ? 0 : item.costR),
    0
  );
  const base: Omit<CanonicalHistoricalFoldResult, "resultIdentityHash"> = {
    schemaVersion: "gotrader.canonical-historical-fold-result.v2",
    foldIdentityHash: identityHash,
    runnerId: "gotrader.canonical-historical-fold-runner",
    runnerVersion: "2.0.0",
    bt2Version: "gotrader.bt2.canonical-fold-scoring.v2",
    canonicalGeometryVersion: TRADE_GEOMETRY_VERSION,
    experimentFamilyId: input.fold.experimentFamilyId,
    configurationId: input.configurationId,
    trialId: input.fold.trialId,
    foldId: input.fold.foldId,
    partition: input.fold.partition,
    strategyId: input.adapter.strategyId,
    strategyVersion: input.adapter.strategyVersion,
    profileId: input.adapter.profileId,
    profileVersion: input.adapter.profileVersion,
    parameterHash: input.adapter.parameterHash,
    geometryPolicyId: input.adapter.geometryPolicyId,
    geometryPolicyVersion: input.adapter.geometryPolicyVersion,
    sessionPolicyId: input.adapter.sessionPolicyId,
    datasetId: input.dataset.datasetId,
    datasetCertificateId: input.dataset.datasetCertificateId,
    datasetChecksum: input.dataset.datasetChecksum,
    sourceFingerprint: input.dataset.sourceFingerprint,
    proxyNotice: "Historical source is USTECH proxy research data for MNQ-style research. It is not CME MNQ futures truth.",
    costModelId: input.costModelId,
    fillModelId: input.fillModelId,
    randomSeed: input.randomSeed,
    runInterval: input.fold.run,
    classification: input.adapter.classification,
    counts: {
      evaluated: evaluationTimes.length,
      candidates: new Set(detections.filter((item) => item.geometryId).map((item) => item.candidateId)).size,
      geometryComplete: completeGeometry.length,
      sourceBlocked: detections.filter((item) => /source.block/i.test(item.status) || item.blockers.some((blocker) => /source.block/i.test(blocker))).length,
      belowRR,
      entryMissed: detections.filter((item) => item.entryMissed).length,
      entryNotRetraced: outcomes.filter((item) => item.outcome === "entry_not_retraced").length,
      targetConsumed: detections.filter((item) => item.targetConsumed).length,
      expired: outcomes.filter((item) => item.outcome === "expired").length,
      eligible: actionableGeometry.length,
      fillAttempted: outcomes.length,
      fills: outcomes.filter((item) => item.entryIndex !== undefined).length,
      completedTrades: wins + losses
    },
    metrics: {
      wins,
      losses,
      unresolved,
      grossRealizedR: round(grossRealizedR),
      netRealizedR: round(netRealizedR),
      averageNetR: resolved.length ? round(netRealizedR / resolved.length) : null,
      winRate: wins + losses ? round(wins / (wins + losses)) : null
    },
    detections,
    outcomes,
    geometryEnvelopes,
    researchValidated: false,
    authority: {
      executionAuthority: "none",
      brokerAuthority: "none",
      readinessOverrideAuthority: "none",
      canPromote: false
    }
  };
  return {
    ...base,
    resultIdentityHash: canonicalFingerprint(base)
  };
};

export const historicalFoldIdentityHash = foldIdentity;
