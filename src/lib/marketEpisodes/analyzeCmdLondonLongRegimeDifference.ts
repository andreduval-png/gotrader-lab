import { CMD_LONDON_LONG_PROFILE_AUTHORITY } from "./cmdLondonLongProfileTypes";
import { cmdLondonLongFrozenProfile, matchesCmdLondonLongFrozenProfile } from "./cmdLondonLongFrozenProfile";
import type { MarketEpisode, MarketEpisodeEvent, MarketEpisodeOpportunity } from "./marketEpisodeTypes";
import type {
  CmdLondonLongCausalTelemetry,
  CmdLondonLongFeatureComparison,
  CmdLondonLongRegimeAudit,
  CmdLondonLongRegimeSummary,
  CmdLondonLongVariantAudit
} from "./cmdLondonLongRegimeTypes";

const DAY_MS = 86_400_000;
const WINDOW_MS = 30 * DAY_MS;
const round = (value: number, digits = 4) => Number(value.toFixed(digits));
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const nyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

const nyParts = (timestamp: string) => {
  const parts = Object.fromEntries(nyFormatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute)
  };
};

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const summarize = (rows: CmdLondonLongCausalTelemetry[], sourceStart: number, costR = 0): CmdLondonLongRegimeSummary => {
  const completed = rows.filter((row) => row.outcome === "target_first" || row.outcome === "invalidation_first");
  const realized = completed.map((row) => (row.realizedR ?? 0) - costR);
  const average = realized.length ? realized.reduce((sum, value) => sum + value, 0) / realized.length : null;
  const variance = average !== null && realized.length > 1
    ? realized.reduce((sum, value) => sum + (value - average) ** 2, 0) / (realized.length - 1)
    : null;
  const standardError = variance === null ? null : Math.sqrt(variance / realized.length);
  const grossProfit = realized.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(realized.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const activeWindows = new Set(rows.map((row) => Math.floor((Date.parse(row.detectedAt) - sourceStart) / WINDOW_MS))).size;
  const targetFirst = completed.filter((row) => row.outcome === "target_first").length;
  const baseRealized = completed.map((row) => row.realizedR ?? 0);
  const cost025 = baseRealized.map((value) => value - 0.25);
  const costProfit = cost025.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const costLoss = Math.abs(cost025.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  return {
    candidateCount: rows.length,
    completedCount: completed.length,
    targetFirstRate: completed.length ? round(targetFirst / completed.length) : null,
    averageR: average === null ? null : round(average),
    medianR: realized.length ? round(median(realized) ?? 0) : null,
    profitFactor: grossLoss > 0 ? round(grossProfit / grossLoss) : grossProfit > 0 ? Number.POSITIVE_INFINITY : null,
    expectancyLower95: average === null || standardError === null ? null : round(average - 1.96 * standardError),
    independentDates: new Set(rows.map((row) => row.tradingDate)).size,
    activeWindows,
    averageRWithCost025: cost025.length ? round(cost025.reduce((sum, value) => sum + value, 0) / cost025.length) : null,
    profitFactorWithCost025: costLoss > 0 ? round(costProfit / costLoss) : costProfit > 0 ? Number.POSITIVE_INFINITY : null
  };
};

const latestEvent = (
  events: MarketEpisodeEvent[],
  opportunity: MarketEpisodeOpportunity,
  type: MarketEpisodeEvent["type"],
  requireBullish = false
) => {
  const detectedAt = Date.parse(opportunity.detectedAt);
  return events
    .filter((event) => {
      const leadMinutes = (detectedAt - Date.parse(event.timestamp)) / 60_000;
      return event.type === type && leadMinutes >= 0 && leadMinutes <= 180 && (!requireBullish || event.direction === "bullish");
    })
    .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))[0];
};

const leadMinutes = (detectedAt: string, event?: MarketEpisodeEvent) => event
  ? round((Date.parse(detectedAt) - Date.parse(event.timestamp)) / 60_000, 1)
  : null;

