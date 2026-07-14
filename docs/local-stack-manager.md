# GoTrader Local Stack Manager

The local stack manager starts, stops, restarts, and diagnoses the local developer services used by GoTrader AI Lab. It is process management only. It does not add broker execution, live trading, order placement, account mutation, position mutation, or readiness override.

## Commands

```powershell
npm.cmd run start:local-stack
npm.cmd run diagnose:local-stack
npm.cmd run stop:local-stack
npm.cmd run restart:local-stack
```

## Default Services

`npm.cmd run start:local-stack` starts these services by default:

| Service | Command | Port | Notes |
| --- | --- | --- | --- |
| GoTrader app/Vite | `npm.cmd run dev` | `5173` | Local frontend app. |
| MT5 read-only market-data upstream | `npm.cmd run mt5:readonly-upstream` | `8000` | Loopback-only symbols, quotes, and candles from the authenticated MT5 Desktop session. |
| GoTrader MT5 read-only wrapper | `npm.cmd run mt5:readonly-bridge` | `7341` | Safe read-only wrapper. No account/order/position routes. |
| LLM advisory bridge | `npm.cmd run llm:bridge` | `8787` | Advisory-only local LLM bridge. |

The MT5 read-only upstream starts when the MT5 terminal executable is available. TradingView MCP is optional and is not started by default.

## MT5 Read-Only Upstream

GoTrader owns a narrow loopback-only upstream at `scripts/mt5-readonly-upstream.py`. It attaches to the already authenticated MT5 Desktop terminal and exposes only symbols, quotes, latest candles, and date-range candles. It has no account, order, position, deal, trade, or mutation routes.

Configuration:

| Variable | Purpose |
| --- | --- |
| `MT5_PATH` | Optional terminal executable override. Defaults to `C:\Program Files\MetaTrader 5\terminal64.exe`. |

After a Windows restart, open MT5 Desktop and confirm it is logged in. Then run:

```powershell
npm.cmd run start:local-stack
```

No MT5 password is required or stored by this service. If the terminal is closed or logged out, the upstream reports unavailable and the wrapper remains safely degraded.

## Optional TradingView MCP

TradingView MCP is legacy/alternative evidence/chart data. It is not part of the default MT5-first workflow.

To include it:

```powershell
$env:ENABLE_TRADINGVIEW_MCP="true"
npm.cmd run start:local-stack
```

TradingView MCP uses port `7331` and still requires its own upstream TradingView Desktop/CDP setup.

## Ports

| Port | Service |
| --- | --- |
| `5173` | GoTrader app/Vite |
| `8000` | MT5 read-only market-data upstream |
| `7341` | GoTrader MT5 read-only wrapper |
| `8787` | LLM advisory bridge |
| `7331` | TradingView MCP bridge, optional |

## Service Order

Startup order:

1. MT5 read-only market-data upstream, if the terminal executable exists.
2. GoTrader MT5 read-only wrapper.
3. LLM advisory bridge.
4. GoTrader app/Vite.
5. TradingView MCP bridge, only when `ENABLE_TRADINGVIEW_MCP=true`.

## PID Tracking

The stack manager stores tracked child process metadata in:

```text
.gotrader/local-stack.json
```

Logs go to:

```text
.gotrader/local-stack-logs/
```

Both are ignored by Git.

`stop:local-stack` kills only processes recorded in `.gotrader/local-stack.json`. If a port is occupied by an untracked process, the stop command leaves it alone and `diagnose:local-stack` reports the port as still occupied.

## Diagnose

Run:

```powershell
npm.cmd run diagnose:local-stack
```

The diagnostic checks:

- tracked PIDs
- port listeners for `5173`, `8000`, `7341`, `8787`, and `7331`
- app root on `5173`
- MT5 read-only upstream health/status candidates on `8000`
- MT5 wrapper `/health` on `7341`
- LLM bridge `/health` on `8787`
- TradingView MCP `/health` on `7331`

The diagnostic avoids printing secrets and omits process command lines from its JSON summary.

## Troubleshooting

If a required service is unhealthy:

```powershell
npm.cmd run diagnose:local-stack
```

If a tracked service is stale:

```powershell
npm.cmd run stop:local-stack
npm.cmd run start:local-stack
```

If a port is occupied by an untracked process, inspect it before stopping anything manually. The local stack manager intentionally does not kill unknown processes.

If the LLM bridge is offline, the app should continue deterministic research and show advisory unavailable. Start it with:

```powershell
npm.cmd run llm:bridge
```

If the MT5 upstream is offline, open and log in to MT5 Desktop, optionally set `MT5_PATH`, then restart the stack. Do not place credentials in the GoTrader repository.

## Safety

The local stack manager only starts local development processes. It does not expose MT5 MCP directly to the frontend. GoTrader uses the safe MT5 read-only wrapper on port `7341`, and the wrapper blocks account, order, position, and mutation routes.

Authority remains:

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```
