import { V2_AUTHORITY_NONE, assertV2Authority } from "../authority/v2Authority";
import { canonicalHash } from "../serialization/canonicalSerialization";
import {
  V2_CONTEXT_COMPATIBILITY_POLICY_VERSION,
  V2_CONTEXT_COMPATIBILITY_SCHEMA_VERSION,
  type V2ContextCompatibilityEntry,
  type V2ContextCompatibilityMetric,
  type V2ContextCompatibilityMetricValue,
  type V2ContextCompatibilityReport,
  type V2ContextCompatibilityRequest,
  type V2ContextFactSummary,
  type V2LegacyContextObservation
} from "./v2ContextCompatibilityTypes";
import type {
  V2CanonicalMarketState,
  V2ContextFactFamily,
  V2MarketFact
} from "./v2ContextTypes";

export const V2_CONTEXT_REVIEWED_VARIANCE_POLICIES = Object.freeze({
  dealing_range: "legacy_full_window_vs_v2_session_scoped_range_v1",
  liquidity: "legacy_swing_selection_vs_v2_session_pool_lifecycle_v1",
  displacement: "legacy_latest_match_vs_v2_causal_fact_set_v1",
  fair_value_gap: "legacy_selected_pd_array_vs_v2_gap_lifecycle_v1",
  higher_timeframe_bias: "legacy_full_window_vs_v2_explicit_last_five_v1"
} as const);

const FACT_FAMILIES = Object.freeze([
  "session",
  "opening_price",
  "dealing_range",
  "liquidity",
  "displacement",
  "fair_value_gap",
  "higher_timeframe_bias"
] as const satisfies readonly V2ContextFactFamily[]);

const STRICT_METRICS: Readonly<Record<V2ContextFactFamily, readonly string[]>> = Object.freeze({
  session: Object.freeze(["sessionTypes"]),
  opening_price: Object.freeze(["openingTypes"]),
  dealing_range: Object.freeze([]),
  liquidity: Object.freeze(["sides"]),
  displacement: Object.freeze(["latestDirection"]),
  fair_value_gap: Object.freeze(["latestDirection"]),
  higher_timeframe_bias: Object.freeze(["timeframes"])
});

const REQUIRED_METRICS: Readonly<Record<V2ContextFactFamily, readonly string[]>> = Object.freeze({
  session: Object.freeze(["sessionTypes"]),
  opening_price: Object.freeze(["openingTypes"]),
  dealing_range: Object.freeze(["geometrySignature"]),
  liquidity: Object.freeze(["sides"]),
  displacement: Object.freeze(["latestDirection"]),
  fair_value_gap: Object.freeze(["latestDirection"]),
  higher_timeframe_bias: Object.freeze(["timeframes"])
});

const familyForFact = (fact: Readonly<V2MarketFact>): V2ContextFactFamily => {
  switch (fact.kind) {
    case "session": return "session";
    case "opening_price": return "opening_price";
    case "dealing_range": return "dealing_range";
    case "liquidity_pool":
    case "liquidity_sweep": return "liquidity";
    case "displacement": return "displacement";
    case "fair_value_gap": return "fair_value_gap";
    case "higher_timeframe_bias": return "higher_timeframe_bias";
  }
};

const uniqueSorted = (values: readonly string[]) =>
  Object.freeze([...new Set(values)].sort());
const round = (value: number) => Number(value.toFixed(8));
const metric = (
  key: string,
  value: V2ContextCompatibilityMetricValue
): Readonly<V2ContextCompatibilityMetric> => Object.freeze({ key, value });
const metrics = (
  values: readonly Readonly<V2ContextCompatibilityMetric>[]
) => Object.freeze([...values].sort((left, right) => left.key.localeCompare(right.key)));

const factTimeframes = (facts: readonly Readonly<V2MarketFact>[]) =>
  uniqueSorted(facts.map((fact) => fact.timeframe));

