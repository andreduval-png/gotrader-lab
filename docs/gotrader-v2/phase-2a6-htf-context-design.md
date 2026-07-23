# GoTrader V2 Phase 2A.6 Shadow Higher-Timeframe Context

## Boundary

Phase 2A.6 adds deterministic directional context facts for explicit M15, H1, H4, D1, and W1 canonical candle windows. Each fact describes one timeframe independently. It does not classify setup alignment, select a strategy, construct a trade, create evidence, change readiness, or authorize Paper-Demo or execution.

No production Current Read, Advisor, detector, replay, walk-forward, readiness, broker, or execution path consumes these facts in this phase.

## Explicit Window Policy

The engine recognizes only these canonical V2 timeframes:

- `15m`;
- `1h`;
- `4h`;
- `1d`;
- `1w`.

Every fact must reference the identity hash of its own explicit input window. Missing required windows remain context blockers. D1 cannot create W1, H1 cannot create H4, and lower timeframes cannot fill any missing higher timeframe.

The initial policy uses the last five closed candles from each explicit window. Five is fixed in the policy so direction does not change merely because a caller requests a larger history window.

## Direction Policy

For each complete five-candle sample:

1. calculate return from the first candle open to the latest candle close;
2. classify bullish at or above `+0.10%`;
3. classify bearish at or below `-0.10%`;
4. otherwise classify neutral;
5. compare the latest close with the prior four-candle high/low range.

Confidence is:

- `high` when a bullish or bearish return also closes through the corresponding prior four-candle extreme;
- `medium` when the directional return threshold passes without that close-through;
- `low` for a complete neutral sample;
- `insufficient` when fewer than five closed candles exist.

The compact `basis` records the fixed lookback, measured return, threshold, and structure state. It contains no candle arrays.

## Missing and Shallow Data

- A missing timeframe listed in `requiredTimeframes` blocks the context through the existing eligibility policy.
- A present window with one to four closed candles emits an `insufficient_data` fact.
- That fact is incomplete and degraded, with a compact warning showing the observed and required candle counts.
- A request with no explicit supported HTF window is blocked by the fact engine.

Shallow W1 data remains shallow even when D1 is present. This intentionally differs from legacy compatibility behavior that may derive weekly candles from daily history.

## Causality and Identity

- only closed canonical candles participate;
- `observedMarketTime`, `causalClosedCandleTime`, and `validFrom` equal the latest participating candle close;
- the requested fact family and its policy version participate in context identity;
- facts preserve their exact source-window identity hash;
- equivalent windows produce stable fact and context IDs regardless of request ordering;
- raw candles, provider payloads, runtime snapshots, and operational build time are excluded.

## Safety

```text
shadowOnly: true
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

These facts are context observations only. A later compatibility phase must explicitly compare them with legacy HTF behavior before any strategy adoption.
