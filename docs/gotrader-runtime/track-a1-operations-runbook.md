# Track A1 Operations Runbook

## Prerequisites

1. MetaTrader 5 Desktop is installed, open, connected, and already authenticated.
2. Node.js 20 or newer is available.
3. Python and the `MetaTrader5` package are available.
4. Ports `8000` and `7341` are free or owned by this exact worktree.

GoTrader does not require MT5 login credentials in repository configuration.

## Start

From the approved worktree:

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-runtime-track-a1
npm.cmd run gotrader:runtime:start
```

The start command remains in the foreground and continuously supervises the read-only
services. Closing a browser does not stop it.

Optional browser opening:

```powershell
node scripts/gotrader-runtime-supervisor.mjs --launch-ui
```

This opens the UI only when an existing UI server already responds. It does not make Vite
a core service.

## Status

From another terminal:

```powershell
npm.cmd run gotrader:runtime:status
```

This reads the worktree-scoped supervisor snapshot without performing market-data probes.

## Health

```powershell
npm.cmd run gotrader:runtime:health
```

Health performs live process, time-contract, quote, and candle checks. It outputs compact
counts and classifications only, never raw candles.

## Stop

```powershell
npm.cmd run gotrader:runtime:stop
```

Shutdown order:

1. read-only bridge;
2. read-only upstream.

MetaTrader 5 Desktop remains open.

## Configuration

Optional environment values:

```text
MT5_PATH
PYTHON
GOTRADER_RUNTIME_HOST
GOTRADER_RUNTIME_UPSTREAM_PORT
GOTRADER_RUNTIME_BRIDGE_PORT
GOTRADER_RUNTIME_HEARTBEAT_MS
GOTRADER_RUNTIME_ENDPOINT_INTERVAL_MS
```

No credential is printed or persisted.

## State

```text
.gotrader/runtime/always_on_read_only/supervisor.json
.gotrader/runtime/always_on_read_only/supervisor.lock
.gotrader/runtime/always_on_read_only/services/
.gotrader/runtime/always_on_read_only/logs/
```

## Expected Degraded State

If `/time-contract` responds but historical provider time and DST remain unverified:

```text
runtime state: degraded
warning: historical_time_contract_not_verified
```

This is a research provenance limitation. It is not a service crash and does not trigger
a restart.

## Existing Full Development Launcher

`Start-GoTrader.cmd` and `npm.cmd run gotrader:start` retain their existing full local
development behavior. They are not the Track A1 browser-independent profile.
