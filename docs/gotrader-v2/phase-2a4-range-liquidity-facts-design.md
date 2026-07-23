# GoTrader V2 Phase 2A.4 Shadow Dealing-Range and Liquidity Facts

## Boundary

Phase 2A.4 extends the shadow canonical market context with session-scoped dealing ranges, session-high/session-low liquidity pools, and strict post-confirmation liquidity breaches. It does not choose trades, targets, entries, stops, strategy lanes, or readiness.

The engine intentionally does not infer a global swing dealing range. Global and setup-local ranges require separately versioned anchor policies. This phase uses only the exact session facts established in Phase 2A.3.

## Dependencies

Requests are explicit through `requestedFactFamilies`:

- `dealing_range` requires `session`;
- `liquidity` requires `session`;
- source session facts require an eligible closed-candle M5 window.

Missing dependencies block the context. The engine never calculates a private substitute session or range.

## Session Dealing Range

For each available session fact:

- low and high come directly from the session fact;
- equilibrium and midpoint are `(low + high) / 2`;
- premium spans equilibrium through `premiumBoundary` at the session high;
- discount spans `discountBoundary` at the session low through equilibrium;
- direction is bullish, bearish, or neutral from session open to session close;
- the source session fact ID is preserved as the anchor;
- incomplete sessions may emit an explicitly degraded range with `complete: false`.

This is a session range, not a claim that the session produced a complete ICT A-B swing dealing range.

## Liquidity Pools

A session high and low become liquidity pools only after that session is complete and eligible:

- session high: `buy_side`;
- session low: `sell_side`;
- confirmation time: exact session end;
- tolerance policy: strict numeric comparison;
- lifecycle: `active`, `touched`, or `swept`.

An incomplete session cannot create a pool. Equal-price contact is a touch. A strict breach beyond the level is a sweep. Later facts are derived only from candles that open at or after pool confirmation and close no later than context `asOfMarketTime`.

## Liquidity Sweep

The first strict post-confirmation breach creates a compact sweep fact:

- pool fact reference;
- side and pool price;
- breach extreme and candle time;
- whether the candle closed back inside;
- `confirmed` when it closed back inside, otherwise `wick_through`.

Displacement follow-through is intentionally absent in Phase 2A.4. A raw liquidity event cannot claim model-quality confirmation before the displacement engine exists.

## Causality and Identity

- all inputs are closed canonical candles;
- range facts reference their causal session facts;
- pool facts reference their source session facts;
- sweep facts reference their pool facts;
- requested families and policy versions participate in context identity;
- raw candles, build time, UI state, and random IDs are excluded;
- equivalent inputs reproduce identical context and fact IDs.

## Safety and Adoption

```text
shadowOnly: true
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

No production strategy, Current Read, research cycle, validation chain, evidence, readiness, Paper-Demo, broker, or execution path consumes these facts.
