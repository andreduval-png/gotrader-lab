# BT1.5 Final Qualification Report

Date: 2026-08-07

Branch: `codex/gotrader-backtest-bt1-5-historical-qualification`

Parent BT1: `edd2d8d508db6b876303d42f56aedc2fb90e1cf6`

Tooling commits:

- `40838521267361b0c1882a718609a70d4743b317`
- `be8d96b340622519578f8f3a102800a002594aee`

## Implementation Result

BT1.5 now has canonical evidence/calendar/alignment/capacity identities,
read-only MT5 diagnostics, a sealed request bundle, a fresh live-preflight
gate, bounded pilot/full ingestion, compact progress, v1 checkpoint migration,
controlled restart support, and separate rematerialization/provider-requery
comparison. No strategy, simulation, search, statistics, risk, production, or
execution code was added.

Validation passed:

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run test:bt1`
- `npm.cmd run test:bt1-5-contracts`
- `npm.cmd run test:bt1-5-operational`
- `npm.cmd run test:source-integrity`
- `npm.cmd run test:provenance`
- `npm.cmd run test:safety`
- `npm.cmd run test:mt5-readonly-safety`
- `npm.cmd run test:b1-contract-fixtures`
- `npm.cmd run test:b1-contracts`
- `git diff --check`

The production build retained only pre-existing non-failing Rollup chunk and
circular-export warnings.

## Acceptance Matrix

| Gate | Required | Current result |
| --- | --- | --- |
| Concurrency safe | yes | restricted; live start blocked |
| Provider basis identified | yes | pending actual history |
| Winter evidence | verified | pending |
| Summer evidence | verified | pending |
| Spring transition | verified | pending |
| Fall transition | verified | pending |
| Maintenance boundary | verified | pending |
| Historical time | true | false |
| Historical DST | true | false |
| Symbol specification | verified | pending live metadata |
| Two-year retrieval | complete | not started |
| Dataset integrity | passed | pending live dataset |
| Restart/resume | passed | deterministic only; live pending |
| Derived timeframes | passed | fixtures only; live pending |
| Stable checksum | passed | pending live dataset |
| Stable dataset ID | passed | pending live dataset |
| Reproduction | passed | comparator tested; live runs pending |
| Lineage | passed | fixture verified; live pending |
| Strategy neutral | yes | yes |
| Authority | none / none / none | none / none / none |

## Final Status

```text
BT1.5 BLOCKED
MT5 HISTORICAL TIME OR DATASET QUALIFICATION INCOMPLETE
```

```text
BT2 REMAINS BLOCKED
```

The next permitted action is a fresh concurrency/resource check after B1.2 is
not running or imminent, followed by the GET-only evidence diagnostic and a
bounded capacity pilot. A full two-year run is allowed only after those gates
pass. No threshold may be weakened and no fixture may be promoted as live
evidence.

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
