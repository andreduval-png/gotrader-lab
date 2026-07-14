import { evaluateIctIfvg } from "./ictIfvg";
import type { IctIfvgCandidate, IctIfvgInput } from "./ictIfvgTypes";

const authority = {
  executionAuthority: "none" as const,
  brokerAuthority: "none" as const,
  readinessOverrideAuthority: "none" as const
};

const hasStrongBody = (candle: IctIfvgCandidate["inversionCandle"], minimumBodyRatio = 0.55) => {
  if (!candle) return false;
  const range = Math.abs(candle.high - candle.low);
  const body = Math.abs(candle.close - candle.open);
  return range > 0 && body / range >= minimumBodyRatio;
};

const hasCleanRetest = (candidate: IctIfvgCandidate) => {
  const retest = candidate.retestCandle;
  const bounds = candidate.ifvgBounds;
  if (!retest || !bounds || candidate.side === "flat") return false;
  return candidate.side === "long"
    ? retest.low <= bounds.midpoint && retest.low >= bounds.low && retest.close >= bounds.midpoint
    : retest.high >= bounds.midpoint && retest.high <= bounds.high && retest.close <= bounds.midpoint;
};

const sortedInputCandles = (input: IctIfvgInput) =>
  input.candles
    .filter((candle) => Number.isFinite(Date.parse(candle.timestamp)))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));

const signalAgeBars = (input: IctIfvgInput, candidate: IctIfvgCandidate) => {
  const retestTimestamp = candidate.retestCandle?.timestamp;
  if (!retestTimestamp) return undefined;
  const sorted = sortedInputCandles(input);
  const retestIndex = sorted.findIndex((candle) => candle.timestamp === retestTimestamp);
  return retestIndex < 0 ? undefined : sorted.length - 1 - retestIndex;
};

const postInversionDeliveryConfirmed = (input: IctIfvgInput, candidate: IctIfvgCandidate) => {
  const inversionTimestamp = candidate.inversionCandle?.timestamp;
  const retestTimestamp = candidate.retestCandle?.timestamp;
  if (!inversionTimestamp || !retestTimestamp || candidate.side === "flat") return false;
  const sorted = sortedInputCandles(input);
  const inversionIndex = sorted.findIndex((candle) => candle.timestamp === inversionTimestamp);
  const retestIndex = sorted.findIndex((candle) => candle.timestamp === retestTimestamp);
  if (inversionIndex < 0 || retestIndex <= inversionIndex) return false;
  // Confirmation must be observable before entry. Candles at or after the
  // retest cannot be used to qualify the signal without look-ahead leakage.
  const confirmation = sorted.slice(inversionIndex + 1, Math.min(retestIndex, inversionIndex + 4));
  if (confirmation.length < 2) return false;
  const inversionClose = candidate.inversionCandle?.close;
  if (!Number.isFinite(inversionClose)) return false;
  return candidate.side === "long"
    ? confirmation.at(-1)!.close > inversionClose! && confirmation.filter((candle) => candle.close >= candle.open).length >= 2
    : confirmation.at(-1)!.close < inversionClose! && confirmation.filter((candle) => candle.close <= candle.open).length >= 2;
};

export interface IctIfvgFilteredV2Assessment {
  strategyId: "ifvg_filtered_v2_research";
  candidate: IctIfvgCandidate;
  cleanRetest: boolean;
  strongInversionBody: boolean;
  postInversionDeliveryConfirmed: boolean;
  displacementConfirmed: boolean;
  signalAgeBars?: number;
  signalFresh: boolean;
  eligible: boolean;
  blockers: string[];
  researchOnly: true;
  authority: typeof authority;
}

/**
 * Research-only IFVG v2 filter proven by the explicit 90-day diagnostic.
 * It does not alter the base detector and cannot approve readiness.
 */
export const assessIctIfvgFilteredV2 = (
  input: IctIfvgInput,
  detected: IctIfvgCandidate = evaluateIctIfvg(input)
): IctIfvgFilteredV2Assessment => {
  const cleanRetest = hasCleanRetest(detected);
  const strongInversionBody = hasStrongBody(detected.inversionCandle);
  const deliveryConfirmed = postInversionDeliveryConfirmed(input, detected);
  const displacementConfirmed = strongInversionBody && deliveryConfirmed;
  const ageBars = signalAgeBars(input, detected);
  const signalFresh = ageBars === 0;
  const blockers = [
    ...detected.blockers,
    detected.canCreateValidationChainEntry ? undefined : "base_ifvg_not_validation_eligible",
    cleanRetest ? undefined : "clean_retest_required",
    displacementConfirmed ? undefined : "pre_retest_displacement_confirmation_required",
    signalFresh ? undefined : "stale_retest_signal"
  ].filter((item): item is string => Boolean(item));

  return {
    strategyId: "ifvg_filtered_v2_research",
    candidate: detected,
    cleanRetest,
    strongInversionBody,
    postInversionDeliveryConfirmed: deliveryConfirmed,
    displacementConfirmed,
    signalAgeBars: ageBars,
    signalFresh,
    eligible: blockers.length === 0,
    blockers,
    researchOnly: true,
    authority
  };
};
