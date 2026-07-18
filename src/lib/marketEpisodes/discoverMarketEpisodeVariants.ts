import type {
  MarketEpisode,
  MarketEpisodeOpportunity,
  MarketEpisodeOpportunityFamily,
  MarketEpisodeSession
} from "./marketEpisodeTypes";
import {
  MARKET_EPISODE_VARIANT_AUTHORITY,
  type MarketEpisodeVariantCandidate,
  type MarketEpisodeVariantDiscovery
} from "./marketEpisodeVariantTypes";

interface VariantDescriptor {
  family: MarketEpisodeOpportunityFamily;
  session?: MarketEpisodeSession;
  side?: "long" | "short";
}

const round = (value: number, digits = 4) => Number(value.toFixed(digits));
const unique = (values: Array<string | undefined>) => Array.from(new Set(values.filter((value): value is string => Boolean(value))));
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const stableId = (value: string) => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const activeWindowCount = (opportunities: MarketEpisodeOpportunity[]) => {
  const timestamps = opportunities.map((item) => Date.parse(item.detectedAt)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!timestamps.length) return 0;
  const origin = timestamps[0];
  return new Set(timestamps.map((timestamp) => Math.floor((timestamp - origin) / (30 * 86_400_000)))).size;
};

const descriptorKey = (descriptor: VariantDescriptor) =>
  [descriptor.family, descriptor.session, descriptor.side].filter(Boolean).join("|");

const matches = (opportunity: MarketEpisodeOpportunity, descriptor: VariantDescriptor) =>
  opportunity.family === descriptor.family &&
  (!descriptor.session || opportunity.session === descriptor.session) &&
  (!descriptor.side || opportunity.side === descriptor.side);

