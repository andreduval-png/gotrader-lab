# GoTrader V2 Phase 2A.3 Shadow Session and Opening-Price Facts

## Boundary

Phase 2A.3 adds deterministic session and opening-price facts to the shadow V2 canonical market context. Fact generation is explicit: callers must request `session`, `opening_price`, or both through `requestedFactFamilies`. A request that omits fact families preserves the Phase 2A.0 zero-fact behavior.

The implementation remains inside `src/lib/v2`. It has no production strategy, Current Read, research-cycle, validation-chain, evidence, readiness, Paper-Demo, broker, or execution consumer.

## Input Contract

- one eligible canonical `5m` closed-candle window;
- explicit requested and broker symbol identity;
- explicit source fingerprint and context purpose;
- a causal `asOfMarketTime` boundary;
- current-live MT5 inputs must already pass the Phase 1.7A time contract and Phase 2A.1 offset-regime eligibility checks.

The engine performs no network, storage, MT5, UI, strategy, or broker operation. Raw candles stay inside the builder call and are not serialized into context facts.

## Session Policy

All boundaries use `America/New_York` wall-clock time and are converted to UTC with daylight-saving awareness.

| Fact | New York window |
|---|---|
| Asia | 20:00 on the previous calendar date through 00:00 on the trading date |
| London | 02:00 through 05:00 |
| New York AM | 09:30 through 12:00 |
| New York Lunch | 12:00 through 13:30 |
| New York PM | 13:30 through 16:00 |

A complete session requires the exact first boundary candle, closed-candle coverage through the exact end boundary, and the expected M5 candle count. A started but incomplete session emits a degraded fact. An ended session with no usable candles emits an explicit warning rather than a fabricated fact.

## Opening-Price Policy

Implemented opening facts are:

- Sunday 18:00 New York;
- 00:00 New York;
- 09:30 New York.

Each opening price must come from the candle whose open time exactly matches the boundary. Missing boundaries emit `opening_price_unavailable:<type>`. The engine never substitutes the first later candle or an operator-supplied value. Daily and weekly opening payload variants remain reserved and unimplemented.

## Causality and Identity

- facts become observable only at the source candle close;
- session facts use the last included closed candle as their causal time;
- fact IDs hash the source identity, compact payload, causal time, policy ID, policy version, and authority;
- requested fact families and policy versions participate in context identity;
- build time, raw candles, provider receive time, UI state, and random IDs do not participate;
- rebuilding the same inputs produces the same context and fact IDs.

## Failure Policy

- missing or blocked M5 input blocks requested session/opening fact generation;
- partial session coverage degrades the context;
- a missing exact opening candle degrades the context and omits that fact;
- unsupported fact-family requests block the context;
- no warning can be converted into favorable market evidence.

## Safety

```text
shadowOnly: true
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

No fact creates a signal, trade geometry, evidence, readiness, Paper-Demo eligibility, or execution intent.
