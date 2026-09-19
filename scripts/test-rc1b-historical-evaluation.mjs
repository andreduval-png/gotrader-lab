#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";
import { bindExpandedPolicies, classifyScheduledObservations } from "./lib/p4-expanded-admission.mjs";
import { buildExpandedEvaluationProtocol } from "./lib/p4-expanded-evaluation-protocol.mjs";
import { dispatchHistoricalFold, reconcileHistoricalResults } from "./lib/p4-batch-dispatch.mjs";

const server = await createServer({ cacheDir: ".gotrader/p2-vite-cache", server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });

try {
  const historical = await server.ssrLoadModule("/src/lib/historicalGeometry/index.ts");
  const folds = await server.ssrLoadModule("/src/lib/historicalFold/index.ts");
  const { buildIctCanonicalRuntimeInput } = await server.ssrLoadModule("/src/lib/ictI2/ictI2Runtime.ts");
  const { selectCanonicalDrawOnLiquidity } = await server.ssrLoadModule("/src/lib/ictCanonical/canonicalSwingLiquidity.ts");
  const { evaluateIct2022Model } = await server.ssrLoadModule("/src/lib/ictI2/ict2022Model.ts");
  const { historicalClosedCandlesAt } = await server.ssrLoadModule("/src/lib/historicalFold/historicalClosedCandles.ts");
  const geometryApi = await server.ssrLoadModule("/src/lib/tradeGeometry/index.ts");
  const coverage = await server.ssrLoadModule("/src/lib/researchCoverage/canonicalResearchCoverageRegistry.ts");
  const compatibility = await server.ssrLoadModule("/src/lib/researchCoverage/evidenceCompatibility.ts");
  const { canonicalOwnerPerformancePolicyRegistry: policies } = await server.ssrLoadModule("/src/lib/ownerValidationPolicy/ownerPerformancePolicyRegistry.ts");
  const protocol = buildExpandedEvaluationProtocol();
  const adapters = folds.CANONICAL_HISTORICAL_FOLD_ADAPTERS;
  const binding = bindExpandedPolicies({ protocol, adapters, policies });
  assert.equal(binding.owners.length, 5);
  assert.equal(binding.fullEvaluationAllowed, false);
  assert.throws(() => bindExpandedPolicies({ protocol: { ...protocol, maximumWorkers: 2 }, adapters, policies }), /HASH_MISMATCH/);
  assert.throws(() => bindExpandedPolicies({ protocol, adapters: [...adapters, adapters[0]], policies }), /AMBIGUOUS/);
  assert.throws(() => bindExpandedPolicies({ protocol, adapters, policies: policies.slice(1) }), /AMBIGUOUS/);
  assert.throws(() => bindExpandedPolicies({ protocol, adapters,
    policies: policies.map((policy) => ({ ...policy, ownerStrategyVersion: "wrong" })) }), /POLICY_MISMATCH/);
  assert.deepEqual(classifyScheduledObservations(["a", "b"], [{ timestamp: "a" }]),
    [{ asOf: "a", status: "AVAILABLE" }, { asOf: "b", status: "UNAVAILABLE" }]);

  const owners = [
    "ifvg_fresh_retest_v3_research",
    "ict_2022_model_v1",
    "ict_market_maker_buy_model_v1",
    "ict_market_maker_sell_model_v1",
    "nasdaq_london_raid_ny_reversal_v1"
  ];
  assert.deepEqual(folds.CANONICAL_HISTORICAL_FOLD_ADAPTERS.map((item) => item.strategyId), owners);
  assert.deepEqual(historical.HISTORICAL_STRATEGY_ADAPTERS.filter((item) => item.classification !== "RESEARCH_ONLY").map((item) => item.strategyId), owners);
  assert.equal(folds.CANONICAL_HISTORICAL_FOLD_ADAPTERS.some((item) => /v4/i.test(item.strategyId)), false);
  assert.equal(historical.resolveHistoricalStrategyAdapter("ifvg_fresh_retest_v4_candidate").classification, "RESEARCH_ONLY");
  assert.equal(coverage.CANONICAL_LIVE_RESEARCH_OWNER_ORDER.length, 5);

  const evidenceFor = (strategyId, overrides = {}) => {
    const contract = coverage.findResearchCoverage(strategyId);
    return {
      strategyId,
      strategyVersion: contract.ownerStrategyVersion,
      researchProfileId: contract.researchProfileId,
      geometryPolicyId: contract.geometryPolicyId,
      geometryPolicyVersion: contract.geometryPolicyVersion,
      datasetFamily: contract.datasetRequirement.historicalDatasetFamily,
      datasetVersion: contract.datasetRequirement.historicalDatasetVersion,
      datasetCertificateId: contract.datasetRequirement.certificateId ?? "not-applicable",
      datasetChecksum: contract.datasetRequirement.datasetChecksum ?? "not-applicable",
      sourceFingerprint: contract.datasetRequirement.sourceFingerprint,
      parameterHash: contract.parameterIdentity,
      sessionPolicyVersion: contract.datasetRequirement.sessionPolicyVersion,
      evaluationTier: "HISTORICAL_VALIDATION",
      runId: `rc1b-${strategyId}`,
      asOfStart: "2025-01-02T14:00:00.000Z",
      asOfEnd: "2025-01-02T15:00:00.000Z",
      producerLineage: `rc1b-owner-authentic-${strategyId}`,
      ...overrides
    };
  };
  for (const strategyId of owners) {
    assert.equal(compatibility.evaluateResearchEvidenceCompatibility(evidenceFor(strategyId)).compatible, true);
  }
  assert.equal(compatibility.evaluateResearchEvidenceCompatibility(evidenceFor("ifvg_fresh_retest_v3_research", { strategyVersion: "v4" })).compatible, false);
  assert.equal(compatibility.evaluateResearchEvidenceCompatibility(evidenceFor("ict_market_maker_buy_model_v1", { producerLineage: "legacy-irl-erl-transition-injection" })).classification, "QUARANTINED");
  assert.equal(compatibility.evaluateResearchEvidenceCompatibility(evidenceFor("ict_market_maker_sell_model_v1", { producerLineage: "legacy-transition-injection" })).classification, "QUARANTINED");
  assert.equal(compatibility.evaluateResearchEvidenceCompatibility(evidenceFor("nasdaq_london_raid_ny_reversal_v1", { producerLineage: "legacy-rr-selected-target" })).classification, "INVALIDATED_BY_POLICY_CHANGE");

  const adapterSource = fs.readFileSync("src/lib/historicalFold/historicalFoldStrategyAdapters.ts", "utf8");
  assert.doesNotMatch(adapterSource, /IRL_ERL_TRANSITION|evaluateIrlErl|inject.*transition/i);
  assert.doesNotMatch(adapterSource, /SilverBullet|TurtleSoup|evaluateIctCisd/);
  assert.match(adapterSource, /geometry: assessment\.geometry/);
  assert.match(adapterSource, /geometry: candidate\.canonicalGeometry/);
  assert.match(adapterSource, /geometry: candidate\.geometry/);

  const londonSource = fs.readFileSync("src/lib/ict-strategy-suite/ictSessionRaidReversal.ts", "utf8");
  assert.doesNotMatch(londonSource, /find\(\(item\).*>= 2/);
  assert.doesNotMatch(londonSource, /sellSideLiquidityTargets\.at\(-1\)/);
  assert.match(londonSource, /selectLondonRaidPrimaryTarget/);
  const londonCoverage = coverage.findResearchCoverage("nasdaq_london_raid_ny_reversal_v1");
  assert.equal(londonCoverage.historicalValidationPolicy.status, "SUPPORTED");
  assert.equal(londonCoverage.geometryPolicyVersion, "2.0.0-nearest-native-objective");

  const certified = historical.BT_G1_1_CERTIFIED_DATASET;
  const first = "2025-01-02T14:00:00.000Z";
  const candle = (index, close = 100) => ({
    id: `rc1b-${index}`,
    symbol: "MNQ",
    timeframe: "5m",
    timestamp: new Date(Date.parse(first) + index * 300_000).toISOString(),
    open: close,
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume: 100
  });
  const candles = Array.from({ length: 8 }, (_, index) => candle(index, 100 + index * 0.1));
  assert.equal(historicalClosedCandlesAt(candles, "5m", first).length, 0);
  assert.equal(historicalClosedCandlesAt(candles, "5m", candles[1].timestamp).length, 1);
  assert.equal(historicalClosedCandlesAt(candles, "1h", candles[1].timestamp).length, 0);
  assert.equal(historicalClosedCandlesAt([{ ...candles[0], closeTimeUtc: candles[2].timestamp }], "5m", candles[1].timestamp).length, 0);
  assert.throws(() => historicalClosedCandlesAt([{ ...candles[0], closeTimeUtc: "invalid" }], "5m", candles[1].timestamp), /CLOSE_TIME_INVALID/);
  const metadata = new Map(folds.CANONICAL_HISTORICAL_FOLD_ADAPTERS.map((adapter) => [adapter.strategyId, adapter]));
  const prices = {
    ifvg_fresh_retest_v3_research: [100, 95, 110],
    ict_2022_model_v1: [100.5, 105, 89],
    ict_market_maker_buy_model_v1: [95, 90, 110],
    ict_market_maker_sell_model_v1: [105, 110, 90],
    nasdaq_london_raid_ny_reversal_v1: [100, 105, 89]
  };

  const buildGeometry = (strategyId, entry, stop, target, asOf = first) => {
    const adapter = metadata.get(strategyId);
    const direction = stop < entry ? "LONG" : "SHORT";
    const targetId = `${strategyId}:native-target`;
    return geometryApi.buildCanonicalTradeGeometry({
      strategyId,
      strategyVersion: adapter.strategyVersion,
      profileId: adapter.profileId,
      profileVersion: adapter.profileVersion,
      parameterHash: adapter.parameterHash,
      candidateId: `${strategyId}:fixture`,
      direction,
      entry: { model: "OWNER_NATIVE_ENTRY", intendedPrice: entry, validFrom: asOf, lifecycleStatus: "WAITING_FOR_ENTRY" },
      stop: { model: "OWNER_NATIVE_STOP", price: stop, structuralInvalidation: true },
      targetCandidates: [{ targetId, type: "EXTERNAL_LIQUIDITY", direction, price: target, consumed: false }],
      targetPolicy: {
        policyId: adapter.geometryPolicyId,
        policyVersion: adapter.geometryPolicyVersion,
        primaryTargetType: "EXTERNAL_LIQUIDITY",
        primaryTargetId: targetId,
        allowedFallbackTargetTypes: []
      },
      minimumRequiredRR: 2,
      sourceFingerprint: certified.sourceFingerprint,
      asOf,
      researchOnly: true
    });
  };

  const seals = {};
  for (const strategyId of owners) {
    const adapter = metadata.get(strategyId);
    const [entry, stop, target] = prices[strategyId];
    const geometry = buildGeometry(strategyId, entry, stop, target);
    const adapted = historical.adaptCanonicalStrategyGeometryForHistorical({
      geometry,
      sourceFingerprint: certified.sourceFingerprint,
      datasetId: certified.datasetId,
      datasetCertificateId: certified.certificateId,
      costModelId: "rc1b.zero-cost.v1",
      fillModelId: "rc1b.causal-retrace.v1",
      sessionPolicyId: adapter.sessionPolicyId,
      asOf: first
    });
    assert.equal(adapted.envelope.strategyId, strategyId);
    assert.equal(adapted.envelope.intendedEntry, entry);
    assert.equal(adapted.envelope.intendedStop, stop);
    assert.equal(adapted.envelope.intendedTarget, target);
    assert.equal(adapted.envelope.geometryPolicyVersion, adapter.geometryPolicyVersion);
    assert.equal(adapted.envelope.sessionPolicyId, adapter.sessionPolicyId);
    assert.deepEqual(adapted.envelope.blockers, geometry.blockers);

    const pilotAdapter = {
      ...adapter,
      requiredTimeframes: ["5m"],
      detect: (context) => {
        const live = buildIctCanonicalRuntimeInput({
          candlesByTimeframe: context.candlesByTimeframe,
          symbol: "MNQ", asOf: context.asOf,
          sourceFingerprint: context.sourceFingerprint
        });
        assert.deepEqual(context.canonicalFacts, live.facts, "historical context must include live draw and session facts");
        assert.deepEqual(context.narrative, live.narrative);
        assert.ok(context.narrative, "runner must build the canonical narrative");
        assert.equal(context.narrative.policyId, "gotrader.ict.c1-1.hierarchical-roles.v1");
        assert.ok(context.candlesByTimeframe["5m"].every((bar) =>
          Date.parse(bar.timestamp) + 300_000 <= Date.parse(context.asOf)));
        return { candidateId: geometry.candidateId, status: geometry.status, geometry, blockers: geometry.blockers };
      }
    };
    const input = {
      fold: {
        experimentFamilyId: "rc1b-bounded-certified-pilot",
        trialId: `rc1b-${strategyId}`,
        foldId: "pilot-1",
        partition: "validation",
        run: { startInclusive: first, endExclusive: new Date(Date.parse(first) + 4 * 300_000).toISOString() }
      },
      configurationId: "rc1b-parity-only",
      adapter: pilotAdapter,
      dataset: {
        datasetId: certified.datasetId,
        datasetCertificateId: certified.certificateId,
        datasetChecksum: certified.datasetChecksum,
        sourceFingerprint: certified.sourceFingerprint
      },
      candlesByTimeframe: { "5m": candles },
      primaryTimeframe: "5m",
      costModelId: "rc1b.zero-cost.v1",
      fillModelId: "rc1b.causal-retrace.v1",
      tickSize: 0.25,
      spreadTicks: 0,
      slippageTicks: 0,
      commissionTicks: 0,
      maxBarsToResolveTrade: 3,
      checkpointEvery: 2
    };
    const checkpoints = [];
    if (strategyId === "ict_2022_model_v1") {
      const shaped = [100, 101, 110, 102, 100, 90, 99, 100].map((price, index) => candle(index, price));
      const asOf = new Date(Date.parse(first) + shaped.length * 300_000).toISOString();
      const narrative = {
        ...buildIctCanonicalRuntimeInput({ candlesByTimeframe: {}, symbol: "MNQ", asOf,
          sourceFingerprint: certified.sourceFingerprint }).narrative,
        structural: "bullish", intermediate: "bullish", execution: "bullish", liquidityPath: "buyside"
      };
      const expected = buildIctCanonicalRuntimeInput({ candlesByTimeframe: { "5m": shaped },
        symbol: "MNQ", asOf, sourceFingerprint: certified.sourceFingerprint, narrative });
      assert.ok(expected.facts.some((fact) => fact.factType === "DRAW_ON_LIQUIDITY"));
      const diagnosticRun = folds.runCanonicalHistoricalFold({
        ...input, candlesByTimeframe: { "5m": shaped }, evaluationTimes: [asOf],
        narrativeAt: () => narrative,
        fold: { ...input.fold, run: { startInclusive: first,
          endExclusive: new Date(Date.parse(asOf) + 300_000).toISOString() } },
        adapter: { ...pilotAdapter, detect: (context) => {
          assert.deepEqual(context.canonicalFacts, expected.facts);
          assert.deepEqual(context.narrative, narrative);
          return { candidateId: "context-parity", status: "SEARCHING", blockers: [] };
        } }
      });
      assert.equal(diagnosticRun.detections[0].contextDiagnostics.factCounts.DRAW_ON_LIQUIDITY, 1);
      assert.equal(diagnosticRun.detections[0].contextDiagnostics.draws.length, 1);
      assert.equal(diagnosticRun.detections[0].contextDiagnostics.draws[0].consumed, false);
      const empty = buildIctCanonicalRuntimeInput({ candlesByTimeframe: {}, symbol: "MNQ", asOf,
        sourceFingerprint: certified.sourceFingerprint, narrative });
      assert.equal(empty.facts.some((fact) => fact.factType === "DRAW_ON_LIQUIDITY"), false);
      assert.ok(evaluateIct2022Model(empty).blockers.includes("primary_external_draw_missing"));
      const liquidity = expected.facts.filter((fact) => fact.factType === "LIQUIDITY");
      assert.equal(selectCanonicalDrawOnLiquidity({
        liquidity: liquidity.map((fact) => ({ ...fact, status: "CONSUMED" })),
        currentPrice: 100, direction: "bullish", asOf, sourceFingerprint: certified.sourceFingerprint
      }), undefined);
      assert.ok(evaluateIct2022Model({ ...expected,
        facts: expected.facts.filter((fact) => fact.factType !== "DRAW_ON_LIQUIDITY")
      }).blockers.includes("primary_external_draw_missing"));
    }
    for (const invalid of [
      [candles[0], candles[0]],
      [...candles].reverse(),
      candles.map((bar, index) => index ? bar : { ...bar, high: bar.low - 1 }),
      candles.map((bar, index) => index ? bar : { ...bar, close: NaN }),
      candles.map((bar, index) => index ? bar : { ...bar, timeframe: "1h" }),
      candles.map((bar, index) => index ? bar : { ...bar, volume: -1 }),
      candles.map((bar, index) => index ? bar : { ...bar, symbol: "OTHER" })
    ]) {
      assert.throws(() => folds.runCanonicalHistoricalFold({
        ...input, candlesByTimeframe: { "5m": invalid }
      }), /CANDLE_INTEGRITY/);
    }
    const fresh = folds.runCanonicalHistoricalFold({ ...input, onCheckpoint: (value) => checkpoints.push(value) });
    const repeated = folds.runCanonicalHistoricalFold(input);
    const futureChanged = folds.runCanonicalHistoricalFold({
      ...input, candlesByTimeframe: { "5m": candles.map((bar, index) => index < 4 ? bar :
        { ...bar, open: 900, high: 1000, low: 800, close: 950 }) }
    });
    assert.deepEqual(futureChanged.detections, fresh.detections);
    assert.ok(fresh.detections.every((record) => record.narrativeIdentity && record.narrative));
    const resumed = folds.runCanonicalHistoricalFold({ ...input, resumeFrom: checkpoints[0] });
    let interruptedCheckpoint;
    assert.throws(() => folds.runCanonicalHistoricalFold({ ...input, onCheckpoint: (checkpoint) => {
      interruptedCheckpoint = checkpoint;
      throw new Error("TEST_PROCESS_INTERRUPTION");
    } }), /TEST_PROCESS_INTERRUPTION/);
    const recovered = folds.runCanonicalHistoricalFold({ ...input,
      resumeFrom: JSON.parse(JSON.stringify(interruptedCheckpoint)) });
    assert.equal(recovered.resultIdentityHash, fresh.resultIdentityHash);
    assert.deepEqual(recovered.outcomes, fresh.outcomes);
    assert.deepEqual(recovered.geometryEnvelopes, fresh.geometryEnvelopes);
    assert.equal(fresh.resultIdentityHash, repeated.resultIdentityHash);
    assert.equal(fresh.resultIdentityHash, resumed.resultIdentityHash);
    const batchInput = { ...input, evaluationTimes: candles.slice(0, 4).map((bar) => bar.timestamp) };
    const directory = fs.mkdtempSync(".gotrader/batch-fixture-");
    const dispatch = { directory, input: batchInput, binding: { foldIdentity: fresh.foldIdentityHash },
      runFold: folds.runCanonicalHistoricalFold, batchSize: 1 };
    const partial = dispatchHistoricalFold({ ...dispatch, maxBatches: 1 });
    assert.equal(partial.status, "CHECKPOINTED");
    assert.equal(partial.nextPosition, 1);
    assert.throws(() => dispatchHistoricalFold({ ...dispatch, binding: { foldIdentity: "foreign" } }), /IDENTITY_MISMATCH/);
    const batched = dispatchHistoricalFold(dispatch);
    assert.equal(batched.status, "COMPLETED");
    assert.equal(batched.result.resultIdentityHash, fresh.resultIdentityHash);
    assert.equal(batched.result.geometryEnvelopes.length, 1, "cross-batch repeat must not duplicate geometry");
    assert.deepEqual(batched.result.outcomes, fresh.outcomes);
    const report = reconcileHistoricalResults({ results: [batched.result], expectedOwners: [strategyId],
      expectedSchedule: batchInput.evaluationTimes });
    assert.equal(report.totalEvaluated, 4);
    assert.throws(() => reconcileHistoricalResults({ results: [batched.result, batched.result],
      expectedOwners: [strategyId], expectedSchedule: batchInput.evaluationTimes }), /OWNER_COVERAGE/);
    const forged = structuredClone(batched.result);
    forged.counts.fills += 1;
    assert.throws(() => reconcileHistoricalResults({ results: [forged], expectedOwners: [strategyId],
      expectedSchedule: batchInput.evaluationTimes }), /RECONCILIATION_FAILED/);
    fs.writeFileSync(`${directory}/dispatch.lock`, JSON.stringify({ token: "foreign", pid: 0 }));
    assert.throws(() => dispatchHistoricalFold(dispatch), /EEXIST/);
    fs.unlinkSync(`${directory}/dispatch.lock`);
    const state = JSON.parse(fs.readFileSync(`${directory}/state.json`, "utf8"));
    state.checkpoint.nextPosition = 0;
    fs.writeFileSync(`${directory}/state.json`, JSON.stringify(state));
    assert.throws(() => dispatchHistoricalFold(dispatch), /IDENTITY_MISMATCH/);
    assert.throws(() => folds.runCanonicalHistoricalFold({ ...input, evaluationTimes: [first], resumeFrom: checkpoints[0] }), /RESTART/);
    const changedCandles = candles.map((bar, index) => index === 0 ? { ...bar, volume: bar.volume + 1 } : bar);
    assert.throws(() => folds.runCanonicalHistoricalFold({ ...input, candlesByTimeframe: { "5m": changedCandles }, resumeFrom: checkpoints[0] }), /RESTART/);
    const altered = structuredClone(checkpoints[0]);
    altered.detections[0].status = "tampered";
    assert.throws(() => folds.runCanonicalHistoricalFold({ ...input, resumeFrom: altered }), /CHECKPOINT/);
    assert.throws(() => folds.runCanonicalHistoricalFold({ ...input, resumeFrom: { ...checkpoints[0], nextPosition: -1 } }), /CHECKPOINT/);
    assert.ok(fresh.outcomes.every((outcome) => Date.parse(outcome.resolvedAt) < Date.parse(input.fold.run.endExclusive)));
    if (!fresh.counts.completedTrades) assert.equal(fresh.metrics.averageNetR, null);
    assert.equal(fresh.counts.evaluated, 4);
    assert.equal(fresh.counts.candidates, 1);
    const noGeometry = folds.runCanonicalHistoricalFold({
      ...input,
      adapter: { ...pilotAdapter, detect: () => ({
        candidateId: "dependency-only", status: "NARRATIVE_DEPENDENCY_UNAVAILABLE", blockers: ["missing narrative"]
      }) }
    });
    assert.equal(noGeometry.counts.evaluated, 4);
    assert.equal(noGeometry.counts.candidates, 0);
    const invalidGeometry = { ...geometry, geometryValid: false, actionable: false,
      status: "INVALID_GEOMETRY", target: undefined, theoreticalRR: undefined };
    const invalidInput = { ...input, adapter: { ...pilotAdapter, detect: () => ({
      candidateId: geometry.candidateId, status: "REJECTED", geometry: invalidGeometry,
      blockers: ["STOP_DISTANCE_TOO_SMALL"]
    }) } };
    const rejected = folds.runCanonicalHistoricalFold(invalidInput);
    assert.equal(rejected.geometryEnvelopes.length, 0);
    assert.equal(rejected.counts.geometryComplete, 0);
    assert.equal(rejected.counts.fills, 0);
    assert.equal(rejected.counts.candidates, 1);
    assert.ok(rejected.detections.every((item) => item.blockers.includes("STOP_DISTANCE_TOO_SMALL")));
    assert.throws(() => folds.runCanonicalHistoricalFold({ ...invalidInput,
      adapter: { ...pilotAdapter, detect: () => ({ candidateId: geometry.candidateId,
        status: "invalid", geometry: { ...invalidGeometry, actionable: true }, blockers: [] }) }
    }), /INVALID_ACTIONABLE_GEOMETRY/);
    assert.equal(fresh.geometryEnvelopes.length, 1);
    assert.equal(fresh.researchValidated, false);
    assert.equal(checkpoints[0].identity.strategyId, strategyId);
    assert.equal(checkpoints[0].identity.datasetCertificateId, certified.certificateId);
    seals[strategyId] = fresh.resultIdentityHash;
  }

  assert.equal(Object.hasOwn(seals, "ifvg_fresh_retest_v4_candidate"), false);
  assert.throws(() => historical.assertBtG11CertifiedDatasetBinding({
    certificateId: "wrong",
    datasetId: certified.datasetId,
    datasetChecksum: certified.datasetChecksum
  }), /IDENTITY_MISMATCH/);

  console.log(JSON.stringify({ status: "passed", owners, seals, londonPolicy: "parity_verified_nearest_native_objective_v2" }, null, 2));
} finally {
  await server.close();
}
