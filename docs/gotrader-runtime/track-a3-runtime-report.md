# GoTrader Infrastructure Track A3 Runtime Report

## Final Status

```text
TRACK A3 BLOCKED - VERIFIED CLOSE OR CONTEXT IDEMPOTENCY INSUFFICIENT
```

The implementation and deterministic tests pass. Operational acceptance remains
blocked because the connected terminal has no fresh manual clock-probe evidence,
so no verified live M5 close or live context cycle was accepted.

## 1-3. Repository And Change Set

- Starting branch: `codex/gotrader-infrastructure-track-a2`
- Starting commit: `f6645b919475f46e99d3639274b15de0bc06752c`
- Final branch: `codex/gotrader-infrastructure-track-a3`
- Final commit: recorded after this report is committed
- A1/A2 profiles remain available and unchanged in behavior.
- Modified runtime: upstream time contract, continuous feed, scheduler, runtime
  profile registry, and package scripts.
- Added verifier, observation harness, context controller, controls, tests,
  design, runbook, and this report.

## 4-10. Time Verification

The manual `GoTraderClockProbe` captures terminal local/server/GMT, USTECH quote,
and bounded M5 clock observations. The Python upstream correlates the probe with
read-only tick/candle observations. Its `/time-contract` is passed through by the
bridge. `gotrader:time:verify-current-live` compares both surfaces and writes a
compact hashed artifact.

Policy:

- fresh: age `<=120s`;
- expiring: age `>120s` and `<=180s`;
- stale: age `>180s`;
- only fresh current-live proof is eligible;
- historical DST verification remains false.

Agreement covers contract/artifact identity, scope, provider basis, offset,
generated/expiry time, classifier, and eligibility. Any mismatch blocks.

## 11-12. Close Acceptance And Observation

Feed events include the accepted verification artifact ID. Invalid proof blocks
new close events. Recovery re-baselines each candle series, preventing a later
proof from retroactively accepting closes that occurred while proof was invalid.

The observation harness records compact counts for proof refresh/expiry, quote
and forming updates, accepted/rejected closes, duplicates, conflicts,
reconciliation, context cycles, queue pressure, drops/coalescing, CPU, memory,
and ledger gaps. No raw candles are written.

Live sample on 2026-07-23:

- MT5 terminal PID: `33004`, connected through read-only upstream;
- isolated ports: upstream `18010`, bridge `17351`, feed `17353`, scheduler
  `17354`;
- upstream/bridge market data: available;
- provider basis: `unknown`;
- observed offset candidate: `180` minutes;
- terminal evidence: stale/missing;
- accepted close count: `0`;
- rejected close candidates at sampled status: `144`;
- live context cycles: `0`;
- duplicate closes: `0`;
- payload conflicts: `0`;
- ledger gaps: `0`;
- two-second harness result: blocked as expected.

## 13-18. Shadow Context Architecture

Enabled task types in the A3 profile:

```text
runtime_health_snapshot
current_market_snapshot
shadow_context_refresh
```

`shadow_ifvg_comparison` remains disabled. The context trigger is only a durable
MNQ/USTECH M5 close. Inputs are bounded M5, M15, H1, H4, and D1 feed windows.
The V2 canonical context builder is invoked without strategy imports.

Artifacts store trigger/close IDs, source/time-proof identity, window identities,
context versions, fact-kind counts, diagnostics, and authority. They explicitly
record `rawCandlesPersisted: false`, `rawFactsPersisted: false`,
`canCreateEvidence: false`, and `productionAdoptionAllowed: false`.

Cycle IDs are stable across receipt time and restart. Context state and the
compact ledger use atomic writes. Corrupt state blocks. Current-live proof does
not grant historical eligibility.

## 19-22. Scheduling, Profile, Controls, Budgets

- concurrency: one context task;
- retry: one;
- timeout: five seconds;
- maximum live input: 300 candles per timeframe;
- artifact retention: 1,000;
- controls: status, pause, resume;
- profile: `always_on_shadow_context`;
- Node heap caps: 256 MB for feed and scheduler.

Pause survives restart and affects context intake only.

## 23-28. Deterministic And Live Results

Deterministic checks prove fresh/expiry/mismatch behavior, compact artifact
safety, proof propagation, non-retroactive baseline behavior, close-trigger
scope, scheduler allowlisting, canonical context invocation, effective-once
context persistence, and strategy neutrality.

The isolated live profile started all four managed services and released all
four ports after stop. Feed and scheduler correctly remained blocked by:

```text
current_live_time_basis_not_verified
terminal_time_evidence_stale
current_live_verification_artifact_missing
current_live_verification_scope_invalid
current_live_proof_missing
current_live_verification_expiry_missing
```

No verified close was available, so restart idempotency was not claimed from
live data. Extended observation completed: 2 seconds only. Required four-hour
observation remains incomplete.

## 29. Validation

All required deterministic and regression commands passed:

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | passed through `test:core` |
| `npm.cmd run build` | passed; pre-existing Rollup circular-chunk and large-chunk warnings only |
| `npm.cmd run test` | passed |
| `npm.cmd run test:gotrader-runtime` | passed, 13/13 |
| `npm.cmd run test:gotrader-continuous-feed` | passed |
| `npm.cmd run test:gotrader-autonomous-scheduler` | passed |
| `npm.cmd run test:gotrader-runtime-a2-integration` | passed; retroactive recovery close suppressed |
| `npm.cmd run test:gotrader-current-live-time-verification` | passed |
| `npm.cmd run test:gotrader-shadow-context` | passed |
| `npm.cmd run test:gotrader-runtime-a3` | passed |
| `npm.cmd run test:core` | passed, 26 commands |
| `npm.cmd run test:strategy-baselines` | passed, 14 commands |
| `npm.cmd run test:source-integrity` | passed, 16 commands |
| `npm.cmd run test:provenance` | passed |
| `npm.cmd run test:safety` | passed |
| `npm.cmd run test:browser-smoke` | passed, 44/44 |
| `npm.cmd run test:v2-ifvg-phase3-evidence` | passed; Phase 4 remains unauthorized |
| `git diff --check` | passed; line-ending notices only |

The focused A3 tests additionally prove proof expiry/mismatch blocking,
historical-verification separation, proof propagation, strategy-neutral
canonical context invocation, effectively-once context identity, compact-only
artifacts, and unchanged authority.

## 30. Frozen Hashes

Unchanged expected baselines:

- IFVG v3:
  `1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a`
- IFVG v2:
  `3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224`
- strategy catalog:
  `43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de`

## 31. Authority And Safety

```text
marketDataCapability: read_only
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
```

No account, order, position, deal, execution, evidence, readiness, calibration,
or profile-mutation capability was added.

## 32-35. Limitations, Rollback, And Next Gate

Known limitations:

1. fresh terminal-side proof still requires the manual MQL5 probe;
2. no verified live M5 close has been observed;
3. the four-hour observation is incomplete;
4. required higher-timeframe rolling windows may remain pre-verification until
   enough live closes accumulate.

Rollback is to stop `always_on_shadow_context` and use the unchanged A2 profile.

Track A4 prerequisites are a fresh proof, at least three verified M5 closes and
three context cycles across two market hours, a minimum four-hour observation,
zero duplicate/conflict/gap findings, and documented restart reconciliation.

`shadow_ifvg_comparison`, trade intent, Paper-Demo, broker execution, readiness
promotion, evidence creation, profile mutation, calibration apply, and AI
execution authority remain disabled.