const telemetryFor = (
  episode: MarketEpisode,
  opportunity: MarketEpisodeOpportunity,
  discoveryStart: number
): CmdLondonLongCausalTelemetry => {
  const displacement = episode.events.find(
    (event) => event.type === "displacement" && event.direction === "bullish" && event.timestamp === opportunity.detectedAt
  );
  const sweep = latestEvent(episode.events, opportunity, "liquidity_sweep", true);
  const consolidation = latestEvent(episode.events, opportunity, "consolidation");
  const fvg = latestEvent(episode.events, opportunity, "fair_value_gap", true);
  const cisd = latestEvent(episode.events, opportunity, "cisd", true);
  const parts = nyParts(opportunity.detectedAt);
  return {
    opportunityId: opportunity.opportunityId,
    detectedAt: opportunity.detectedAt,
    tradingDate: parts.date,
    period: Date.parse(opportunity.detectedAt) < discoveryStart ? "pre_selection_challenge" : "recent_discovery_era",
    sessionMinute: parts.minute,
    targetBasis: opportunity.targetBasis,
    rr: opportunity.rr,
    displacementQuality: displacement?.quality ?? 0,
    sweepQuality: sweep?.quality ?? 0,
    consolidationQuality: consolidation?.quality ?? 0,
    fvgPresent: Boolean(fvg),
    fvgQuality: fvg?.quality ?? 0,
    cisdPresent: Boolean(cisd),
    cisdQuality: cisd?.quality ?? 0,
    sweepLeadMinutes: leadMinutes(opportunity.detectedAt, sweep),
    consolidationLeadMinutes: leadMinutes(opportunity.detectedAt, consolidation),
    outcome: opportunity.outcome,
    realizedR: finite(opportunity.realizedR) ? opportunity.realizedR : null,
    sourceFingerprint: episode.sourceFingerprint,
    researchOnly: true,
    authority: CMD_LONDON_LONG_PROFILE_AUTHORITY
  };
};

const averageFeature = (rows: CmdLondonLongCausalTelemetry[], selector: (row: CmdLondonLongCausalTelemetry) => number) =>
  rows.length ? round(rows.reduce((sum, row) => sum + selector(row), 0) / rows.length) : null;

const comparison = (
  feature: string,
  preSelection: CmdLondonLongCausalTelemetry[],
  discovery: CmdLondonLongCausalTelemetry[],
  selector: (row: CmdLondonLongCausalTelemetry) => number,
  interpretation: string
): CmdLondonLongFeatureComparison => {
  const preSelectionValue = averageFeature(preSelection, selector);
  const discoveryValue = averageFeature(discovery, selector);
  return {
    feature,
    preSelectionValue,
    discoveryValue,
    difference: preSelectionValue === null || discoveryValue === null ? null : round(discoveryValue - preSelectionValue),
    interpretation
  };
};

interface VariantDefinition {
  variantId: string;
  rule: string;
  match: (row: CmdLondonLongCausalTelemetry) => boolean;
}

const VARIANTS: VariantDefinition[] = [
  { variantId: "cmd_london_long_causal_baseline", rule: "All causal CMD London-long candidates.", match: () => true },
  { variantId: "cmd_london_long_external_target", rule: "External-liquidity target is available at detection.", match: (row) => row.targetBasis === "external_liquidity" },
  { variantId: "cmd_london_long_high_displacement", rule: "Causal displacement quality is at least 0.55.", match: (row) => row.displacementQuality >= 0.55 },
  { variantId: "cmd_london_long_fvg_context", rule: "A same-direction FVG exists before or at detection.", match: (row) => row.fvgPresent },
  { variantId: "cmd_london_long_cisd_context", rule: "A bullish CISD exists within the prior 180 minutes.", match: (row) => row.cisdPresent },
  { variantId: "cmd_london_long_high_sweep_quality", rule: "Causal sweep quality is at least 0.65.", match: (row) => row.sweepQuality >= 0.65 },
  { variantId: "cmd_london_long_displacement_fvg", rule: "High displacement and same-direction FVG context both exist.", match: (row) => row.displacementQuality >= 0.55 && row.fvgPresent },
  { variantId: "cmd_london_long_early_session", rule: "Signal occurs from 02:00 through 03:29 New York.", match: (row) => row.sessionMinute >= 120 && row.sessionMinute < 210 }
];

const auditVariant = (
  definition: VariantDefinition,
  rows: CmdLondonLongCausalTelemetry[],
  sourceStart: number,
  discoveryStart: number
): CmdLondonLongVariantAudit => {
  const selected = rows.filter(definition.match);
  const preRows = selected.filter((row) => row.period === "pre_selection_challenge");
  const discoveryRows = selected.filter((row) => row.period === "recent_discovery_era");
  const preSelection = summarize(preRows, sourceStart);
  const discovery = summarize(discoveryRows, discoveryStart);
  const pooled = summarize(selected, sourceStart);
  const blockers = [
    preSelection.completedCount < 10 ? `Only ${preSelection.completedCount} completed pre-selection outcomes; 10 are required for variant discovery.` : undefined,
    discovery.completedCount < 10 ? `Only ${discovery.completedCount} completed discovery-era outcomes; 10 are required for variant discovery.` : undefined,
    pooled.completedCount < 20 ? `Only ${pooled.completedCount} pooled completed outcomes; 20 are required.` : undefined,
    preSelection.independentDates < 3 || discovery.independentDates < 3 ? "Both periods require at least 3 independent dates." : undefined,
    pooled.activeWindows < 2 ? "At least 2 active pooled rolling windows are required." : undefined,
    (preSelection.averageRWithCost025 ?? Number.NEGATIVE_INFINITY) <= 0 || (preSelection.profitFactorWithCost025 ?? 0) <= 1
      ? "Pre-selection period failed the 0.25R cost gate."
      : undefined,
    (discovery.averageRWithCost025 ?? Number.NEGATIVE_INFINITY) <= 0 || (discovery.profitFactorWithCost025 ?? 0) <= 1
      ? "Discovery period failed the 0.25R cost gate."
      : undefined
  ].filter((value): value is string => Boolean(value));
  const insufficient = preSelection.completedCount < 10 || discovery.completedCount < 10 || pooled.completedCount < 20;
  const classification = blockers.length === 0
    ? "promising_needs_new_frozen_validation" as const
    : insufficient
      ? "insufficient_data" as const
      : (preSelection.averageR ?? 0) > 0 !== ((discovery.averageR ?? 0) > 0)
        ? "unstable" as const
        : "rejected" as const;
  return {
    variantId: definition.variantId,
    rule: definition.rule,
    preSelection,
    discovery,
    pooled,
    classification,
    blockers,
    mayCreateExecutableProfile: false
  };
};

