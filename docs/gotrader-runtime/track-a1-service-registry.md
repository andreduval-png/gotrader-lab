# Track A1 Service Registry

## Core Registry

| Service ID | Classification | Runtime | Port | Dependency | Health | Restart |
|---|---|---|---:|---|---|---|
| `mt5_terminal` | `required_core` | external | none | none | process | never |
| `mt5_readonly_upstream` | `required_core` | Python | 8000 | MT5 terminal | health, status, time contract | bounded |
| `mt5_readonly_bridge` | `required_core` | Node | 7341 | read-only upstream | health, status, time contract, quote, candles | bounded |

Default host is `127.0.0.1`.

## Optional and Excluded Services

| Service | Classification | A1 behavior |
|---|---|---|
| Vite/browser UI | `optional_operator_ui` | not started |
| LLM advisory bridge | `optional_research` | not started |
| OpenClaw/Hermes | `optional_research` | not started |
| TradingView MCP | `deprecated` / optional diagnostic | not started |
| autonomous research | `future` | not started or imported |
| IFVG live collector | `optional_research` | not started |
| Paper-Demo gateway | `unsafe_for_a1` | not started |
| execution gateway | `future_execution` | not started |
| account-risk engine | `future_execution` | not started |

## Commands

MT5 upstream:

```text
python <worktree>/scripts/mt5-readonly-upstream.py
  --path <MT5 terminal>
  --host 127.0.0.1
  --port 8000
```

MT5 bridge:

```text
node <worktree>/scripts/start-mt5-readonly-bridge.mjs
```

The bridge receives these local environment values:

```text
MT5_READONLY_BRIDGE_HOST
MT5_READONLY_BRIDGE_PORT
MT5_READONLY_UPSTREAM_BASE_URL
```

No account, order, position, deal, mutation, or execution endpoint is started.

## Port Policy

Default ports:

| Port | Owner |
|---:|---|
| 8000 | MT5 read-only upstream |
| 7341 | MT5 read-only bridge |

Overrides for isolated acceptance:

```powershell
$env:GOTRADER_RUNTIME_UPSTREAM_PORT="18000"
$env:GOTRADER_RUNTIME_BRIDGE_PORT="17341"
```

A port is usable only when free or owned by the exact service script in the active
worktree. A different worktree blocks startup.
