# GoTrader Track A1 Runtime Design

## Purpose

Track A1 establishes a browser-independent, always-on foundation for GoTrader's read-only
MT5 market-data services. It does not schedule strategies, create trade intents, create
evidence, alter readiness, or enable paper/demo/live execution.

## Architecture

```text
GoTrader runtime supervisor
  |
  +-- verifies MetaTrader 5 Desktop (external, never stopped by default)
  |
  +-- starts MT5 read-only Python upstream
  |     +-- /health
  |     +-- /status
  |     +-- /time-contract
  |
  +-- starts GoTrader MT5 read-only bridge
        +-- /health
        +-- /status
        +-- /time-contract
        +-- /quote
        +-- /candles
```

The browser, Vite, LLM bridge, OpenClaw, TradingView, strategy collectors, autonomous
research, Paper-Demo, and execution services are not part of this profile.

## Runtime Profile

Profile:

```text
always_on_read_only
```

Version:

```text
track-a1-always-on-read-only-v1
```

The profile is an explicit allowlist. It contains only:

1. `mt5_terminal`
2. `mt5_readonly_upstream`
3. `mt5_readonly_bridge`

The terminal is an external prerequisite. The supervisor starts and stops the two
read-only child services only.

## Worktree Identity

At startup the supervisor records:

- absolute repository root;
- branch;
- HEAD commit;
- profile and supervisor versions;
- absolute service script paths;
- child process fingerprints.

A listener is adopted only when its command line contains the exact script path and
identity tokens for the active worktree. A same-named service from another worktree is
classified as `blocked_foreign_worktree`. An unrelated listener is
`blocked_unknown_owner`.

Unknown and foreign processes are never terminated automatically.

## State Model

Runtime and service states:

```text
stopped
starting
healthy
degraded
stale
restarting
failed
blocked
```

State is stored under:

```text
.gotrader/runtime/always_on_read_only/
```

This directory is local to the worktree and ignored by Git.

## Health Semantics

Track A1 separates four concerns:

1. **Process health**: the child exists and its `/health` endpoint responds.
2. **Transport health**: the wrapper can reach the upstream.
3. **Market availability**: quote and candle requests return compact market data.
4. **Research time eligibility**: the historical time contract is verified.

An available but unverified time contract produces `degraded`, not a crash restart.
Closed-market or unavailable quote data is a warning when process health remains intact.
Only process loss, a failed restart-relevant `/health` probe, or a stale service version
can consume the restart budget.

## Restart Policy

Each managed service receives at most five restart attempts in ten minutes.

Backoff:

```text
1 second
2 seconds
5 seconds
30 seconds maximum
```

When the upstream is restarted, its dependent bridge is stopped and restarted in order.
When the budget is exhausted, the runtime enters `blocked` with
`restart_budget_exhausted`.

## Logs

Logs are written to:

```text
.gotrader/runtime/always_on_read_only/logs/
```

Files rotate at 1 MiB with five retained files. Runtime logs redact common secret keys and
Bearer credentials. They do not record candle arrays, account data, orders, positions, or
MT5 credentials.

## Safety

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
```

The runtime module imports no strategy, validation, evidence, readiness, Paper-Demo,
execution, or OpenClaw trading module.