export function analyzeCmdLondonLongRegimeDifference(episodes: MarketEpisode[]): CmdLondonLongRegimeAudit {
  const sorted = [...episodes].sort((left, right) => Date.parse(left.firstTimestamp) - Date.parse(right.firstTimestamp));
  const sourceStart = Date.parse(sorted[0]?.firstTimestamp ?? "");
  const sourceEnd = Date.parse(sorted.at(-1)?.lastTimestamp ?? "");
  const validRange = Number.isFinite(sourceStart) && Number.isFinite(sourceEnd) && sourceEnd > sourceStart;
  const discoveryStart = validRange ? sourceEnd - 90 * DAY_MS : Date.now() - 90 * DAY_MS;
  const telemetry = sorted.flatMap((episode) => episode.opportunities
    .filter(matchesCmdLondonLongFrozenProfile)
    .map((opportunity) => telemetryFor(episode, opportunity, discoveryStart)));
  const preRows = telemetry.filter((row) => row.period === "pre_selection_challenge");
  const discoveryRows = telemetry.filter((row) => row.period === "recent_discovery_era");
  const featureComparisons = [
    comparison("displacement_quality", preRows, discoveryRows, (row) => row.displacementQuality, "Higher values mean stronger causal body expansion at detection."),
    comparison("sweep_quality", preRows, discoveryRows, (row) => row.sweepQuality, "Higher values mean a deeper prior liquidity sweep relative to the causal range baseline."),
    comparison("consolidation_quality", preRows, discoveryRows, (row) => row.consolidationQuality, "Higher values mean tighter prior compression."),
    comparison("fvg_presence_rate", preRows, discoveryRows, (row) => Number(row.fvgPresent), "Share with same-direction FVG context before or at detection."),
    comparison("cisd_presence_rate", preRows, discoveryRows, (row) => Number(row.cisdPresent), "Share with bullish delivery shift before or at detection."),
    comparison("external_target_rate", preRows, discoveryRows, (row) => Number(row.targetBasis === "external_liquidity"), "Share with an external target known at detection."),
    comparison("average_rr", preRows, discoveryRows, (row) => row.rr, "Reward/risk constructed using only prior liquidity or the fixed projection.")
  ];
  const summaryStart = validRange ? sourceStart : discoveryStart - 90 * DAY_MS;
  const variants = VARIANTS.map((definition) => auditVariant(definition, telemetry, summaryStart, discoveryStart));
  const recommended = variants
    .filter((variant) => variant.classification === "promising_needs_new_frozen_validation")
    .sort((left, right) => (right.pooled.averageRWithCost025 ?? -Infinity) - (left.pooled.averageRWithCost025 ?? -Infinity))[0];
  return {
    auditId: "cmd_london_long_causal_regime_difference_v1",
    generatedAt: new Date().toISOString(),
    discoveryWindowStart: new Date(discoveryStart).toISOString(),
    profileStatus: cmdLondonLongFrozenProfile.status,
    preSelection: summarize(preRows, summaryStart),
    discovery: summarize(discoveryRows, discoveryStart),
    featureComparisons,
    variants,
    recommendedVariantId: recommended?.variantId ?? null,
    recommendation: recommended
      ? `${recommended.variantId} may proceed to a separately named frozen retrospective test. It is not executable, Paper-Demo eligible, or approved.`
      : "No causal CMD London-long filter passed both independent periods after a 0.25R cost. Retire v1 and do not create v2 from this audit.",
    telemetry,
    authority: CMD_LONDON_LONG_PROFILE_AUTHORITY,
    safety: {
      researchOnly: true,
      rawCandlesExcluded: true,
      rawSnapshotsExcluded: true,
      autoPromotionAllowed: false,
      executableProfileCreated: false
    }
  };
}
