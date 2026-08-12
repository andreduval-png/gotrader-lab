# BT2 Architecture And Concurrency Authorization

Date: 2026-08-12

Branch: `codex/gotrader-backtest-bt2-architecture`

Parent BT1.6 acceptance: `d263ce2e81c4137d3e4bfd84b6230135e2dffcf8`

Qualified dataset certificate:
`sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`

Qualified registry:
`sha256:ec877c21a370699094ed856d2419712f561dc8f3ef23350559c6985a9df4c9eb`

## Decision

```text
ACC-BT2-CANONICAL-SIMULATION
APPROVED FOR ISOLATED IMPLEMENTATION
```

BT2 may implement canonical opportunity contracts, deterministic order/fill
lifecycle, conservative intrabar and gap policies, versioned cost plumbing,
immutable simulation records and ledgers, and resumable fixture-backed jobs.
It may consume compact qualified BT1.6 certificate and registry identities.

This approval does not authorize strategy adapters or migration, parameter
search, performance/statistical analysis, walk-forward, Monte Carlo,
risk/portfolio simulation, B1.3/B1.4 activation, Paper Demo, production,
broker mutation, order placement, or execution.

## Ownership

| Component | Owns | Excludes |
| --- | --- | --- |
| BT1/BT1.6 | Historical candles, time/symbol policies, dataset certificate | Opportunities and outcomes |
| Causal fact boundary | As-of facts and closed-candle availability | Future candles and fills |
| Strategy adapter (BT3) | Frozen detector/profile to native opportunity | Costs, outcomes, sizing |
| BT2 opportunity contract | Immutable decision time, order intent, geometry, blockers | Strategy selection and readiness |
| BT2 simulator | Activation, fill, ambiguity, gaps, exits, costs, excursions | Parameter selection and portfolio sizing |
| BT2 storage | Immutable opportunity/trade records, seals, checkpoints | Raw candle duplication |
| Later analytics | Metrics over sealed BT2 ledgers | Rewriting BT2 outcomes |

## Concurrency Preflight

Verdict: `BT2_ARCHITECTURE_SAFE_WITH_RESTRICTIONS`.

- the parent worktree is clean at the accepted BT1.6 commit;
- no historical ingestion or bounded-resume operator is running;
- MT5 upstream and bridge remain healthy read-only services on ports 8000 and
  7341 and are not contacted by architecture work;
- unrelated GBrain and proposal MCP services remain untouched;
- the primary dirty worktree and every runtime worktree remain untouched;
- this phase requires no server, browser, MT5 query, or raw candle access.

Implementation restrictions:

1. Work only in the isolated BT2 worktree.
2. Use deterministic fixtures or an explicitly supplied read-only BT1
   repository; never copy raw candles into Git or BT2 ledgers.
3. Do not import or call legacy strategy engines during the contract stage.
4. Do not mutate frozen profiles, manifests, BT1.6 artifacts, or runtime state.
5. Every job remains strategy-neutral, offline, bounded, and restartable.
6. Any missing identity, future-data access, ambiguity-policy gap, unsupported
   cost, or immutable conflict fails closed.

## Authority

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
canCreateTradeIntent: false
canPlaceOrder: false
canApproveReadiness: false
canApplyCalibration: false
```

## Implementation Gate

BT2 Stage 1 is authorized: types, canonical identities, pure simulation state
machine, in-memory/filesystem fixture storage, and deterministic tests. Stage 2
dataset-backed shadow simulation requires Stage 1 acceptance and a fresh
concurrency/resource preflight. BT3 remains unauthorized until BT2 passes its
full acceptance matrix.

## Completion Record

BT2 Stages 1 and 2 subsequently passed the full acceptance matrix. Stage 2 is
sealed by implementation commit `831044a1d9c532df47d247e1eb435bd7d3302200`,
experiment `sha256:3bbfa92a97255c25b04eaf9f00586bcee306aec9a680d2390fcd1f29c1771fd8`,
and ledger `sha256:ad063ea4b036a19df95601a16ec5855be25333bea354e1b98ea6e7194760f52b`.

This closes `ACC-BT2-CANONICAL-SIMULATION` as accepted. BT3 remains
unauthorized pending a separate architecture and concurrency decision.
