# BT1.6 Final Acceptance Report

Date: 2026-08-07

Branch: `codex/gotrader-backtest-bt1-6-live-qualification`

Parent BT1.5: `471657a920fa863773f14e84d5151b3e55c6a759`

Implementation commit: `37f6c0bba654cdfca3ad8fc926a3be61b42b36b7`

## Implementation

BT1.6 adds a canonical dataset-certificate contract, compact read-only registry,
strict provider-drift handling, observed GET-only request auditing, and a final
certificate assembler that re-verifies the immutable repository and every
input report hash. It does not add a downloader, simulator, strategy, search,
statistics, risk, production, broker mutation, or execution path.

Implementation validation passed:

- `npm.cmd run typecheck`;
- `npm.cmd run build`;
- `npm.cmd run test:bt1-6`;
- `npm.cmd run test:bt1`;
- `npm.cmd run test:source-integrity`;
- `npm.cmd run test:provenance`;
- `npm.cmd run test:safety`;
- `npm.cmd run test:mt5-readonly-safety`;
- `npm.cmd run test:mt5-readonly-disconnect-recovery`;
- `npm.cmd run test:b1-contract-fixtures`;
- `npm.cmd run test:b1-contracts`;
- Node syntax checks for all new BT1.6 scripts;
- `git diff --check`.

The build retained only existing non-failing Rollup circular-export and chunk
size warnings.

## Current Matrix

| Gate | Result |
| --- | --- |
| Concurrency safe | restricted; live work deferred |
| Provider basis | pending |
| Winter / summer | pending |
| Spring / fall DST | pending |
| Maintenance | pending |
| Historical time / DST | false / false operationally |
| Symbol specification | pending live metadata |
| Capacity pilot | not run |
| Two-year retrieval | not started |
| Restart/resume | deterministic implementation only |
| Integrity | pending live dataset |
| Derived timeframes | fixture verified; live pending |
| Reproduction | fixture verified; live pending |
| Certificate | not issued |
| Strategy neutral | implementation verified |
| Read-only safety | implementation verified; live pending |
| Authority | none / none / none |

## Status

```text
BT1.6 BLOCKED
LIVE HISTORICAL DATASET QUALIFICATION INCOMPLETE
```

```text
BT2 REMAINS BLOCKED
```

Fixture success is not operational acceptance. The next action is a fresh live
preflight after resources and B1.2 priority permit it, followed by provider-time
diagnostics and the bounded capacity pilot.
