import {
  canonicalFactBase,
  canonicalFactId,
  canonicalLineage,
  causalCandlesAt,
  fingerprintCanonicalSource,
  resolveFactMarket
} from "@/lib/ictCanonical/canonicalIctIdentity";
import type { CanonicalFactBuildInput, CanonicalOpeningGapFact } from "@/lib/ictCanonical/canonicalIctTypes";
import { getTimingDateKey, resolveSessionTimeMapping } from "@/lib/sessions";

export const CANONICAL_OPENING_GAP_CALENDAR_POLICY = Object.freeze({
  policyId: "gotrader.canonical.opening-gap.new-york-calendar",
  policyVersion: "1.0.0",
  timeAuthorityId: "gotrader.sessions.iana-america-new-york"
});

const weekKey = (dateKey: string) => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  return date.toISOString().slice(0, 10);
};

export const buildCanonicalOpeningGaps = (input: CanonicalFactBuildInput): CanonicalOpeningGapFact[] => {
  const candles = causalCandlesAt(input.candles, input.asOf);
  if (candles.length < 2) return [];
  const { symbol, timeframe } = resolveFactMarket(candles, input.symbol, input.timeframe);
  const sourceFingerprint = input.sourceFingerprint ?? fingerprintCanonicalSource(candles);
  const mapping = resolveSessionTimeMapping({ provider: "canonical_ict", symbol, candles });
  const facts: CanonicalOpeningGapFact[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const prior = candles[index - 1];
    const current = candles[index];
    const priorDate = getTimingDateKey(prior.timestamp, mapping);
    const currentDate = getTimingDateKey(current.timestamp, mapping);
    const boundaryTypes: CanonicalOpeningGapFact["gapType"][] = [];
    if (priorDate !== currentDate) boundaryTypes.push("NDOG");
    if (weekKey(priorDate) !== weekKey(currentDate)) boundaryTypes.push("NWOG");
    if (current.open === prior.close) continue;
    for (const gapType of boundaryTypes) {
      const gapLow = Math.min(prior.close, current.open);
      const gapHigh = Math.max(prior.close, current.open);
      const identity = gapType === "NDOG" ? currentDate : weekKey(currentDate);
      const factId = canonicalFactId("OPENING_GAP", {
        gapType,
        priorReferenceCandleId: prior.id,
        newOpenCandleId: current.id,
        marketDateOrWeekIdentity: identity,
        calendarPolicyId: CANONICAL_OPENING_GAP_CALENDAR_POLICY.policyId
      });
      facts.push({
        ...canonicalFactBase({
          factId,
          factType: "OPENING_GAP",
          symbol,
          timeframe,
          occurredAt: current.timestamp,
          confirmedAt: current.timestamp,
          validFrom: current.timestamp,
          state: "ACTIVE",
          lineage: canonicalLineage({
            sourceCandleIds: [prior.id, current.id],
            sourceFingerprint,
            policyId: CANONICAL_OPENING_GAP_CALENDAR_POLICY.policyId,
            policyVersion: CANONICAL_OPENING_GAP_CALENDAR_POLICY.policyVersion
          })
        }),
        factType: "OPENING_GAP",
        gapId: factId,
        gapType,
        priorReferencePrice: prior.close,
        newOpenPrice: current.open,
        gapLow,
        gapHigh,
        midpoint: (gapLow + gapHigh) / 2,
        marketDateOrWeekIdentity: identity,
        calendarPolicyId: CANONICAL_OPENING_GAP_CALENDAR_POLICY.policyId,
        timeAuthorityId: CANONICAL_OPENING_GAP_CALENDAR_POLICY.timeAuthorityId
      });
    }
  }
  return facts;
};
