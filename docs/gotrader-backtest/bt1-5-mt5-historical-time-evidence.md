# BT1.5 MT5 Historical Time Evidence

Date: 2026-08-07

Status: `PENDING_LIVE_EVIDENCE`

## Scope

BT1.5 must establish the timestamp basis of actual MT5 broker history. Current-live
time verification is useful context but is not accepted as historical proof.
Fixture results validate only the evidence schema and fail-closed behavior.

## Evidence Matrix

| Period | Actual broker bars | Timestamp basis | Session interpretation | Result |
| --- | --- | --- | --- | --- |
| Winter | not collected | pending | pending | blocked |
| Summer | not collected | pending | pending | blocked |
| Spring DST transition | not collected | pending | pending | blocked |
| Fall DST transition | not collected | pending | pending | blocked |
| Maintenance boundary | not collected | pending | pending | blocked |

`npm.cmd run bt1-5:diagnose-mt5` is implemented as a GET-only collector for
`/health`, `/status`, `/time-contract`, `/symbols`, and exactly five bounded
`/candles/range` windows. It stores only allowlisted summaries and representative
raw timestamps below `.gotrader/bt1-5`; raw candle arrays, account data, and
secrets are not persisted.

## Required Review

The live diagnostic remains candidate evidence until a reviewer confirms:

- the provider-history basis independently of the current-live basis;
- raw-to-UTC normalization for each period;
- New York session alignment and broker session behavior;
- deterministic treatment of spring and fall DST boundaries;
- the actual maintenance gap, with no inferred closure merely from repetition;
- one source identity and authority `none / none / none` throughout.

No live diagnostic was started because the approved concurrency preflight
allowed offline implementation only and available memory was below the live
qualification floor.
