# Phase 1.7 Live Probe Runbook

## Installed Files

The compiled probe is installed locally at:

```text
C:/Users/andre/AppData/Roaming/MetaQuotes/Terminal/D0E8209F77C8CF37AD8BF550E51FF075/MQL5/Scripts/GoTrader/GoTraderClockProbe.ex5
```

The `.ex5` binary is machine-local and ignored by Git.

## Manual Capture

1. Keep MT5 connected and confirm USTECH is receiving quotes.
2. Open Navigator with `Ctrl+N`.
3. Under Scripts, select Refresh if `GoTrader/GoTraderClockProbe` is not visible.
4. Drag `GoTraderClockProbe` onto an USTECH chart. The script defaults to USTECH and M5.
5. No automated-trading permission is required. The probe exits after one observation.
6. Immediately run:

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-v2-phase0-baseline
npm.cmd run diagnose:v2-mt5-terminal-clock
```

The expected observation path for this terminal is:

```text
C:/Users/andre/AppData/Roaming/MetaQuotes/Terminal/Common/Files/GoTrader/gotrader-mt5-clock-probe-7BC52F8E.json
```

Capture at least three observations during an actively quoting period. Include one immediately after an M5 close where practical. Re-running the script atomically replaces the latest file.

## Recompile

```powershell
$source = "C:\Users\andre\OneDrive\Documents\gotrader-v2-phase0-baseline\mt5\GoTraderClockProbe.mq5"
& "C:\Program Files\MetaTrader 5\MetaEditor64.exe" "/compile:$source"
```

MetaEditor 5.0.0.5836 compiled the source with zero errors and zero warnings on July 22, 2026.

## Interpretation

- `terminal_time_basis_verified`: current and historical requirements passed.
- `current_live_time_verified_historical_dst_unverified`: current offset is usable as evidence, but Phase 2 remains blocked.
- `blocked_conflicting_terminal_evidence`: do not select the clock that makes data pass.
- `blocked_terminal_probe_unavailable`: run the manual script and retry.

The diagnostic prints compact scalar clocks and deltas only. It never prints candles or calls mutation endpoints.

## Rollback

Revert the Phase 1.7 repository commit and delete the two machine-local probe files under `MQL5/Scripts/GoTrader`. Phase 1.6 behavior then resumes unchanged.
