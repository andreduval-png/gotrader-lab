# Liquidity Reclaim Scalper v1

- Strategy ID: `liquidity_reclaim_scalper_v1`
- Profile: `liquidity_reclaim_scalper_v1_base_research`
- Classification: experimental
- Status: research only
- Native timeframes: 15m context, 5m structure, 1m execution

The strategy is a multi-timeframe continuation scalp. It identifies an
available external-liquidity objective, requires a raid of opposite-side
liquidity, confirms displacement away from the raid and a canonical IFVG
reclaim, then emits deterministic entry, structural stop, and external target
geometry. Long and short behavior is symmetric.

It consumes Phase 2A facts and does not redefine them. It emits no fills,
orders, account actions, readiness changes, or execution. BT2 owns all fill,
intrabar, cost, and outcome semantics.
