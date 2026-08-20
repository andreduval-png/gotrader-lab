import type { CanonicalIctFact } from "@/lib/ictCanonical/canonicalIctTypes";

export const isCanonicalFactVisibleAt = (fact: CanonicalIctFact, marketTime: string) => {
  const marketMs = Date.parse(marketTime);
  if (!Number.isFinite(marketMs)) throw new Error(`Invalid market time: ${marketTime}`);
  return Date.parse(fact.validFrom) <= marketMs;
};

export const canonicalFactStateAt = (fact: CanonicalIctFact, marketTime: string) => {
  if (!isCanonicalFactVisibleAt(fact, marketTime)) return undefined;
  if (fact.invalidatedAt && Date.parse(fact.invalidatedAt) <= Date.parse(marketTime)) return "INVALIDATED" as const;
  return fact.state;
};

export const visibleCanonicalFactsAt = <T extends CanonicalIctFact>(facts: readonly T[], marketTime: string) =>
  facts.filter((fact) => isCanonicalFactVisibleAt(fact, marketTime));

export const assertCanonicalFactCausality = (fact: CanonicalIctFact) => {
  if (Date.parse(fact.confirmedAt) < Date.parse(fact.occurredAt)) {
    throw new Error(`${fact.factId} confirms before it occurs.`);
  }
  if (Date.parse(fact.validFrom) < Date.parse(fact.confirmedAt)) {
    throw new Error(`${fact.factId} is valid before confirmation.`);
  }
  if (fact.lineage.sourceCandleIds.length === 0) {
    throw new Error(`${fact.factId} lacks compact candle lineage.`);
  }
  return fact;
};
