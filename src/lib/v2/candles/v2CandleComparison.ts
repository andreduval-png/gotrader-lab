import type { V2CanonicalCandle, V2CanonicalCandleWindow } from "./v2CandleTypes";

export type V2CandleComparisonStatus =
  | "exact_match"
  | "equivalent_with_documented_variance"
  | "mismatch"
  | "insufficient_comparison_data";

export interface V2CandleComparisonResult {
  status: V2CandleComparisonStatus;
  comparedCount: number;
  missingFromLeft: number;
  missingFromRight: number;
  ohlcMismatchCount: number;
  volumeVarianceCount: number;
  sourceFingerprintCompatible: boolean;
  firstMismatchTime?: string;
  summary: string;
}

const priceEqual = (left: number, right: number) => Math.abs(left - right) <= 1e-8;
const sameOhlc = (left: V2CanonicalCandle, right: V2CanonicalCandle) =>
  priceEqual(left.open, right.open) &&
  priceEqual(left.high, right.high) &&
  priceEqual(left.low, right.low) &&
  priceEqual(left.close, right.close) &&
  left.closeTime === right.closeTime;

export function compareV2CandleWindows(
  left: V2CanonicalCandleWindow,
  right: V2CanonicalCandleWindow
): Readonly<V2CandleComparisonResult> {
  if (!left.candles.length || !right.candles.length) {
    return Object.freeze({
      status: "insufficient_comparison_data",
      comparedCount: 0,
      missingFromLeft: right.candles.length,
      missingFromRight: left.candles.length,
      ohlcMismatchCount: 0,
      volumeVarianceCount: 0,
      sourceFingerprintCompatible: false,
      summary: "Both polling and push windows require closed candles before comparison."
    });
  }
  const leftByTime = new Map(left.candles.map((candle) => [candle.openTime, candle]));
  const rightByTime = new Map(right.candles.map((candle) => [candle.openTime, candle]));
  const sharedTimes = [...leftByTime.keys()].filter((time) => rightByTime.has(time)).sort();
  let ohlcMismatchCount = 0;
  let volumeVarianceCount = 0;
  let firstMismatchTime: string | undefined;
  for (const time of sharedTimes) {
    const leftCandle = leftByTime.get(time)!;
    const rightCandle = rightByTime.get(time)!;
    if (!sameOhlc(leftCandle, rightCandle)) {
      ohlcMismatchCount += 1;
      firstMismatchTime ??= time;
    } else if (leftCandle.volume !== rightCandle.volume) {
      volumeVarianceCount += 1;
    }
  }
  const missingFromLeft = [...rightByTime.keys()].filter((time) => !leftByTime.has(time)).length;
  const missingFromRight = [...leftByTime.keys()].filter((time) => !rightByTime.has(time)).length;
  const sourceFingerprintCompatible =
    left.identity.source.sourceFingerprint === right.identity.source.sourceFingerprint ||
    (
      left.identity.source.requestedSymbol === right.identity.source.requestedSymbol &&
      left.identity.source.brokerSymbol === right.identity.source.brokerSymbol
    );
  const mismatch = ohlcMismatchCount > 0 || missingFromLeft > 0 || missingFromRight > 0;
  const documentedVariance = volumeVarianceCount > 0 ||
    left.identity.source.sourceFingerprint !== right.identity.source.sourceFingerprint;
  const status: V2CandleComparisonStatus = mismatch
    ? "mismatch"
    : documentedVariance
      ? "equivalent_with_documented_variance"
      : "exact_match";
  return Object.freeze({
    status,
    comparedCount: sharedTimes.length,
    missingFromLeft,
    missingFromRight,
    ohlcMismatchCount,
    volumeVarianceCount,
    sourceFingerprintCompatible,
    firstMismatchTime,
    summary: status === "exact_match"
      ? "Closed polling and push candles match exactly."
      : status === "equivalent_with_documented_variance"
        ? "Closed candles match on timing and OHLC with documented volume or transport-fingerprint variance."
        : "Closed polling and push candle windows differ."
  });
}
