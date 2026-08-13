# Baseline Backtest Report

- Status: bounded fixture baseline only
- Dataset certificate: `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`
- Dataset: `sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d`
- Profile: `liquidity_reclaim_scalper_v1_base_research`
- Parameter optimization: not run
- Research validated: false

The bounded deterministic baseline covers one long and one short geometry plus
BT2 conservative same-bar ambiguity. It proves integration, not performance.
The two-year descriptive baseline is deferred because current memory headroom is
low and shared runtime services are active. No historical operator was started.

Setup/trade performance metrics are therefore `not_measured`. It would be
misleading to publish win rate, expectancy, profit factor, drawdown, annualized
frequency, or session/month/year splits from contract fixtures.
