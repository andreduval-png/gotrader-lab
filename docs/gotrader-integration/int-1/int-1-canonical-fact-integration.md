# INT-1 Canonical Fact Integration

INT-1 integrates the I1 fact foundation required by the current runtime: swing, liquidity, FVG, IFVG linkage, displacement, MSS, dealing range, premium/discount location, and session facts.

Facts retain `occurredAt`, `confirmedAt`, and `validFrom`. Actionable consumption requires `validFrom <= asOf`; facts confirmed after the requested read are unavailable. `test:ict-canonical-facts` proves a future candle appended after a fixed `asOf` cannot alter the snapshot.

This is a dependency-safe minimum. Later I2-I7 fact consumers are not advertised as primary runtime integrations.
