# GoTrader V2 Phase 1.6 Live Verification Runbook

## Safety

This runbook calls only health, time-contract, quote, latest-candle, and range-candle routes. It never calls account, order, position, deal, trade, mutation, readiness, or execution paths.

## Start the Existing Local Stack

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-v2-phase0-baseline
npm.cmd run mt5:readonly-upstream
```

In a second terminal:

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-v2-phase0-baseline
npm.cmd run mt5:readonly-bridge
```

## Default Observation

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-v2-phase0-baseline
npm.cmd run diagnose:v2-mt5-upstream-time-contract
```

Expected until the provider basis is proven:

```text
blocked_provider_contract_unverified
```

The output is compact. It reports endpoint status, raw scalar samples, offset, contract status, counts, and authority. It never prints candle arrays.

## Configured IANA Candidate

Configure the upstream process before starting it:

```powershell
$env:MT5_PROVIDER_TIME_BASIS="mt5_server_wall_clock"
$env:MT5_PROVIDER_TIMEZONE="Europe/Helsinki"
npm.cmd run mt5:readonly-upstream
```

Expected status is `configured_unverified` unless sufficient independent evidence is also supplied. A plausible current conversion does not verify the provider contract.

## Observation File

Set `MT5_PROVIDER_TIME_OBSERVATIONS_FILE` to a compact JSON file containing real observations. An IANA provider requires accepted standard-time and daylight-time captures unless provider documentation or verified terminal metadata independently establishes the contract.

Never promote synthetic fixtures or inferred backfills to provider evidence.

## Future Independent Push Hook

When an independent network push publisher exists:

1. query its versioned time contract;
2. capture raw tick and closed-candle scalars for the same symbol/timeframe interval;
3. compare with polling raw values before normalization;
4. apply the same verified policy;
5. compare normalized candle boundaries and OHLC values;
6. classify `exact_match`, `equivalent_with_documented_variance`, `mismatch`, or `insufficient_comparison_data`.

The browser event adapter is polling-derived and is not independent push evidence.

## Stop and Clear Optional Settings

Stop the local processes with `Ctrl+C`, then clear settings if used:

```powershell
Remove-Item Env:MT5_PROVIDER_TIME_BASIS -ErrorAction SilentlyContinue
Remove-Item Env:MT5_PROVIDER_TIMEZONE -ErrorAction SilentlyContinue
Remove-Item Env:MT5_PROVIDER_UTC_OFFSET_MINUTES -ErrorAction SilentlyContinue
Remove-Item Env:MT5_PROVIDER_TIME_VERIFICATION_SOURCES -ErrorAction SilentlyContinue
Remove-Item Env:MT5_PROVIDER_TIME_OBSERVATIONS_FILE -ErrorAction SilentlyContinue
```
