# BT2 Final Acceptance Report

Date: 2026-08-12

Branch: `codex/gotrader-backtest-bt2-architecture`

Architecture commit: `c056a017ec9d5509ecd9ac614cb2bbe0797d7753`

Stage 1 commit: `6cc2644e14aa9507b337eca8f210cbd729e35539`

Stage 2 implementation commit: `831044a1d9c532df47d247e1eb435bd7d3302200`

## Acceptance

BT2 now provides a strategy-neutral canonical opportunity contract, pure
deterministic trade simulator, explicit ambiguity and cost policies, immutable
records and ledger seals, durable checkpoints, and a bounded read-only harness
over the qualified BT1.6 repository.

The complete acceptance matrix passed:

- exact BT1.6 certificate, registry, dataset, and manifest binding;
- rejection of tampered or unqualified input;
- causal closed-candle timing and future-append invariance;
- deterministic opportunity, record, checkpoint, and ledger identities;
- long/short, gap, fill, expiry, insufficient-data, ambiguity, excursion, and terminal-state coverage;
- separated gross return, cost, net return, price, point, and R units;
- identical uninterrupted and controlled-interruption/resumed ledger seals;
- bounded one-worker, three-partition dataset-backed execution;
- immutable conflict and corrupt-checkpoint rejection;
- zero raw candle payloads in compact artifacts or Git;
- no MT5 contact, strategy adapter, profile mutation, readiness, broker, or execution authority.

Accepted dataset-backed identities:

- experiment: `sha256:3bbfa92a97255c25b04eaf9f00586bcee306aec9a680d2390fcd1f29c1771fd8`;
- ledger: `sha256:ad063ea4b036a19df95601a16ec5855be25333bea354e1b98ea6e7194760f52b`;
- uninterrupted report: `sha256:491744e93efcd33f0d81d62cbe05826eefdd191e2120e4a6fbd4f6de2fb74313`;
- resumed report: `sha256:baf7bcdc20e2e8c3d4aa90ff595dbccb4a9d7cfc96fc090e5c43f6491ab9fb29`.

Validation passed `test:bt2`, `typecheck`, complete BT1 and BT1.6 suites,
build, Node syntax, source-integrity/provenance/safety checks, and
`git diff --check`. Existing non-failing Rollup circular-export and chunk-size
warnings remain unchanged.

## Decision

```text
BT2 ACCEPTED
CANONICAL OFFLINE TRADE SIMULATION FOUNDATION COMPLETE
```

```text
BT3 UNAUTHORIZED
```

BT2 acceptance does not establish strategy fidelity or trading performance.
BT3 requires a separate architecture and concurrency authorization before any
frozen strategy adapter or parity work begins. Analytics, optimization,
statistics, walk-forward, risk, portfolio, Paper Demo, production, broker
mutation, and execution also remain unauthorized.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```
