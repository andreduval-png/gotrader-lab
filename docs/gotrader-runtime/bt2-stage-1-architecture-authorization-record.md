# BT2 Stage 1 Architecture Authorization Record

Date: 2026-08-12

BT2 architecture commit: `c056a017ec9d5509ecd9ac614cb2bbe0797d7753`

Parent BT1.6 acceptance: `d263ce2e81c4137d3e4bfd84b6230135e2dffcf8`

## Decision

```text
ACC-BT2-CANONICAL-SIMULATION
STAGE 1 ISOLATED IMPLEMENTATION AUTHORIZED
```

BT2 Stage 1 may implement strategy-neutral canonical opportunity and simulation
contracts, deterministic pure lifecycle logic, immutable fixture storage,
checkpoint/restart behavior, and tests in the isolated
`codex/gotrader-backtest-bt2-architecture` branch.

It may bind compact BT1.6 identities:

- certificate: `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`;
- registry: `sha256:ec877c21a370699094ed856d2419712f561dc8f3ef23350559c6985a9df4c9eb`.

No runtime automatically consumes BT2 output. Raw candles remain outside Git
and runtime ledgers. Stage 2 dataset-backed shadow simulation requires Stage 1
acceptance and a new safe preflight.

## Exclusions

BT3 strategy adapters, B1.3/B1.4 activation, search, analytics, statistics,
walk-forward, Monte Carlo, risk/portfolio, evidence, readiness, Paper Demo,
production, broker mutation, and execution remain unauthorized.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```
