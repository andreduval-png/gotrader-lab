# Draft ACC-BT-B1.4 Change-Control Record

Status: `DRAFT_NOT_ADOPTED`

Parent frozen architecture baseline: `01c9221b1c572237993ecb747bdfe4747de0a9ac`

Proposed title: `ACC-BT-B1.4: Canonical Backtest Subsystem Boundary, Governed Search, And B1.4 Orchestration Contract`

This record is a BT0 recommendation only. It does not modify `docs/gotrader-runtime/architecture-index.md` or `docs/gotrader-runtime/architecture-roadmap.md`, authorize BT1+, activate B1.4, download deep history, or grant evidence, readiness, calibration, broker, production, or execution authority.

## Reason

The frozen roadmap defines B1.4 as resumable historical replay/walk-forward after historical-time authority. BT0 found that a valid two-year program also needs a reusable canonical dataset/simulation subsystem, immutable experiment families and trial ledgers, statistically governed parameter search, null/ablation services, cold-instrument isolation, and one-way holdout state. Putting those semantics directly inside B1.4 would couple B1 governance to engine internals and repeat existing fragmented ownership.

## Proposed Boundary

- The canonical backtest subsystem owns historical datasets, as-of facts, strategy adapters, opportunity/trade ledgers, execution/cost simulation, analytics, parameter schemas, search plans, statistical validation, nulls, ablations, era/cold runs, holdout state, checkpoints, and sealed reports.
- B1.4 owns explicit authorization, compact job requests, scheduling policy, request/artifact lineage, cancellation, and compact result consumption through sealed B1 research contracts.
- UI and GBrain read compact projections only. Browser storage is never authoritative.
- Risk/portfolio simulation consumes immutable trade-ledger seals and cannot mutate strategy results.

## Proposed Frozen-Roadmap Wording

The following text is proposed for a later approved edit; it is not applied by BT0.

Table row deliverable:

```text
B1.4 | B1.3, historical time authority, approved ACC-BT-B1.4 |
authorized orchestration of canonical resumable historical research jobs |
not_started | blocked
```

Section replacement:

```text
### B1.4 - canonical historical research orchestration

After historical time/DST authority and ACC-BT-B1.4 acceptance, orchestrate
explicit resumable jobs through sealed canonical backtest-subsystem contracts.
B1.4 owns authorization, scheduling, request/artifact lineage, and compact
result consumption; the subsystem owns datasets, simulation, governed search,
statistics, and holdout state. Deep history is never a live-close or page-load
side effect. All authority remains none/none/none.
```

## Proposed BT Program Detail

Preserve top-level BT0-BT9. Add these gated subphases to the backtest implementation plan:

- `BT3A` strategy parameter schemas;
- `BT4A` canonical metrics and experiment hierarchy;
- `BT4B` statistical correction, nulls, and ablation;
- `BT5A` era and cold-instrument validation;
- `BT5B` sealed holdout governance;
- `BT8A` large-scale search operations.

The proposed order is BT3 -> BT3A -> BT4 -> BT4A -> BT4B -> BT5 -> BT5A -> BT5B -> BT6, with BT7 consuming BT4 outputs, BT6/BT7 converging at BT8, then BT8A -> BT9.

## Canonical Interfaces And Artifacts

- `HistoricalDatasetManifest`
- `ParameterSchema`
- `BacktestExperimentManifest`
- `ExperimentFamilyLedger`
- `CanonicalOpportunity`
- `TradeSimulationRecord` and `TradeLedgerSeal`
- `ValidationPlan`
- `AnalyticsReport` and `StatisticalValidationReport`
- `HoldoutSeal`
- `RiskPortfolioExperiment`
- `JobCheckpoint`

All are canonically hashed, immutable after seal, atomically finalized, and linked to parent identities and source commit.

## Required Gates

1. Historical MT5 provider time, DST, maintenance calendar, and symbol/point/pip contracts accepted.
2. Adapter causal invariance and legacy parity accepted family by family.
3. Parameter schemas distinguish detector reruns, post-filters, geometry, execution, costs, and risk.
4. Every attempted search trial is retained; search breadth, seeds, budgets, and stopping rules are immutable.
5. Canonical net-daily-return Sharpe, complete funnel, corrected significance, constrained nulls, ablations, neighborhoods, eras, and cold-instrument state pass deterministic fixtures.
6. Holdout state is one-way `sealed -> unlocked -> consumed`; no reset or retune path exists.
7. Restart/resume, bounded time/memory/disk/workers, deterministic parallel order, artifact tamper, and compatibility tests pass.
8. Authority remains `none/none/none`; historical results cannot create evidence, approve readiness, apply calibration, create trade intent, or enable production/execution.

## Migration And Rollback

Legacy engines remain readable and behaviorally frozen. Each family migrates adapter-first against identified fixtures with IFVG v2 as negative control and IFVG v3 as positive canary. Unexplained opportunity, geometry, blocker, fill, cost, or outcome differences block adoption. Rollback disables B1.4 requests and leaves both legacy and canonical artifacts read-only; it never edits or deletes failed research evidence.

## Approval Needed

Adoption requires an explicit architecture change-control decision against the frozen baseline, exact edits to the Architecture Index/roadmap, an authorized implementation branch, and phase-specific acceptance criteria. BT0 supplies the proposal and evidence only.
