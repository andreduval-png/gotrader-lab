# BT1 Architecture And Concurrency Authorization

Date: 2026-08-07

Branch: `codex/gotrader-backtest-bt1-dataset-foundation`

Parent BT0 commit: `a2d99ec5f39d81f0f386bdd81467ce4550b65b23`

Frozen architecture baseline: `01c9221b1c572237993ecb747bdfe4747de0a9ac`

## Architecture Decision

```text
ACC-BT-B1.4
APPROVED
```

Approved title: `ACC-BT-B1.4: Canonical Backtest Subsystem Boundary, Governed Search, And B1.4 Orchestration Contract`

The approval adopts the architectural boundary proposed by BT0. It authorizes BT1 dataset-foundation implementation in this isolated branch. It does not activate B1.4 or authorize BT2, strategy migration, trade simulation, parameter search, optimization, statistics execution, Monte Carlo, risk/portfolio simulation, evidence, readiness, GBrain mutation, broker operations, production adoption, or execution.

## Decision Questions

1. **Does BT0 justify a new canonical subsystem?** Yes. Dataset/time identity, immutable storage, restartability, execution semantics, statistics, and later risk ownership require one coherent historical boundary.
2. **Can existing historical engines reasonably evolve into it?** No without retaining several incompatible sources of truth. Existing engines are useful adapter/fixture inputs, not a suitable canonical repository.
3. **Would incremental refactoring create excessive technical debt?** Yes. It would preserve browser authority, random run identity, inconsistent time/unit/cost contracts, incompatible result schemas, and duplicated restart behavior.
4. **Does the proposed architecture preserve existing governed systems?** Yes. B1 remains the authorized orchestrator/lineage consumer; Phase 2A and Phase 3 identities remain immutable adapter inputs; GBrain remains optional derived memory; strategy hashes remain frozen; all authority remains `none/none/none`.

## Approved Ownership

- BT1 historical subsystem owns historical source adapters, immutable partitions, normalization, integrity ledgers, dataset identity/manifests, symbol/time policy snapshots, derived-timeframe lineage, checkpoints, verification, and historical-OHLC storage.
- B1/B1-L1 receives compact external-authoritative dataset references and relationships. It does not copy raw candles, recalculate dataset identity, or own historical storage.
- B1.4 may later orchestrate explicit canonical historical jobs only after its own prerequisites. It does not own dataset/simulation/statistical internals.
- Existing replay/backtest implementations remain frozen and readable until later adapter parity and adoption decisions.

## Compatibility And Rollback

- No runtime, strategy, Phase 2A/3, GBrain, Native Evidence, readiness, or broker path consumes BT1 automatically.
- BT1 writes only to an explicitly supplied isolated historical root; it never writes runtime, research-memory, GBrain, Native Evidence, or browser storage.
- Failure or rollback disables BT1 callers and leaves sealed datasets read-only. Existing engines and runtime behavior remain unchanged.
- Any incompatible source, time, symbol, checksum, or lineage input fails closed and creates no replacement identity.

## Concurrency Preflight

Verdict:

```text
BT1_SAFE_WITH_RESTRICTIONS
```

Observed state:

- the primary `gotrader` worktree is heavily dirty and must not be touched;
- the committed BT0 worktree is clean at `a2d99ec`;
- B1.2 is clean at candidate `441188ac9890c99493b8737691b5e8af4b32f97a`, stopped, and has an active Monday canary automation;
- no B1.2 observer, GoTrader runtime supervisor, MT5 bridge/upstream, Playwright process, or deep-history job is running;
- MT5 Desktop PID 30356 is open and is not touched by BT1 under this preflight;
- unrelated read-only GBrain/MCP helper processes are active in their own worktrees;
- port 4173 is owned by an unrelated `preview/server.mjs`; ports 7341, 7343, 7344, 7345, and 8000 are free;
- approximately 24.8 GB is free on drive C;
- no authoritative BT1 historical dataset root exists yet.

Restrictions:

1. Work only in `gotrader-backtest-bt1-dataset-foundation`.
2. Do not start or stop MT5, B1.2, runtime, GBrain, MCP, preview, or browser processes.
3. Do not use port 4173 or run browser tests.
4. Do not run a live/deep MT5 historical download during this implementation turn.
5. Use fixture-backed providers and temporary isolated dataset roots for validation.
6. Do not read or write another worktree's `.gotrader`, runtime ledgers, observations, storage, or datasets.
7. Preserve the Monday B1.2 automation and exact candidate unchanged.

## Authority

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
canCreateEvidence: false
canApproveReadiness: false
canApplyCalibration: false
canCreateTradeIntent: false
```

## Authorized Scope

BT1 may now implement and validate the deterministic historical dataset foundation, identity/manifests, explicit time verification state, symbol normalization snapshots, deterministic timeframe derivation, integrity checks, checkpoints/resume, and B1-L1 external-reference lineage. BT2 remains blocked.
