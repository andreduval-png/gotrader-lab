# GoTrader V2 Phase 1.5 Live Parity Runbook

## Purpose

This is a bounded read-only diagnostic. It calls only local MT5 health, quote, status, and candle paths. It does not call account, order, position, trade, mutation, readiness, or execution paths.

## Prerequisites

1. MT5 Desktop is open and connected.
2. The read-only upstream is listening on `127.0.0.1:8000`.
3. The read-only wrapper is listening on `127.0.0.1:7341`.
4. No broker timezone should be assumed merely from the current offset.

## Default Fail-Closed Diagnostic

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-v2-phase0-baseline
npm.cmd run diagnose:v2-mt5-time-normalization
```

Without a declared provider contract, expected status is:

```text
blocked_time_basis_unverified
```

The command reports compact samples and counts only. It never prints the candle array.

## Configured IANA Candidate Diagnostic

Use this only after the broker/server timezone is verified independently:

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-v2-phase0-baseline
$env:MT5_V2_SERVER_TIMEZONE="Europe/Helsinki"
npm.cmd run diagnose:v2-mt5-time-normalization
Remove-Item Env:MT5_V2_SERVER_TIMEZONE
```

The current July sample is consistent with `Europe/Helsinki`, but this command is a candidate-policy check, not proof that the broker contract is Helsinki.

An explicit fixed offset can be tested for providers that guarantee one:

```powershell
$env:MT5_V2_SERVER_UTC_OFFSET_MINUTES="180"
npm.cmd run diagnose:v2-mt5-time-normalization
Remove-Item Env:MT5_V2_SERVER_UTC_OFFSET_MINUTES
```

A fixed offset must not be used for a DST-observing server.

## Independent Push/Polling Parity

The existing browser push adapter republishes polling snapshots and is not independent evidence. When an independent network publisher exists:

1. Freeze one requested/broker symbol mapping, for example `MNQ -> USTECH`.
2. Freeze one timeframe, for example `5m`.
3. Capture a bounded set of closed polling candles.
4. Capture the same bounded interval from the independent push rolling store.
5. Apply the same policy ID/version to both raw streams.
6. Compare normalized open/close times, OHLC, comparable volume, mapping, timeframe, closure state, and missing/extra candles.
7. Classify as `exact_match`, `equivalent_with_documented_variance`, `mismatch`, or `insufficient_comparison_data`.

Do not use mock data as the live result. Until the independent publisher exists, live parity remains `insufficient_comparison_data`; the deterministic transport fixture remains `exact_match`.

## Upstream Contract Needed

The read-only upstream should expose compact metadata such as:

```json
{
  "providerTimeBasis": "mt5_server_wall_clock",
  "providerTimezone": "verified IANA zone",
  "providerUtcOffsetMinutes": 180,
  "dstPolicy": "iana_timezone_rules",
  "serverTimeRaw": "compact scalar",
  "serverTimeUtc": "verified UTC instant",
  "timeContractVersion": "versioned identifier"
}
```

No secret, account, order, or position data is required. If this metadata cannot be verified, Phase 2 remains blocked.

## Rollback

The Phase 1.5 implementation is isolated under `src/lib/v2`. Roll back the Phase 1.5 commit or stop using the new adapter. The legacy production MT5 path remains untouched throughout this phase.
