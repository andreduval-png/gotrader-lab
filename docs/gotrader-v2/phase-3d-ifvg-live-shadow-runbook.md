# GoTrader V2 Phase 3D IFVG v3 Live Shadow Runbook

## Purpose

Phase 3D observes IFVG v3 selection parity on current, closed MT5 read-only
candle windows. It compares the legacy IFVG v3 selection with the Phase 3C
shadow selection and stores only compact parity observations.

This collector does not replace the legacy detector, create validation-chain
evidence, change readiness, promote Paper-Demo status, or permit execution.

## Prerequisites

1. MT5 Desktop is open and connected.
2. The local MT5 read-only upstream and wrapper are running.
3. The terminal clock observation is fresh.
4. The current offset regime has been verified.
5. The wrapper exposes only fixed read-only health and candle routes.

The compiled terminal probe is expected at:

```text
C:\Users\andre\AppData\Roaming\MetaQuotes\Terminal\D0E8209F77C8CF37AD8BF550E51FF075\MQL5\Scripts\GoTrader\GoTraderClockProbe.ex5
```

Run it from a connected USTECH chart. It writes the compact clock observation
to:

```text
C:\Users\andre\AppData\Roaming\MetaQuotes\Terminal\Common\Files\GoTrader\gotrader-mt5-clock-probe-7BC52F8E.json
```

## Verify Time Eligibility

From the isolated V2 worktree:

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-v2-phase0-baseline
npm.cmd run diagnose:v2-mt5-terminal-clock
npm.cmd run collect:v2-mt5-offset-regime -- --once
```

Do not proceed on an inferred or stale clock basis. Current-live comparison
requires an explicit, fresh terminal observation and a continuous offset
regime.

## Collect One Observation

```powershell
npm.cmd run collect:v2-ifvg-live-shadow
```

Optional watch mode:

```powershell
npm.cmd run collect:v2-ifvg-live-shadow -- --watch
```

The default state file is:

```text
.gotrader\v2\ifvg-v3-live-shadow-USTECH-5m.json
```

Environment overrides:

```text
GOTRADER_MT5_READONLY_URL
GOTRADER_REQUESTED_SYMBOL
GOTRADER_BROKER_SYMBOL
GOTRADER_IFVG_LIVE_SHADOW_PRIMARY_TIMEFRAME
GOTRADER_IFVG_LIVE_SHADOW_POLL_MS
GOTRADER_IFVG_LIVE_SHADOW_STATE_FILE
```

The wrapper URL must be loopback. The collector calls only:

```text
GET /time-contract
GET /candles
```

## Persistence Rules

- One observation is stored per distinct closed primary window.
- Repeating an identical observation is idempotent.
- A contradictory result for the same closed window is rejected.
- The ledger retains at most 256 compact observations.
- A blocked source, time basis, context, or primary window is reported but not
  persisted.
- Raw candles remain in process memory and are never written to the ledger.

Distinct closed windows are operational canary observations. They are not
claimed to be statistically independent samples.

## Acceptance Conditions

A persisted observation requires:

- MT5 read-only source and matching source identity;
- `current_live_shadow` context purpose;
- eligible current-live time basis;
- comparison-eligible canonical context;
- a non-stale, non-empty, closed M5 primary window;
- a normalized legacy IFVG v3 observation;
- compact Phase 3C selection comparison.

The expected canary result is `exact_parity`. Any `regression` stops migration
review and leaves legacy behavior authoritative.

## Validation

```powershell
npm.cmd run test:v2-ifvg-live-shadow
npm.cmd run test:core
npm.cmd run test:strategy-baselines
npm.cmd run test:source-integrity
npm.cmd run test:provenance
npm.cmd run test:safety
npm.cmd run test:browser-smoke
```

## Safety

Phase 3D is shadow-only. It does not call MT5 account, order, position, deal, or
execution APIs. It cannot create evidence or validation-chain entries.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
```
