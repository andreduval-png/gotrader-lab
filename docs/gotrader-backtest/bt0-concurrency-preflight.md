# BT0 Concurrency Preflight

Date: 2026-08-07 (America/New_York)

## Decision

`BT0_SAFE_WITH_RESTRICTIONS`

BT0 can perform source/documentation forensics and deterministic local tests in an isolated worktree. It must not use live MT5, bind GoTrader ports, start browsers, run deep historical jobs, use shared browser/runtime state, or run workloads likely to perturb the scheduled B1.2 operational canary.

## Active And Scheduled Work

The active operational program is B1.2 on `codex/gotrader-b1-2-authorized` at `441188ac9890c99493b8737691b5e8af4b32f97a`. Its replacement four-hour observer may start Monday 2026-08-10 only between 14:30 and 15:30 America/New_York. No B1.2 observer or target runtime was running during this preflight. The automation `monitor-b1-2-canary` remains active and was not edited by BT0.

Observed processes included MT5 Desktop (`terminal64.exe`, PID 30356), read-only trade-proposal MCP Node processes from `gotrader-mcp-hardening`, GBrain research-memory MCP Node processes from `gotrader-gbrain-g3-acceptance`, and unrelated preview/Python services. BT0 did not terminate or reconfigure any process. No listener was found on GoTrader target ports `8000`, `7341`, `7343`, `7344`, `7345`, or `8799`. A 20-minute scan found no active writes below shared `.gotrader` paths. Disk free space was approximately 24.45 GB.

## Worktree Inventory

| Worktree | Branch | HEAD | State / inferred purpose |
|---|---|---|---|
| `gotrader` | `local-restart-safety-check-2` | `1489b873` | Dirty main development tree; prohibited for BT0 |
| `gotrader-backtest-bt0` | `codex/gotrader-backtest-bt0-audit` | `01c9221b` | Clean isolated BT0 tree at creation |
| `gotrader-runtime-track-b1-2-authorized` | `codex/gotrader-b1-2-authorized` | `441188ac` | Clean active B1.2 canary candidate |
| `gotrader-runtime-track-b1-plan` | `codex/gotrader-infrastructure-track-b1-planning` | `01c13aa4` | Clean B1 planning |
| `gotrader-runtime-track-b1-0` | `codex/gotrader-runtime-freeze-baseline` | `01c9221b` | Clean frozen architecture baseline; BT0 base |
| `gotrader-runtime-track-b1-0-authorized` | `codex/gotrader-b1-0-authorized` | `25b2c1a` | Clean B1.0 authorization |
| `gotrader-runtime-track-b1-1-authorized` | `codex/gotrader-b1-1-authorized` | `92da83b` | Clean B1.1 authorization |
| `gotrader-runtime-track-a3` | `codex/gotrader-infrastructure-track-a3-2` | `e605c10` | Clean A3 qualification history |
| `gotrader-runtime-track-a3-break-fix` | `codex/a3-2-fail-closed-break-observer` | `268ca2f` | Clean A3 observer correction |
| `gotrader-runtime-track-a1` | `codex/gotrader-infrastructure-track-a1` | `d1d47b5` | Clean A1 history |
| `gotrader-runtime-track-a2` | `codex/gotrader-infrastructure-track-a2` | `f6645b9` | Clean A2 history |
| `gotrader-gbrain-g3-acceptance` | `codex/gotrader-gbrain-g3-acceptance` | `7b8853c` | Dirty only in GBrain runbook; active MCP owner |
| `gotrader-gbrain-integration` | `codex/gotrader-gbrain-integration` | `29ae356` | Dirty only in GBrain runbook |
| `gotrader-gbrain-sidecar` | `codex/gbrain-sidecar` | `64b8a67` | Clean sidecar |
| `gotrader-mcp-hardening` | `codex/mcp-hardening` | `65849d1` | Clean; active read-only MCP owner |
| `gotrader-v2-phase0-baseline` | `codex/gotrader-v2-phase-3f-ifvg-evidence` | `dadee75` | Dirty documentation-only Phase 3 tree |
| `gotrader-bundle-import-cycle-cleanup` | `codex/gotrader-bundle-import-cycle-cleanup` | `56f24df` | Clean cleanup tree |
| `gotrader-ifvg-v3-isolation` | `codex/ifvg-v3-isolation` | unborn | Dirty isolated experiment; prohibited |

A stale/prunable temporary worktree entry also existed at `C:/Users/andre/AppData/Local/Temp/gotrader-forward-scenario`; BT0 did not prune it.

## Shared-State And Resource Assessment

- BT0 uses `C:/Users/andre/OneDrive/Documents/gotrader-backtest-bt0`, not a runtime, B1, GBrain, or dirty main tree.
- Audit tests may create ignored temporary files only below this isolated worktree's `.gotrader` directory.
- No IndexedDB, localStorage, Chromium profile, shared historical dataset, runtime checkpoint, event ledger, scheduler state, time artifact, or GBrain sidecar is used.
- Dependency installation used the lockfile and `--ignore-scripts`; it did not start services.
- Tests are sequential and deterministic. Deep history, browser automation, live MT5 probes, Python bridge startups, and high-parallelism suites are deferred.
- The existing MT5 and MCP processes remain untouched. Port ownership is non-overlapping.

## Isolation Record

Worktree: `C:/Users/andre/OneDrive/Documents/gotrader-backtest-bt0`

Branch: `codex/gotrader-backtest-bt0-audit`

Base: frozen architecture baseline `01c9221b1c572237993ecb747bdfe4747de0a9ac`

Governance basis: `architecture-index.md`, `architecture-roadmap.md`, and `architecture-change-control.md`. B1.4 remains future work gated by verified historical time authority. BT0 does not redefine B1.4 or change authority.

## Deferred Probes

- Two-year MT5 range retrieval and paging experiments
- Broker symbol-property queries for digits, point, pip convention, tick value, and contract size
- Browser/IndexedDB/localStorage smoke tests
- Memory profiling of multi-year object graphs
- Live CPU, I/O, and MT5 latency load tests
- Any listener, supervisor, scheduler, feed, observer, or GBrain startup

These require a fresh concurrency preflight after the B1.2 operational task is complete.
