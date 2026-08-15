# Trade Plan Outcomes Authorization

Authorized by the user on 2026-08-15 as a separate research-results integrity slice while the bounded Liquidity Reclaim Scalper R1 family remains isolated and unchanged.

## Scope

- Persist one compact, identity-bound result record for every research cycle.
- Preserve the exact research plan shown to the operator: model, direction, entry, stop, target, stated risk/reward, confidence, and deterministic trade horizon.
- Evaluate saved plans only against later closed candles from the matching canonical source, symbol, and timeframe.
- Report daily cycle counts and each cycle's plan/outcome on Results.
- Add a bounded four-week current-month review with descriptive calibration suggestions.

## Required Semantics

- A stop hit is not a false positive.
- No entry means `not_triggered`, not a loss.
- A plan without coherent directional geometry remains `not_evaluable`.
- A candle touching stop and target after entry is `ambiguous_stop_first` and uses the conservative stop result.
- Open plans remain `pending`; expired plans remain distinct from passed and failed plans.
- Planned points and realized points are reported separately.
- Raw candles, account data, orders, positions, and execution intent are never persisted.
- Calibration suggestions are descriptive and cannot mutate strategy parameters or readiness.

## Authority

- `executionAuthority: none`
- `brokerAuthority: none`
- `readinessOverrideAuthority: none`

This slice does not authorize strategy execution, Paper Demo, runtime adoption, broker mutation, readiness advancement, or any change to the running R1 family.
