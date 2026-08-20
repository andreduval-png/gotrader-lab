import {
  canonicalFactBase,
  canonicalFactId,
  canonicalLineage,
  causalCandlesAt,
  fingerprintCanonicalSource
} from "@/lib/ictCanonical/canonicalIctIdentity";
import type {
  CanonicalBlockFact,
  CanonicalFactBuildInput,
  CanonicalMssFact
} from "@/lib/ictCanonical/canonicalIctTypes";

const BLOCK_POLICY = Object.freeze({
  policyId: "gotrader.canonical.block.mss-origin-and-transition",
  policyVersion: "1.0.0"
});

const priceBounds = (open: number, close: number) => ({
  proximalPrice: Math.max(open, close),
  distalPrice: Math.min(open, close)
});

export const buildCanonicalBlocks = ({
  input,
  structureShifts
}: {
  input: CanonicalFactBuildInput;
  structureShifts: readonly CanonicalMssFact[];
}): CanonicalBlockFact[] => {
  const candles = causalCandlesAt(input.candles, input.asOf);
  const sourceFingerprint = input.sourceFingerprint ?? fingerprintCanonicalSource(candles);
  const byId = new Map(candles.map((candle, index) => [candle.id, { candle, index }]));
  const facts: CanonicalBlockFact[] = [];

  for (const shift of structureShifts) {
    const breakEntry = byId.get(shift.breakCandleId);
    if (!breakEntry || Date.parse(shift.validFrom) > Date.parse(input.asOf)) continue;
    const origin = candles
      .slice(0, breakEntry.index)
      .reverse()
      .find((candle) =>
        shift.direction === "bullish" ? candle.close < candle.open : candle.close > candle.open
      );
    if (!origin) continue;

    const bounds = priceBounds(origin.open, origin.close);
    const orderBlockId = canonicalFactId("BLOCK", {
      blockType: "ORDER_BLOCK",
      direction: shift.direction,
      originCandleIds: [origin.id],
      structureFailureId: shift.mssId,
      policyVersion: BLOCK_POLICY.policyVersion
    });
    const orderBlock: CanonicalBlockFact = {
      ...canonicalFactBase({
        factId: orderBlockId,
        factType: "BLOCK",
        symbol: shift.symbol,
        timeframe: shift.timeframe,
        occurredAt: origin.timestamp,
        confirmedAt: shift.confirmedAt,
        validFrom: shift.validFrom,
        state: "ACTIVE",
        lineage: canonicalLineage({
          sourceCandleIds: [origin.id, shift.breakCandleId],
          sourceFactIds: [shift.factId],
          sourceFingerprint,
          ...BLOCK_POLICY
        })
      }),
      factType: "BLOCK",
      blockId: orderBlockId,
      blockType: "ORDER_BLOCK",
      direction: shift.direction,
      originCandleIds: [origin.id],
      ...bounds,
      midpoint: (bounds.proximalPrice + bounds.distalPrice) / 2,
      structureFailureId: shift.mssId
    };
    facts.push(orderBlock);

    const later = candles.slice(breakEntry.index + 1);
    const violation = later.find((candle) =>
      shift.direction === "bullish"
        ? candle.close < bounds.distalPrice
        : candle.close > bounds.proximalPrice
    );
    if (violation) {
      const breakerId = canonicalFactId("BLOCK", {
        blockType: "BREAKER_BLOCK",
        originBlockId: orderBlockId,
        conversionEventId: violation.id
      });
      facts.push({
        ...canonicalFactBase({
          factId: breakerId,
          factType: "BLOCK",
          symbol: shift.symbol,
          timeframe: shift.timeframe,
          occurredAt: violation.timestamp,
          confirmedAt: violation.timestamp,
          validFrom: violation.timestamp,
          state: "ACTIVE",
          lineage: canonicalLineage({
            sourceCandleIds: [origin.id, shift.breakCandleId, violation.id],
            sourceFactIds: [orderBlockId, shift.factId],
            sourceFingerprint,
            policyId: "gotrader.canonical.block.breaker-close-through",
            policyVersion: "1.0.0"
          })
        }),
        factType: "BLOCK",
        blockId: breakerId,
        blockType: "BREAKER_BLOCK",
        direction: shift.direction === "bullish" ? "bearish" : "bullish",
        originCandleIds: [origin.id],
        ...bounds,
        midpoint: (bounds.proximalPrice + bounds.distalPrice) / 2,
        originBlockId: orderBlockId,
        structureFailureId: shift.mssId,
        conversionEventId: violation.id
      });
      continue;
    }

    const revisit = later.find((candle) => {
      const overlaps = candle.low <= bounds.proximalPrice && candle.high >= bounds.distalPrice;
      const closesExpected = shift.direction === "bullish" ? candle.close > candle.open : candle.close < candle.open;
      return overlaps && closesExpected;
    });
    if (!revisit) continue;
    const mitigationId = canonicalFactId("BLOCK", {
      blockType: "MITIGATION_BLOCK",
      originBlockId: orderBlockId,
      conversionEventId: revisit.id
    });
    facts.push({
      ...canonicalFactBase({
        factId: mitigationId,
        factType: "BLOCK",
        symbol: shift.symbol,
        timeframe: shift.timeframe,
        occurredAt: revisit.timestamp,
        confirmedAt: revisit.timestamp,
        validFrom: revisit.timestamp,
        state: "ACTIVE",
        lineage: canonicalLineage({
          sourceCandleIds: [origin.id, shift.breakCandleId, revisit.id],
          sourceFactIds: [orderBlockId, shift.factId],
          sourceFingerprint,
          policyId: "gotrader.canonical.block.mitigation-revisit",
          policyVersion: "1.0.0"
        })
      }),
      factType: "BLOCK",
      blockId: mitigationId,
      blockType: "MITIGATION_BLOCK",
      direction: shift.direction,
      originCandleIds: [origin.id],
      ...bounds,
      midpoint: (bounds.proximalPrice + bounds.distalPrice) / 2,
      originBlockId: orderBlockId,
      structureFailureId: shift.mssId,
      conversionEventId: revisit.id
    });
  }
  return facts;
};
