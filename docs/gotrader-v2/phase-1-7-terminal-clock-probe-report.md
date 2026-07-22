# GoTrader V2 Phase 1.7 Terminal Clock Probe Report

## Starting State

- Worktree: `C:/Users/andre/OneDrive/Documents/gotrader-v2-phase0-baseline`
- Starting branch: `codex/gotrader-v2-phase-1-6-upstream-time-contract`
- Starting commit: `f364d322930b877d507d71586f93dc3a930a6f55`
- Implementation branch: `codex/gotrader-v2-phase-1-7-terminal-clock-probe`
- Implementation commit: this report ships with the Phase 1.7 implementation commit

Remotes remain `origin` for `fxgotrader-lab/gotrader-lab` and `andreduval` for `andreduval-png/gotrader-lab`.

## Discovery

- MT5 terminal: `C:/Program Files/MetaTrader 5/terminal64.exe`
- MetaEditor: `C:/Program Files/MetaTrader 5/MetaEditor64.exe`
- terminal/MetaEditor build: `5836`
- MetaTrader5 Python package: `5.0.5735`
- terminal connected: yes
- terminal automated trading setting: enabled, but the probe does not request or use it
- existing MQL5 source before Phase 1.7: none
- transport selected: `FILE_COMMON` JSON

The Phase 1 identity schema remains `gotrader-v2-market-data-identity-v2`. The default time-normalization policy remains version `1`. The upstream time contract advances additively from `1.0.0` to `1.1.0`. The terminal observation and classifier are both `1.0.0`.

## Implementation

`mt5/GoTraderClockProbe.mq5` is a single-run MQL5 script. It captures terminal clocks, USTECH quote time, and the current M5 bar-open scalar in one bounded operation. It writes one compact allowlisted JSON object through an atomic common-file replacement.

The Python reader validates the exact computed terminal-instance file only. The TypeScript and Python classifiers calculate the same clock deltas and keep transport parity, current-live verification, historical-DST verification, and Phase 2 eligibility separate.

The read-only `/time-contract` gains terminal probe metadata, classification, and verification scope. Missing/stale evidence produces a compact warning and cannot manufacture verification. Legacy candle timestamps, routes, fingerprints, and production consumers remain unchanged.

### Files

Created:

- `mt5/GoTraderClockProbe.mq5`
- `scripts/v2_mt5_terminal_clock.py`
- `scripts/read-v2-mt5-terminal-clock.py`
- `scripts/test-v2-mt5-terminal-clock.py`
- `scripts/test-v2-mt5-terminal-clock.mjs`
- `scripts/diagnose-v2-mt5-terminal-clock.mjs`
- `src/lib/v2/time/v2Mt5TerminalClockTypes.ts`
- `src/lib/v2/time/v2Mt5TerminalClock.ts`
- the Phase 1.7 design, policy, runbook, and report documents

Modified:

- the V2 time-contract schema, validator, and read-only upstream payload
- V2 identity/candle metadata propagation for stable classification version and verification scope
- the V2 baseline manifest and package scripts
- `.gitignore` so the machine-local `.ex5` binary is not committed

### Observation And Correlation Contract

The terminal observation schema is `gotrader-mt5-terminal-clock-observation@1.0.0`. The single-run script captures `TimeCurrent`, `TimeTradeServer`, `TimeGMT`, `TimeLocal`, local-computer GMT/DST settings, `SYMBOL_TIME`, `SYMBOL_TIME_MSC`, the latest M5 bar-open scalar, synchronization/read status, sequence, terminal-instance hash, and terminal build. It deliberately excludes terminal company/name/path from the emitted payload because those values are unnecessary to classify time.

The correlated Python diagnostic samples trusted system UTC before and after the read, Python tick seconds/milliseconds, Python latest M5 bar time, and wrapper tick/candle scalars. It calculates exact millisecond deltas without rewriting any raw scalar. A wrapper pass-through regression proves that the Phase 1.7 evidence fields survive `/time-contract` unchanged.

## Compile Result

- compiler: MetaEditor `5.0.0.5836`
- errors: `0`
- warnings: `0`
- source SHA-256: `1B7E6E8A4E35E345715A1E3B9A943C592A0CDB60D9D682E5C6AD34E281370002`
- local `.ex5` SHA-256: `C5FA0F87897BED69A01107F25099863D2E7B20CC257A7EF4C33C8C9A1796151F`
- binary committed: no

The source and binary were copied to the connected terminal's `MQL5/Scripts/GoTrader` folder. MT5 does not expose a safe read-only Python command to launch a terminal script, so the actual capture still requires the documented manual Navigator action.

