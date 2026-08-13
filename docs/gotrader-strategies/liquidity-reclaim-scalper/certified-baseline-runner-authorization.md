# Certified Baseline Runner Authorization

Authorization is limited to implementing and validating a bounded, restartable,
descriptive two-year baseline runner for the exact accepted Liquidity Reclaim
Scalper v1 strategy and base research profile.

Bound identities:

- Parent HEAD: `4cbcc2863427dc01e330199362880cea69071a01`
- Strategy: `liquidity_reclaim_scalper_v1`
- Profile: `liquidity_reclaim_scalper_v1_base_research`
- Parameter hash: `sha256:c58d3a0aaff9ba61ece6ea0df2d76145059be36cab9f2347a66a0e6da642f748`
- Dataset certificate: `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`
- Dataset: `sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d`
- Range: `2024-08-01T00:00:00Z` through `2026-08-01T00:00:00Z`

The runner must be causal, deterministic, single-worker, bounded in memory and
storage, checkpointed, restartable, and fail closed on identity mismatch. BT2
retains ownership of fills, costs, expiry, and intrabar ambiguity. Raw candles
must never be committed.

This authorization excludes parameter mutation, optimization, R1, Paper Demo,
runtime adoption, production, broker mutation, trade intent, order placement,
and execution. Authority remains `none / none / none`.
