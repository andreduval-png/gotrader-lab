# I2.1 Concurrency Preflight

Decision: `ICT_I2_1_SAFE_WITH_RESTRICTIONS`.

The isolated worktree started from accepted I2 commit `f6a489bfba7948fded2445b4a4b92faec944dfd8` and tree `121ed466b02cd1f1a0f3a40c96fe6f3afb2432a4`. The source worktree was clean.

At admission, Liquidity Reclaim Scalper R1 family-v4 owned the bounded historical-run budget (parent PID 14352 with at most one child). Free memory was approximately 3.28 GB and free disk approximately 18.89 GB. An MT5 read-only wrapper was present, but I2.1 did not call it or any historical provider. Other ICT, C1, S1, G1, BT2, and dataset worktrees were inspected and left untouched.

Allowed in this pass: source resolution, read-only certificate audit, deterministic metadata changes, focused tests, typecheck, build, and documentation. Deferred while R1 remains active: loading the 705,802-bar certified dataset, full two-year model simulations, baseline statistics, and timestamp overlap runs. No competing operator was started.

Authority remains execution `none`, broker `none`, readiness override `none`. This preflight grants no production, runtime, broker, trade-intent, order, or execution capability.
