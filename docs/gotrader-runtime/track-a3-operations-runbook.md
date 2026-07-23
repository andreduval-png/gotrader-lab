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

## A3.1 Persistent Verified-Time Profile

Track A3.1 adds a persistent, read-only terminal probe and a managed verifier.
The original one-shot A3 workflow above remains available.

Install or refresh the EA source and compiled artifact:

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-runtime-track-a3
npm.cmd run gotrader:time:install-probe
```

In MT5, perform this one-time chart attachment:

1. Open an actively quoting `USTECH` chart.
2. Open Navigator, then refresh Expert Advisors.
3. Drag `GoTrader\GoTraderClockProbeEA` onto the chart.
4. Keep the default 30-second heartbeat, or choose a value from 10 to 60
   seconds.
5. Confirm the chart symbol is `USTECH`. The EA reads clocks, one quote-time
   scalar, and one M5 bar-time scalar only.

The EA has no trade, account, order, position, deal, socket, DLL, credential,
or broker-mutation capability. Its compact JSON is written to the MT5 common
files area through a per-terminal temporary file and atomic replacement.

Start the verified profile:

```powershell
npm.cmd run gotrader:shadow-context:verified:start
```

Inspect the managed services:

```powershell
npm.cmd run gotrader:runtime:status -- --profile always_on_shadow_context_verified
npm.cmd run gotrader:runtime:health -- --profile always_on_shadow_context_verified
npm.cmd run gotrader:time:status
npm.cmd run gotrader:verified:scheduler:status
npm.cmd run gotrader:verified:context:status
```

The standalone watcher remains available for diagnosis:

```powershell
npm.cmd run gotrader:time:watch-current-live
npm.cmd run gotrader:time:status
npm.cmd run gotrader:time:stop-watch
npm.cmd run gotrader:time:resume-watch
```

The verified runtime normally owns the watcher. Do not start a second watcher
against the same profile.

Run the four-hour acceptance observation during active market hours:

```powershell
npm.cmd run gotrader:observe:a3-acceptance -- --duration-hours 4
```

Acceptance requires at least three verified M5 closes and three completed
context cycles across at least two market hours. Duplicate closes, duplicate
context artifacts, payload conflicts, and ledger gaps must all remain zero.
The observer writes compact, integrity-hashed checkpoints; it never writes raw
candles or raw context facts.

Stop only the verified profile:

```powershell
npm.cmd run gotrader:runtime:stop -- --profile always_on_shadow_context_verified
```

If the probe stops or becomes stale, quote and forming-candle transport may
continue, but new close events and context cycles fail closed. Recovery starts
a safe baseline and never accepts missed closes retroactively.
