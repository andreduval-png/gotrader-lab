/**
 * Deterministic out-of-sample edge statistics.
 *
 * Readiness labels used to come from fixed heuristic constants. This module
 * computes real statistics from realized R-multiples: a seeded bootstrap
 * confidence interval on expectancy and a conservative edge verdict based on
 * the lower confidence bound.
 */

export type EdgeVerdict = "insufficient_sample" | "no_edge" | "weak_edge" | "positive_edge";

export interface EdgeStatistics {
  sampleSize: number;
  meanR: number;
  stdDevR: number;
  winRate: number;
  /** 95% bootstrap confidence interval on mean R. */
  expectancyLower95: number;
  expectancyUpper95: number;
  bootstrapIterations: number;
  minimumSampleSize: number;
  verdict: EdgeVerdict;
  summary: string;
  /** Where the R-multiples came from — never treat in_sample as OOS. */
  provenance?: "in_sample" | "out_of_sample";
}

export interface EdgeStatisticsOptions {
  minimumSampleSize?: number;
  bootstrapIterations?: number;
  /** Explicit seed keeps results reproducible for the same trade set. */
  seed?: number;
}

export const DEFAULT_MINIMUM_EDGE_SAMPLE = 20;
const DEFAULT_BOOTSTRAP_ITERATIONS = 1000;

const round = (value: number, digits = 3) => Number(value.toFixed(digits));

/** Deterministic 32-bit PRNG so the same inputs always give the same CI. */
export const mulberry32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const seedFromSample = (values: number[]) =>
  values.reduce((seed, value, index) => (seed + Math.round(value * 1000) * (index + 1)) >>> 0, values.length >>> 0);

export function computeEdgeStatistics(rMultiples: number[], options: EdgeStatisticsOptions & { provenance?: "in_sample" | "out_of_sample" } = {}): EdgeStatistics {
  const minimumSampleSize = options.minimumSampleSize ?? DEFAULT_MINIMUM_EDGE_SAMPLE;
  const bootstrapIterations = options.bootstrapIterations ?? DEFAULT_BOOTSTRAP_ITERATIONS;
  const sample = rMultiples.filter((value) => Number.isFinite(value));
  const sampleSize = sample.length;

  if (sampleSize === 0) {
    return {
      sampleSize: 0,
      meanR: 0,
      stdDevR: 0,
      winRate: 0,
      expectancyLower95: 0,
      expectancyUpper95: 0,
      bootstrapIterations,
      minimumSampleSize,
      verdict: "insufficient_sample",
      summary: "No trades available; edge cannot be estimated.",
      provenance: options.provenance
    };
  }

  const meanR = sample.reduce((sum, value) => sum + value, 0) / sampleSize;
  const variance = sample.reduce((sum, value) => sum + (value - meanR) ** 2, 0) / Math.max(1, sampleSize - 1);
  const stdDevR = Math.sqrt(variance);
  const winRate = sample.filter((value) => value > 0).length / sampleSize;

  const random = mulberry32(options.seed ?? seedFromSample(sample));
  const bootstrapMeans: number[] = [];
  for (let iteration = 0; iteration < bootstrapIterations; iteration += 1) {
    let total = 0;
    for (let draw = 0; draw < sampleSize; draw += 1) {
      total += sample[Math.floor(random() * sampleSize)];
    }
    bootstrapMeans.push(total / sampleSize);
  }
  bootstrapMeans.sort((a, b) => a - b);
  const lowerIndex = Math.max(0, Math.floor(bootstrapIterations * 0.025) - 1);
  const upperIndex = Math.min(bootstrapIterations - 1, Math.ceil(bootstrapIterations * 0.975) - 1);
  const expectancyLower95 = bootstrapMeans[lowerIndex];
  const expectancyUpper95 = bootstrapMeans[upperIndex];

  const verdict: EdgeVerdict =
    sampleSize < minimumSampleSize
      ? "insufficient_sample"
      : expectancyLower95 > 0
        ? "positive_edge"
        : meanR > 0
          ? "weak_edge"
          : "no_edge";

  const summary =
    verdict === "insufficient_sample"
      ? `Only ${sampleSize} trades; ${minimumSampleSize}+ required before the edge estimate is trusted.`
      : verdict === "positive_edge"
        ? `Positive expectancy: mean ${round(meanR, 2)}R with 95% CI [${round(expectancyLower95, 2)}R, ${round(expectancyUpper95, 2)}R] over ${sampleSize} trades.`
        : verdict === "weak_edge"
          ? `Mean ${round(meanR, 2)}R is positive but the 95% CI lower bound ${round(expectancyLower95, 2)}R includes zero; edge is not yet proven over ${sampleSize} trades.`
          : `No positive expectancy: mean ${round(meanR, 2)}R with 95% CI [${round(expectancyLower95, 2)}R, ${round(expectancyUpper95, 2)}R] over ${sampleSize} trades.`;

  return {
    sampleSize,
    meanR: round(meanR),
    stdDevR: round(stdDevR),
    winRate: round(winRate),
    expectancyLower95: round(expectancyLower95),
    expectancyUpper95: round(expectancyUpper95),
    bootstrapIterations,
    minimumSampleSize,
    verdict,
    summary,
    provenance: options.provenance
  };
}
