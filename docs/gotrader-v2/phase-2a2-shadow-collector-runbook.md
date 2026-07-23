# GoTrader V2 Phase 2A.2 Shadow Offset-Regime Collector Runbook

## Purpose

The Phase 2A.2 collector records compact, current-live MT5 timestamp-basis continuity. It polls only the loopback read-only wrapper's fixed `GET /time-contract` endpoint and appends accepted observations to the Phase 2A.1 offset-regime ledger.

This is a shadow diagnostic. It is not started by the GoTrader application or local-stack supervisor, and no production strategy, evidence, readiness, Paper-Demo, broker, or execution path consumes its file.

## Prerequisites

1. MT5 Desktop is open and connected.
2. The read-only upstream service is running on loopback.
3. The GoTrader MT5 read-only wrapper is running on loopback, normally `http://127.0.0.1:7341`.
4. The terminal clock probe is producing a current-live accepted time contract.

The collector does not start, control, or mutate MT5.

## Start

From the repository root:

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-v2-phase0-baseline
npm.cmd run collect:v2-mt5-offset-regime
```

The default interval is 60 seconds. Stop with `Ctrl+C`. The collector releases its single-writer lock during a normal stop.

For one observation:

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-v2-phase0-baseline
npm.cmd run collect:v2-mt5-offset-regime -- --once
```

## Configuration

Environment variables may be set in the shell or existing local environment files:

| Variable | Default | Constraint |
| --- | --- | --- |
| `MT5_READONLY_BRIDGE_URL` | `http://127.0.0.1:7341` | Loopback HTTP only; credentials, query strings, and fragments are rejected. |
| `V2_MT5_OFFSET_REGIME_BROKER_SYMBOL` | `MT5_READONLY_BROKER_SYMBOL` or `USTECH` | Must match an existing ledger file. |
| `V2_MT5_OFFSET_REGIME_STATE_FILE` | `.gotrader/v2/mt5-offset-regime-<symbol>.json` | Compact local state file. |
| `V2_MT5_OFFSET_REGIME_INTERVAL_MS` | `60000` | 30000 through 90000. |
| `V2_MT5_OFFSET_REGIME_TIMEOUT_MS` | `5000` | 250 through 15000. |
| `V2_MT5_OFFSET_REGIME_ONCE` | false | `1`, `true`, or `yes` performs one cycle. |

## State Contract

The persisted file contains:

- schema and version;
- save time;
- canonical SHA-256 ledger checksum;
- bounded regime summaries;
- compact blockers and warnings;
- authority `none / none / none`.

Writes use a same-directory temporary file and atomic rename. A process lock prevents concurrent writers. A stale lock can be recovered only when its recorded PID is no longer running.

Existing malformed, tampered, version-incompatible, or broker-mismatched state is rejected and left untouched. The collector does not silently reset accepted history.

## Offline and Rejected Observations

- An unreachable endpoint returns a compact `unavailable` result and preserves the last good ledger unchanged.
- A stale or rejected terminal contract terminates active continuity and persists the compact blocker.
- A later accepted observation starts a new regime; it never bridges the rejected or missing interval.
- Gaps longer than 120 seconds restart continuity.

## Data Exclusions

The collector does not persist:

- candles or ticks;
- raw terminal clocks;
- account, order, position, balance, or deal data;
- credentials, tokens, API keys, or secrets.

It issues no mutation request and has no arbitrary endpoint routing.

## Validation

```powershell
npm.cmd run test:v2-mt5-offset-regime-collector
npm.cmd run test:v2-mt5-offset-regime
npm.cmd run test:v2-context-foundation
```

The focused collector suite uses a loopback fixture server and verifies restart recovery, checksum validation, offline preservation, rejected-contract termination, single-writer locking, no raw candle serialization, and zero production adoption.

## Authority

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```
