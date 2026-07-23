# Track A2 Operations Runbook

## Prerequisites

1. MetaTrader 5 Desktop is open, connected, and already authenticated.
2. Node.js and Python dependencies from Track A1 are installed.
3. Ports `8000`, `7341`, `7343`, and `7344` are free or owned by this exact worktree.
4. MT5 terminal time evidence is current if closed-candle cycles are expected.

No MT5 login is stored by GoTrader.

## Start

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-runtime-track-a2
npm.cmd run gotrader:scheduler:start
```

The foreground Track A1 supervisor starts the upstream, bridge, feed, and scheduler in
dependency order. The browser is not required.

The original A1 profile remains available and does not start A2:

```powershell
npm.cmd run gotrader:runtime:start
```

## Status

```powershell
npm.cmd run gotrader:scheduler:status
npm.cmd run gotrader:runtime:health -- --profile always_on_read_only_scheduler
```

## Pause And Resume

```powershell
npm.cmd run gotrader:scheduler:pause
npm.cmd run gotrader:scheduler:resume
```

Pause and resume affect only closed-candle task intake. They do not mutate MT5 or the
rolling feed.

## Stop

```powershell
npm.cmd run gotrader:scheduler:stop
```

Scheduler, feed, bridge, and upstream stop in reverse dependency order. MT5 Desktop stays
open.

## Configuration

```text
GOTRADER_RUNTIME_FEED_PORT
GOTRADER_RUNTIME_SCHEDULER_PORT
GOTRADER_FEED_QUOTE_POLL_MS
GOTRADER_FEED_CANDLE_POLL_MS
GOTRADER_FEED_TIME_CONTRACT_POLL_MS
GOTRADER_FEED_REQUEST_TIMEOUT_MS
GOTRADER_FEED_MAXIMUM_EVENTS
GOTRADER_FEED_BOOTSTRAP_LIMIT
GOTRADER_FEED_REQUESTED_SYMBOL
GOTRADER_FEED_BROKER_SYMBOL
GOTRADER_FEED_TIMEFRAMES
GOTRADER_SCHEDULER_POLL_MS
GOTRADER_SCHEDULER_REQUEST_TIMEOUT_MS
GOTRADER_SCHEDULER_MAXIMUM_ARTIFACTS
```

## State

```text
.gotrader/runtime/always_on_read_only_scheduler/feed/
.gotrader/runtime/always_on_read_only_scheduler/scheduler/
```

Status and artifacts are compact. No raw candle arrays are printed or persisted.

## Expected Degraded State

When current-live MT5 time proof is missing:

```text
feed: degraded or blocked
scheduler: degraded
close cycles: paused
quote/forming observations: may continue
```

This is fail-closed behavior, not a reason to infer candle closure from the Windows clock.
