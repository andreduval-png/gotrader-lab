# GoTrader V2 Phase 2A.5 Shadow Displacement and FVG Facts

## Boundary

Phase 2A.5 extends the shadow canonical market context with deterministic M5 displacement and fair-value-gap lifecycle facts. These facts describe closed price action. They do not choose entries, stops, targets, strategy lanes, evidence, readiness, Paper-Demo status, or execution.

No existing ICT detector threshold changes. No production detector consumes these facts in this phase.

## Displacement Policy

A displacement fact requires:

- ten prior closed M5 candles;
- a non-doji directional candle;
- body size at least `1.6x` the mean body of those ten prior candles;
- a positive full candle range;
- one later closed M5 candle before final classification.

The `1.6x` threshold mirrors the existing legacy helper default, but the V2 policy requires an exact ten-candle baseline instead of silently using a shorter or current-candle fallback.

The one-bar classification delay is deliberate. It allows `leavesFvg` to be set only after the third candle of a possible imbalance is closed. The displacement fact records both its impulse candle time and the later causal observation time.

Measured fields include body size, full range, body-to-range ratio, baseline value, displacement multiple, structure close-through, and FVG formation. They are observations, not confidence or trade scores.

## Structural Lineage

When session liquidity facts are requested, a displacement records `closesThroughStructure: true` only when its close strictly crosses a causally available pool in its direction:

- bullish close strictly above buy-side liquidity;
- bearish close strictly below sell-side liquidity.

Only pool facts observed no later than the displacement close may participate. Their fact IDs are preserved in derivation lineage. Missing liquidity facts do not create a private substitute structure model.

## Fair Value Gap Formation

FVG formation uses the strict three-candle ICT geometry already used by GoTrader:

- bullish: candle one high is strictly below candle three low;
- bearish: candle one low is strictly above candle three high.

Zero-width gaps do not exist. Formation is not known until candle three closes. A matching displacement fact is referenced when the middle candle passes the displacement policy, but displacement is not required merely to record an observed gap.

## Exclusive Lifecycle

Every FVG emits exactly one current lifecycle state:

- `fresh`: no later contact;
- `touched`: exact outer-boundary contact;
- `partially_filled`: price enters the gap without reaching the far boundary;
- `filled`: the far boundary is reached without a strict close through it;
- `inverted`: a later candle closes strictly through the far boundary.

Lifecycle progression is monotonic. The fact's observation time is the closed candle that established its current state. `invalidated` remains reserved; Phase 2A.5 does not invent a separate invalidation policy.

An inverted FVG remains one FVG fact with state `inverted`. This phase does not emit a separate IFVG candidate, retest, or trade model. IFVG strategy adaptation remains a later compatibility phase.

## Causality and Identity

- inputs are closed canonical M5 candles;
- requested families and policy versions participate in context identity;
- displacement may reference causally available liquidity-pool facts;
- FVG facts may reference their matching displacement fact;
- provider receive time, build time, UI state, random IDs, and raw arrays are excluded;
- equivalent inputs reproduce identical context and fact IDs.

## Safety and Adoption

```text
shadowOnly: true
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

No Current Read, Advisor, strategy, research cycle, replay, walk-forward, validation, evidence, readiness, Paper-Demo, broker, or execution path consumes Phase 2A.5 facts.