## Live Result

Before the manual terminal run:

```text
status: blocked_terminal_probe_unavailable
reason: terminal_observation_file_missing
```

No terminal observation, exact live deltas, current-live verification, or historical-DST verification was fabricated. Phase 2 remains ineligible.

Accordingly, the implemented values and comparisons are ready, but no live numeric terminal/Python/wrapper/system result is claimed in this commit. The deterministic +180-minute fixture classifies as `verified_trade_server_wall_clock`, matches Python to `SYMBOL_TIME`, and produces exact Python-candle-to-M5-bar parity of `0 ms`. That fixture is test evidence, not a substitute for the missing terminal capture.

## Deterministic Results

Fixtures verify:

- UTC epoch classification;
- +180-minute trade-server wall-clock classification;
- current-live verification without historical promotion;
- stale, duplicate, malformed, oversized, partial, conflicting, unknown-field, sensitive-field, and authority rejection;
- exact M5 bar parity;
- identity sensitivity to classification scope;
- New York strategy-session separation.

Current-live verification and historical verification are independent. A terminal/Python match can set `currentLiveTimeBasisVerified: true` while `historicalDstPolicyVerified: false`; such a contract remains `observed_candidate`, has `timeVerificationScope: current_live`, and is not Phase 2 eligible. `strategySessionTimezone` remains `America/New_York` after canonical UTC normalization.

## Time Contract And Identity Impact

The additive read-only time-contract version is `1.1.0`. It includes terminal observation identity, schema/classification versions, terminal classification, Python transport match, current-live verification, historical-DST verification, and verification scope. Legacy `1.0.0` verified fixtures remain accepted for compatibility.

Stable V2 identity now includes terminal-clock classification version and verification scope. It excludes volatile observation IDs, capture timestamps, and raw clock values. The current-live and historical scopes therefore cannot collide, while legacy source fingerprints and all frozen strategy outputs remain unchanged.

## Acceptance Matrix

Passed on July 22, 2026:

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run test`
- `npm.cmd run test:core`
- `npm.cmd run test:strategy-baselines`
- `npm.cmd run test:source-integrity`
- `npm.cmd run test:provenance`
- `npm.cmd run test:safety`
- `npm.cmd run test:browser-smoke` (`44/44` routes)
- `npm.cmd run test:v2-baseline-snapshots`
- `npm.cmd run test:v2-candle-repository`
- `npm.cmd run test:v2-mt5-time-normalization`
- `npm.cmd run test:v2-mt5-upstream-time-contract`
- `npm.cmd run test:v2-mt5-terminal-clock`
- `npm.cmd run test:mt5-readonly-safety`
- `git diff --check`

The build retains the pre-existing Rollup large-chunk warning; no Phase 1.7 failure was reported.

## Frozen Baselines

- IFVG v3: `1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a`
- IFVG v2: `3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224`
- strategy catalog: `43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de`

## Security and Adoption

No account, balance, margin, order, position, deal, credential, DLL, network, mutation, broker, or execution capability was added. Authority remains `none / none / none`.

No production strategy, research, evidence, readiness, UI, Paper-Demo, OpenClaw, broker, or execution path adopted the probe or resulting contract.

The probe is a manually run MQL5 Script, not an Expert Advisor. It does not require automated-trading permission and contains no `CTrade`, `OrderSend`, account, position, history-deal, `WebRequest`, socket, DLL import, or unrestricted filesystem access. The reader opens only the exact terminal-instance `FILE_COMMON` path, enforces a 64 KiB cap and a field allowlist, and rejects stale, duplicate, malformed, sensitive, or non-`none` authority observations.

## Known Limitations

- The terminal script must be started manually from MT5 Navigator; Python MT5 exposes no safe read-only script-launch operation.
- The latest-observation file has not yet been generated in the connected terminal.
- One current observation can verify only a current-live basis. It cannot prove the provider's historical seasonal/DST rule.
- `TimeGMTOffset()` and `TimeDaylightSavings()` describe the local computer, not the broker timezone; they are retained only as supporting diagnostics.
- `TimeTradeServer()` is terminal-calculated and supporting evidence, while `TimeCurrent()` reflects the last known server/Market Watch quote time.

## Rollback

Revert the Phase 1.7 commit and remove the machine-local probe source/binary from the terminal Scripts folder. No legacy consumer migration is required.

## Phase 2 Decision

The source is compiled and installed, but the terminal-side observation has not been manually generated. Historical DST policy also remains unverified.

```text
PHASE 1.7 BLOCKED - LIVE TERMINAL PROBE NOT COMPLETED
```