const summarizeFacts = (
  family: V2ContextFactFamily,
  facts: readonly Readonly<V2MarketFact>[]
): Readonly<V2ContextFactSummary> => {
  const timeframes = factTimeframes(facts);
  const base = [metric("factCount", facts.length), metric("timeframes", timeframes)];
  let familyMetrics: readonly Readonly<V2ContextCompatibilityMetric>[] = [];

  if (family === "session") {
    const sessions = facts.filter((fact) => fact.kind === "session");
    familyMetrics = [
      metric("sessionTypes", uniqueSorted(sessions.map((fact) => fact.payload.sessionType))),
      metric("completeSessionTypes", uniqueSorted(
        sessions.filter((fact) => fact.payload.complete).map((fact) => fact.payload.sessionType)
      ))
    ];
  } else if (family === "opening_price") {
    const openings = facts.filter((fact) => fact.kind === "opening_price");
    familyMetrics = [
      metric("openingTypes", uniqueSorted(openings.map((fact) => fact.payload.openingType))),
      metric("priceSignature", uniqueSorted(openings.map((fact) =>
        `${fact.payload.openingType}:${fact.payload.price === undefined ? "missing" : round(fact.payload.price)}`
      )))
    ];
  } else if (family === "dealing_range") {
    const ranges = facts.filter((fact) => fact.kind === "dealing_range");
    familyMetrics = [
      metric("rangeTypes", uniqueSorted(ranges.map((fact) => fact.payload.rangeType))),
      metric("directions", uniqueSorted(ranges.map((fact) => fact.payload.direction))),
      metric("geometrySignature", uniqueSorted(ranges.map((fact) =>
        `${fact.payload.rangeType}:${round(fact.payload.low)}:${round(fact.payload.high)}`
      )))
    ];
  } else if (family === "liquidity") {
    const pools = facts.filter((fact) => fact.kind === "liquidity_pool");
    const sweeps = facts.filter((fact) => fact.kind === "liquidity_sweep");
    familyMetrics = [
      metric("sides", uniqueSorted(pools.map((fact) => fact.payload.side))),
      metric("poolStates", uniqueSorted(pools.map((fact) => fact.payload.state))),
      metric("sweepStates", uniqueSorted(sweeps.map((fact) => fact.payload.confirmationState)))
    ];
  } else if (family === "displacement") {
    const displacements = facts.filter((fact) => fact.kind === "displacement")
      .sort((left, right) => left.payload.candleTime.localeCompare(right.payload.candleTime));
    familyMetrics = [
      metric("directions", uniqueSorted(displacements.map((fact) => fact.payload.direction))),
      metric("latestDirection", displacements.at(-1)?.payload.direction ?? "missing"),
      metric("latestEventTime", displacements.at(-1)?.payload.candleTime ?? "missing")
    ];
  } else if (family === "fair_value_gap") {
    const gaps = facts.filter((fact) => fact.kind === "fair_value_gap")
      .sort((left, right) => left.payload.confirmationCandleTime.localeCompare(
        right.payload.confirmationCandleTime
      ));
    familyMetrics = [
      metric("directions", uniqueSorted(gaps.map((fact) => fact.payload.direction))),
      metric("states", uniqueSorted(gaps.map((fact) => fact.payload.state))),
      metric("latestDirection", gaps.at(-1)?.payload.direction ?? "missing"),
      metric("latestGeometry", gaps.at(-1)
        ? `${round(gaps.at(-1)!.payload.lowerBound)}:${round(gaps.at(-1)!.payload.upperBound)}`
        : "missing")
    ];
  } else {
    const biases = facts.filter((fact) => fact.kind === "higher_timeframe_bias");
    familyMetrics = [
      metric("directions", uniqueSorted(biases.map((fact) =>
        `${fact.timeframe}:${fact.payload.direction}`
      )))
    ];
  }

  const summaryMetrics = metrics([...base, ...familyMetrics]);
  return Object.freeze({
    family,
    factCount: facts.length,
    timeframes,
    metrics: summaryMetrics,
    summary: `${family}: ${facts.length} compact V2 fact${facts.length === 1 ? "" : "s"}`
  });
};

