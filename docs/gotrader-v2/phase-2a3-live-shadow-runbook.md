# GoTrader V2 Phase 2A.3 Live Shadow Verification Runbook

## Purpose

This runbook verifies whether current-live MT5 data is eligible to produce shadow session and opening-price facts. It does not adopt those facts into production GoTrader behavior.

## Current Verification State

On 2026-07-22 the local MT5 read-only wrapper at `http://127.0.0.1:7341` reported live upstream candle availability. The terminal time contract was not current:

```text
providerTimeBasis: unknown
currentLiveTimeBasisVerified: false
historicalDstPolicyVerified: false
terminalProbeInstanceId: null
```

Therefore fixture behavior is verified, but current-live fact adoption remains blocked. GoTrader must not infer or hard-code the missing terminal basis.

## Refresh the Terminal Observation

1. Open MT5 Desktop and confirm it is connected.
2. Open a USTECH chart.
3. Run the compiled `GoTraderClockProbe` script on that chart:

```text
C:\Users\andre\AppData\Roaming\MetaQuotes\Terminal\D0E8209F77C8CF37AD8BF550E51FF075\MQL5\Scripts\GoTrader\GoTraderClockProbe.ex5
```

4. Confirm a fresh observation appears at:

```text
C:\Users\andre\AppData\Roaming\MetaQuotes\Terminal\Common\Files\GoTrader\gotrader-mt5-clock-probe-7BC52F8E.json
```

5. From the isolated V2 worktree, rerun:

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-v2-phase0-baseline
npm.cmd run diagnose:v2-mt5-terminal-clock
npm.cmd run collect:v2-mt5-offset-regime -- --once
```

## Acceptance Conditions

Before any current-live session/opening fact evaluation:

- terminal evidence is fresh and `verified_current_live`;
- provider time basis is explicit;
- current-live eligibility is true;
- the offset-regime collector has established uninterrupted continuity;
- the requested M5 window starts at or after the verified regime start;
- all candles are closed and at or before `asOfMarketTime`.

A current-live observation does not establish historical DST correctness. Replay, walk-forward, deep-history evidence, and readiness remain blocked until their separate historical-time requirements pass.

## Deterministic Verification

```powershell
npm.cmd run test:v2-session-opening-facts
npm.cmd run test:v2-context-foundation
npm.cmd run test:v2-mt5-offset-regime
npm.cmd run test:v2-mt5-offset-regime-collector
```

The fixture suite covers summer and winter New York boundaries, complete and partial sessions, strict missing-boundary behavior, M5 enforcement, stable identities, no raw-candle serialization, zero production adoption, and authority `none / none / none`.

## Safety

The terminal probe, read-only wrapper, offset-regime collector, and shadow fact engine do not call account, order, position, deal, or execution APIs. No broker mutation or readiness promotion is possible.