const buildVariant = (
  descriptor: VariantDescriptor,
  opportunities: MarketEpisodeOpportunity[],
  minimumCompleted: number,
  minimumIndependentDates: number,
  minimumActiveWindows: number
): MarketEpisodeVariantCandidate => {
  const completed = opportunities.filter((item) => item.outcome === "target_first" || item.outcome === "invalidation_first");
  const winners = completed.filter((item) => item.outcome === "target_first");
  const realized = completed.map((item) => item.realizedR).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const averageRealizedR = realized.length ? realized.reduce((sum, value) => sum + value, 0) / realized.length : null;
  const grossProfit = realized.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(realized.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : null;
  const independentDates = new Set(opportunities.map((item) => item.detectedAt.slice(0, 10))).size;
  const activeWindows = activeWindowCount(opportunities);
  const blockers = unique([
    completed.length < minimumCompleted ? `Only ${completed.length} completed outcomes; ${minimumCompleted} are required.` : undefined,
    independentDates < minimumIndependentDates ? `Only ${independentDates} independent dates; ${minimumIndependentDates} are required.` : undefined,
    activeWindows < minimumActiveWindows ? `Only ${activeWindows} active 30-day windows; ${minimumActiveWindows} are required.` : undefined,
    averageRealizedR !== null && averageRealizedR <= 0 ? `Average expectancy is ${round(averageRealizedR, 3)}R.` : undefined,
    profitFactor !== null && profitFactor <= 1 ? `Profit factor is ${round(profitFactor, 3)}.` : undefined
  ]);
  const enoughData = completed.length >= minimumCompleted && independentDates >= minimumIndependentDates && activeWindows >= minimumActiveWindows;
  const classification = !enoughData
    ? "insufficient_data" as const
    : averageRealizedR !== null && averageRealizedR >= 0.15 && profitFactor !== null && profitFactor >= 1.2
      ? "promising_for_validation" as const
      : averageRealizedR !== null && averageRealizedR > 0 && profitFactor !== null && profitFactor > 1
        ? "weak_edge_needs_filtering" as const
        : "negative_expectancy" as const;
  const profileParts = [descriptor.family, descriptor.session, descriptor.side].filter(Boolean).map((value) => slug(String(value)));
  const candidateProfileName = `${profileParts.join("_")}_candidate_v1`;
  const cohortFingerprint = `cohort_${stableId(opportunities.map((item) => `${item.detectedAt}|${item.side}`).sort().join(";"))}`;

  return {
    variantId: `episode_variant_${candidateProfileName}`,
    candidateProfileName,
    cohortFingerprint,
    family: descriptor.family,
    ...(descriptor.session ? { session: descriptor.session } : {}),
    ...(descriptor.side ? { side: descriptor.side } : {}),
    candidateCount: opportunities.length,
    completedCount: completed.length,
    targetFirstRate: completed.length ? round(winners.length / completed.length) : null,
    averageRealizedR: averageRealizedR === null ? null : round(averageRealizedR),
    profitFactor: profitFactor === null ? null : Number.isFinite(profitFactor) ? round(profitFactor) : profitFactor,
    independentDates,
    activeWindows,
    classification,
    blockers,
    recommendation: classification === "promising_for_validation"
      ? "Create a new draft profile version and run chronological replay, cost sensitivity, frozen walk-forward, and forward prediction validation."
      : classification === "weak_edge_needs_filtering"
        ? "Keep this combination in discovery and compare winners versus losers before defining a narrower profile."
        : classification === "negative_expectancy"
          ? "Do not progress this variant; its completed outcomes do not show positive expectancy."
          : "Collect more independent causal outcomes before judging this variant.",
    requiredValidations: ["chronological_replay", "walk_forward", "cost_model", "forward_prediction"],
    autoPromotionAllowed: false,
    authority: MARKET_EPISODE_VARIANT_AUTHORITY
  };
};

export function discoverMarketEpisodeVariants(
  episodes: MarketEpisode[],
  options: {
    minimumCompleted?: number;
    minimumIndependentDates?: number;
    minimumActiveWindows?: number;
  } = {}
): MarketEpisodeVariantDiscovery {
  const opportunities = episodes.flatMap((episode) => episode.opportunities);
  const descriptors = new Map<string, VariantDescriptor>();
  for (const opportunity of opportunities) {
    const variants: VariantDescriptor[] = [
      { family: opportunity.family },
      { family: opportunity.family, session: opportunity.session },
      { family: opportunity.family, side: opportunity.side },
      { family: opportunity.family, session: opportunity.session, side: opportunity.side }
    ];
    variants.forEach((descriptor) => descriptors.set(descriptorKey(descriptor), descriptor));
  }
  const rankedVariants = Array.from(descriptors.values())
    .map((descriptor) => buildVariant(
      descriptor,
      opportunities.filter((opportunity) => matches(opportunity, descriptor)),
      Math.max(1, options.minimumCompleted ?? 20),
      Math.max(1, options.minimumIndependentDates ?? 3),
      Math.max(1, options.minimumActiveWindows ?? 2)
    ))
    .sort((left, right) => {
      const classRank = { promising_for_validation: 4, weak_edge_needs_filtering: 3, insufficient_data: 2, duplicate_cohort: 1, negative_expectancy: 0 };
      return classRank[right.classification] - classRank[left.classification]
        || (right.averageRealizedR ?? Number.NEGATIVE_INFINITY) - (left.averageRealizedR ?? Number.NEGATIVE_INFINITY)
        || right.completedCount - left.completedCount;
    });
  const cohortOwners = new Map<string, string>();
  const variants = rankedVariants.map((variant) => {
    const owner = cohortOwners.get(variant.cohortFingerprint);
    if (!owner) {
      cohortOwners.set(variant.cohortFingerprint, variant.variantId);
      return variant;
    }
    return {
      ...variant,
      duplicateCohortOf: owner,
      classification: "duplicate_cohort" as const,
      blockers: unique([
        `This label resolves to the same causal candidate cohort as ${owner}; it is not independent confirmation.`,
        ...variant.blockers
      ]),
      recommendation: "Do not count this label as a separate edge. Validate the canonical cohort owner once."
    };
  });
  const promisingVariantCount = variants.filter((variant) => variant.classification === "promising_for_validation").length;
  return {
    generatedAt: new Date().toISOString(),
    evaluatedVariantCount: variants.length,
    promisingVariantCount,
    variants,
    nextAction: promisingVariantCount
      ? "Validate the top draft variant chronologically. Discovery metrics alone cannot create evidence or readiness."
      : "No variant passed discovery gates. Continue feature analysis without loosening approval thresholds.",
    safety: {
      researchOnly: true,
      rawCandlesExcluded: true,
      proposalsAreDraftOnly: true,
      autoPromotionAllowed: false
    },
    authority: MARKET_EPISODE_VARIANT_AUTHORITY
  };
}