export function summarizeV2ContextFacts(
  context: Readonly<V2CanonicalMarketState>
): readonly Readonly<V2ContextFactSummary>[] {
  return Object.freeze(FACT_FAMILIES.map((family) =>
    summarizeFacts(family, context.facts.filter((fact) => familyForFact(fact) === family))
  ));
}

const valueKey = (value: V2ContextCompatibilityMetricValue) => JSON.stringify(value);
const metricMap = (items: readonly Readonly<V2ContextCompatibilityMetric>[]) =>
  new Map(items.map((item) => [item.key, item.value]));
const sameMetricSet = (
  legacy: readonly Readonly<V2ContextCompatibilityMetric>[],
  v2: readonly Readonly<V2ContextCompatibilityMetric>[]
) => {
  const left = metricMap(legacy);
  const right = metricMap(v2);
  return left.size === right.size &&
    [...left].every(([key, value]) => right.has(key) && valueKey(right.get(key)!) === valueKey(value));
};

const normalizedBuiltAt = (value?: string) => {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
};

const missingObservation = (
  family: V2ContextFactFamily,
  context: Readonly<V2CanonicalMarketState>
): Readonly<V2LegacyContextObservation> => Object.freeze({
  family,
  status: "missing",
  requestedSymbol: context.identity.source.requestedSymbol,
  brokerSymbol: context.identity.source.brokerSymbol,
  sourceFingerprint: context.identity.source.sourceFingerprint,
  timeframes: Object.freeze([]),
  metrics: Object.freeze([]),
  summary: "Legacy comparison observation is missing.",
  knownDifferences: Object.freeze([]),
  authority: V2_AUTHORITY_NONE
});

const compareEntry = ({
  context,
  legacy,
  v2
}: {
  context: Readonly<V2CanonicalMarketState>;
  legacy: Readonly<V2LegacyContextObservation>;
  v2: Readonly<V2ContextFactSummary>;
}): Readonly<V2ContextCompatibilityEntry> => {
  const differences: string[] = [];
  let hardRegression = false;
  try {
    assertV2Authority(legacy.authority);
  } catch {
    differences.push("legacy_authority_mismatch");
    hardRegression = true;
  }
  if (legacy.requestedSymbol !== context.identity.source.requestedSymbol) {
    differences.push("requested_symbol_mismatch");
    hardRegression = true;
  }
  if (legacy.brokerSymbol !== context.identity.source.brokerSymbol) {
    differences.push("broker_symbol_mismatch");
    hardRegression = true;
  }
  if (legacy.sourceFingerprint !== context.identity.source.sourceFingerprint) {
    differences.push("source_fingerprint_mismatch");
    hardRegression = true;
  }
  if (legacy.status !== "available") {
    differences.push(`legacy_observation_${legacy.status}`);
  }

  const legacyMetrics = metricMap(legacy.metrics);
  const v2Metrics = metricMap(v2.metrics);
  for (const [key, legacyValue] of legacyMetrics) {
    const v2Value = v2Metrics.get(key);
    if (v2Value === undefined) {
      differences.push(`metric_missing_in_v2:${key}`);
      hardRegression = true;
    } else if (valueKey(v2Value) !== valueKey(legacyValue)) {
      differences.push(`metric_mismatch:${key}`);
      if (STRICT_METRICS[legacy.family].includes(key)) hardRegression = true;
    }
  }
  for (const key of REQUIRED_METRICS[legacy.family]) {
    if (!legacyMetrics.has(key)) differences.push(`required_metric_not_compared:${key}`);
  }

  const allowedPolicy = V2_CONTEXT_REVIEWED_VARIANCE_POLICIES[
    legacy.family as keyof typeof V2_CONTEXT_REVIEWED_VARIANCE_POLICIES
  ];
  const hasMetricDifference = differences.some((item) =>
    item.startsWith("metric_mismatch:") || item.startsWith("metric_missing_in_v2:")
  );
  const insufficient = legacy.status !== "available" ||
    v2.factCount === 0 ||
    differences.some((item) => item.startsWith("required_metric_not_compared:"));
  let outcome: V2ContextCompatibilityEntry["outcome"];
  if (hardRegression) {
    outcome = "regression";
  } else if (insufficient) {
    outcome = "insufficient_comparison_data";
  } else if (hasMetricDifference || legacy.knownDifferences.length) {
    outcome = allowedPolicy && legacy.reviewedVariancePolicyId === allowedPolicy
      ? "documented_variance"
      : "regression";
    if (outcome === "regression" && !legacy.reviewedVariancePolicyId) {
      differences.push("reviewed_variance_policy_missing");
    } else if (
      outcome === "regression" &&
      legacy.reviewedVariancePolicyId !== allowedPolicy
    ) {
      differences.push("reviewed_variance_policy_unrecognized");
    }
  } else {
    outcome = sameMetricSet(legacy.metrics, v2.metrics) ? "exact_parity" : "semantic_parity";
  }
  return Object.freeze({
    family: legacy.family,
    outcome,
    legacy,
    v2,
    differences: Object.freeze([...new Set([...differences, ...legacy.knownDifferences])]),
    ...(legacy.reviewedVariancePolicyId
      ? { reviewedVariancePolicyId: legacy.reviewedVariancePolicyId }
      : {}),
    blocksPhase3: outcome === "regression" || outcome === "insufficient_comparison_data"
  });
};

