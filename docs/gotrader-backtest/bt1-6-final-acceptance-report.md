# BT1.6 Final Acceptance Report

Date: 2026-08-12

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

## Operational Acceptance

| Gate | Result |
| --- | --- |
| Concurrency safe | passed fresh preflights and bounded handoffs |
| Provider basis | verified MT5 server wall clock |
| Winter / summer | verified |
| Spring / fall DST | verified |
| Maintenance | verified |
| Historical time / DST | true / true |
| Symbol specification | verified USTECH CFD/proxy for MNQ research |
| Capacity pilot | passed; 8,264 accepted, zero rejected |
| Two-year retrieval | passed; 213 pages, 706,422 accepted |
| Restart/resume | passed controlled exit-75 proof |
| Integrity | accepted with warnings; zero blockers/rejections |
| Derived timeframes | M5/M15/H1/H4 verified |
| Reproduction | deterministic and provider requery matched |
| Certificate | `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193` |
| Registry | `sha256:ec877c21a370699094ed856d2419712f561dc8f3ef23350559c6985a9df4c9eb` |
| Strategy neutral | verified |
| Read-only safety | verified GET-only, zero forbidden calls |
| Authority | none / none / none |

## Status

```text
BT1.6 ACCEPTED
LIVE HISTORICAL DATASET QUALIFICATION COMPLETE
```

```text
BT2 REMAINS UNAUTHORIZED
```

The accepted candidate is `2f307ef09df3fa600fe20a57b78da72ebd4a808b` plus the
certificate evidence-composition fix recorded by the acceptance commit. Raw
candles remain outside Git. Preserved same-process memory-bound reports remain
part of the audit trail; fresh low-memory coalesced verification passed without
altering canonical dataset identities.

BT2 is not implicitly authorized by this acceptance. Its canonical opportunity
and trade-simulation architecture requires a separate explicit authorization.
