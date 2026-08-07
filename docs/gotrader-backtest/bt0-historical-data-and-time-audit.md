# BT0 Historical Data And Time Audit

## Ingestion Paths

| Path | Provider / identity | Limits and storage | Quality controls | BT0 verdict |
|---|---|---|---|---|
| MT5 read-only latest/range | Requested and broker symbol, timeframe, MT5 terminal; `scripts/mt5-readonly-upstream.py` | `MAX_CANDLES=5000`; latest and range calls; JSON response; no cursor | Sorts output, exports OHLCV and row spread when present | Useful bounded source, not a resumable dataset service |
| Historical import | User CSV/XLSX/JSON; `historicalCandleImport.ts` | IndexedDB candles, localStorage active ID | Numeric/OHLC validation, sort, first duplicate retained, naive interval gaps | Browser-only, futures-shaped, weak time and lineage |
| Canonical candle source/repository | Source summaries and canonical browser data | Browser/memory bounded | Existing source fingerprints vary by path | Useful adapter input, not two-year authoritative storage |
| Phase 3F manifest | Requested/broker symbol, UTC range, time policy/contract, SHA-256 | Manifest only; `rawCandlesPersisted:false` | Rejects invalid, duplicate, conflicting, or unclosed OHLC; hard-blocks unverified historical time | Strong identity contract to preserve |
| Runtime hydrator | MT5 small windows | Max 300 bars/timeframe; minimum 5 | Current-live verification and hydration status | Explicitly `historicalEligible:false`; not a backtest dataset |
| Fixtures | Test-owned synthetic arrays/files | Small and deterministic | Exact expected behavior | Valid for software contracts only, never historical edge |

## MT5 Range Behavior

The read-only upstream calls `copy_rates_range`, sorts all returned rows, then returns only the last requested `count`, capped at 5,000. It has no page token, cursor, stable partition manifest, retry checkpoint, or end-to-end dataset checksum. Client scripts can manually chunk date ranges, but no canonical ingestor currently proves complete, gap-audited, idempotent assembly.

Earliest/latest available history was not probed because BT0 was restricted from live MT5. Provider retention therefore remains `NOT_AVAILABLE` per broker symbol and timeframe. Two years is technically plausible, not currently proven.

## Two-Year Count Estimate

Assumption: approximately 522 weekdays over two years, 24-hour weekday data, before broker holidays and daily maintenance. Counts are planning estimates, not observed datasets.

| Timeframe | Approximate bars | 5,000-row response span | Two-year single-call feasible? |
|---|---:|---:|---|
| M1 | 751,680 theoretical; use ~720,000 planning count | ~3.5 trading days | No |
| M5 | 150,336 theoretical; use ~144,000 | ~17.4 trading days | No |
| M15 | 50,112 theoretical; use ~48,000 | ~52 trading days | No |
| H1 | 12,528 theoretical; use ~12,000 | ~208 trading days | No |
| H4 | 3,132 theoretical; use ~3,000 | >2 years | Usually |
| D1 | ~522 | >19 years of weekdays | Yes |

Across M1/M5/M15/H1/H4/D1, use approximately 927,000 bars per representative symbol for capacity planning.

## Data Quality

| Domain | Current behavior | Gap |
|---|---|---|
| Duplicate bars | Import drops later duplicates; Phase 3F rejects duplicates/conflicts | No one ingestion rule across sources; first-wins import can hide revisions |
| Conflicting revisions | Runtime feed can quarantine conflicts; Phase 3F rejects | Historical importer does not retain/reconcile revisions |
| Missing bars | Import counts fixed-interval gaps | Weekend, holiday, maintenance, and session schedules are not distinguished |
| Weekend data | Not canonically classified | Crypto and CFD schedules differ; naive gaps/filters are invalid |
| Maintenance breaks | Runtime has market-break awareness | Historical datasets lack a versioned broker calendar |
| Future timestamps | Current-live verifier guards live use | Import has no explicit future/closed-bar eligibility gate |
| Partial bars | Phase 3F requires closed candles | Other import/replay paths do not consistently persist closed/partial status |
| Invalid OHLC | Import and Phase 3F validate | Rules are duplicated |
| Symbol mapping | MT5 mapping covers USTECH, US500, US30, XAUUSD, EURUSD.pro, BTCUSD | Historical identity lacks versioned broker symbol properties |
| Spread | MT5 rows may contain integer spread | No canonical unit conversion, coverage metric, or fallback policy |
| Checksum | Phase 3F SHA-256 only | Most datasets/runs do not use it |

## Historical Time

Current-live time verification and historical time authority are separate facts. A3 can qualify current MT5 time while historical data remains unsuitable for session-sensitive replay.

Current status:

- MT5 server wall-clock basis: observed/contracted for current-live operation, but historical provider-time interpretation is not accepted.
- UTC normalization: Phase 3F has the required contract shape; imported JS timestamps may use the machine timezone when input lacks an explicit offset.
- Broker offset changes: historical regimes are not fully proven.
- DST: `historicalDstPolicyVerified:false` in the historical context path.
- America/New_York sessions: conversion code exists, but accepted historical use requires verified source-time and offset regimes first.
- Historical provider-time authority: unverified.

Therefore:

`history available` is plausible.

`history trusted for session-sensitive analysis` is false.

No session-based strategy result may be accepted until a bounded probe across standard-time and daylight-time periods validates broker timestamps, UTC conversion, New York sessions, daily maintenance, and candle-close boundaries.

## Required Deferred Probe

After the B1.2 observer is retired and a new preflight allows live work:

1. Query broker symbol metadata and earliest/latest bounded ranges for each representative symbol/timeframe.
2. Page small overlapping partitions across winter DST, spring transition, summer DST, fall transition, weekends, holidays, and maintenance.
3. Prove no duplicate/lost boundary bar and stable checksum on rerun.
4. Compare raw MT5 timestamps, normalized UTC, and America/New_York session labels.
5. Record an accepted versioned historical time contract before BT1 dataset acceptance.