export async function buildV2ContextCompatibilityReport(
  request: V2ContextCompatibilityRequest
): Promise<Readonly<V2ContextCompatibilityReport>> {
  assertV2Authority(request.v2Context.authority);
  if (!request.v2Context.shadowOnly) {
    throw new Error("V2 context compatibility review accepts shadow-only V2 context artifacts.");
  }
  const observations = new Map(request.legacyObservations.map((item) => [item.family, item]));
  const summaries = new Map(
    summarizeV2ContextFacts(request.v2Context).map((item) => [item.family, item])
  );
  const entries = Object.freeze(FACT_FAMILIES.map((family) => compareEntry({
    context: request.v2Context,
    legacy: observations.get(family) ?? missingObservation(family, request.v2Context),
    v2: summaries.get(family)!
  })));
  const blockers = Object.freeze(entries
    .filter((entry) => entry.blocksPhase3)
    .map((entry) => `${entry.family}:${entry.outcome}`));
  const warnings = Object.freeze(entries
    .filter((entry) => entry.outcome === "documented_variance")
    .map((entry) => `${entry.family}:reviewed_policy_variance`));
  const status = blockers.length
    ? "blocked" as const
    : warnings.length
      ? "ready_for_canary_review" as const
      : "ready_for_canary_review" as const;
  const builtAt = normalizedBuiltAt(request.builtAt);
  const core = {
    schemaVersion: V2_CONTEXT_COMPATIBILITY_SCHEMA_VERSION,
    policyVersion: V2_CONTEXT_COMPATIBILITY_POLICY_VERSION,
    contextArtifactId: request.v2Context.contextArtifactId,
    sourceFingerprint: request.v2Context.identity.source.sourceFingerprint,
    requestedSymbol: request.v2Context.identity.source.requestedSymbol,
    brokerSymbol: request.v2Context.identity.source.brokerSymbol,
    legacyAuthoritative: true as const,
    v2ShadowOnly: true as const,
    status,
    entries,
    blockers,
    warnings,
    rawCandlesSerialized: false as const,
    authority: V2_AUTHORITY_NONE
  } as const;
  return Object.freeze({
    reportId: `v2-context-compatibility:${(await canonicalHash(core)).replace(/^sha256:/, "")}`,
    ...core,
    builtAt
  });
}
