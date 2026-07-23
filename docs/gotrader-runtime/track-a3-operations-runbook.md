# Track A3 Operations Runbook

## Prerequisites

Use the isolated Track A3 worktree. Leave foreign-owned ports and processes
untouched. MT5 Desktop must be open, connected, and displaying USTECH.

Run the compiled read-only terminal probe immediately before verification:

```text
C:\Users\andre\AppData\Roaming\MetaQuotes\Terminal\D0E8209F77C8CF37AD8BF550E51FF075\MQL5\Scripts\GoTrader\GoTraderClockProbe.ex5
```

In MT5 Navigator, refresh Scripts and drag `GoTraderClockProbe` onto the USTECH
chart. The script reads terminal, quote, and M5 bar clocks once and exits. It
does not read account, order, position, or deal state.

## Start

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-runtime-track-a3
npm.cmd run gotrader:shadow-context:start
npm.cmd run gotrader:time:verify-current-live
```

The verification command must be rerun while the probe evidence is fresh.
Failure is expected and safe if the probe is missing/stale or surfaces disagree.

## Inspect

```powershell
npm.cmd run gotrader:runtime:status -- --profile always_on_shadow_context
npm.cmd run gotrader:runtime:health -- --profile always_on_shadow_context
npm.cmd run gotrader:scheduler:status
npm.cmd run gotrader:context:status
```

For scheduler commands, set `GOTRADER_RUNTIME_PROFILE_ID` to
`always_on_shadow_context` when the shell is not inheriting the supervisor
profile.

## Observe

```powershell
$env:GOTRADER_RUNTIME_PROFILE_ID="always_on_shadow_context"
npm.cmd run gotrader:observe:verified-closes -- 14400
```

Four hours is the minimum operational observation. Acceptance requires at least
three verified M5 closes and three context cycles across two market hours, with
zero duplicate closes, duplicate context artifacts, payload conflicts, and
ledger gaps. A short fixture or blocked live run is not operational acceptance.

## Pause And Resume Context

```powershell
npm.cmd run gotrader:context:pause
npm.cmd run gotrader:context:status
npm.cmd run gotrader:context:resume
```

This pauses only context intake. Feed collection, proof diagnostics, durable
close reconciliation, scheduler health, and runtime health continue.

## Stop And Roll Back

```powershell
npm.cmd run gotrader:runtime:stop -- --profile always_on_shadow_context
```

Rollback uses `always_on_read_only_scheduler` or `always_on_read_only`. Do not
delete runtime state during diagnosis. Do not enable `shadow_ifvg_comparison`.
