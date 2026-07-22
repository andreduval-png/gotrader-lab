# GoTrader V2 Phase 1.7A Contract Integration Report

## Starting State

- starting branch: `codex/gotrader-v2-phase-1-7-terminal-clock-probe`
- starting commit: `9c9747ee7227634d2d37fb76c9e6227dd86d7d9c`
- implementation branch: `codex/gotrader-v2-phase-1-7a-contract-integration`
- final commit: this report ships with the Phase 1.7A implementation commit

Authority remains `none / none / none`. Phase 2 is not implemented.

## Root Cause

Two old relative-path Python processes were simultaneously bound to port `8000`. They were launched from a different working tree before Phase 1.7 and returned `404` for `/time-contract`. The current wrapper correctly translated that failure into its version-`0` fail-closed stub. The Phase 1.7 diagnostic then reported the direct terminal classification without making endpoint agreement a prerequisite, which made the output look successful despite the version-`0` contract.

After the stale listeners were removed, the upstream was launched with the absolute Phase 1.7A script path. Its health payload now identifies:

```text
serviceVersion: gotrader-mt5-readonly-upstream-v1.1
timeContractVersion: 1.1.0
timeContractEndpointAvailable: true
```

## Corrected Data Flow

```text
GoTraderClockProbe
  -> exact terminal-instance FILE_COMMON JSON
  -> strict Python reader (120-second freshness)
  -> terminal/Python clock classifier
  -> MT5 read-only upstream contract 1.1.0
  -> wrapper pass-through with transport provenance
  -> diagnostic endpoint-agreement guard
```

Fresh `verified_trade_server_wall_clock` evidence projects to:

```text
providerTimeBasis: mt5_server_wall_clock
configurationSource: provider_metadata
verificationStatus: observed_candidate
timeVerificationScope: current_live
terminalEvidenceStatus: verified_current_live
currentLiveTimeBasisVerified: true
historicalDstPolicyVerified: false
phase2Eligible: false
```

The endpoint never promotes the provider's historical timezone/DST policy from one current offset.

## Freshness And Audit Behavior

Runtime observation freshness remains 120 seconds. Missing, malformed, oversized, stale, wrong-instance, sensitive, or conflicting observations cannot produce current-live verification. A symbol quote is independently considered stale when `TimeTradeServer()` and quote-derived `TimeCurrent()` differ by more than 120 seconds. When either the observation or quote evidence is stale, the endpoint retains contract version `1.1.0` but returns current-live false, historical false, Phase 2 false, and compact probe blockers/warnings.

A second manual capture at `2026-07-22T21:31:51Z` occurred during the USTECH maintenance window. Terminal/Python transport parity was present, but the last quote clock trailed `TimeTradeServer()` by about 1,912 seconds. The classifier now returns `terminal_quote_stale` for that state. It does not infer the broker offset from a stale quote and cannot report current-live success until an actively quoting symbol produces a fresh capture.

Repeated reads of the same still-fresh latest observation are idempotent for the HTTP projection. Duplicate detection remains available for append/audit ingestion through `TerminalClockObservationRegistry`. Volatile observation ID, sequence, capture time, raw clocks, and age are excluded from stable V2 identity.

The successful Phase 1.7 observation is documented in the Phase 1.7 report as immutable audit evidence; it is not reused as fresh runtime evidence.

## Endpoint Agreement

The diagnostic now requires all of the following before reporting current-live success:

- HTTP 200 from the wrapper contract route;
- contract ID and version `1.1.0`;
- non-stub wrapper provenance;
- direct/endpoint agreement for basis, Python transport, offset, verification status, scope, and all three eligibility booleans;
- read-only market-data contract;
- authority `none / none / none`.

Any disagreement returns `blocked_time_contract_integration_mismatch`. The diagnostic cannot hide a stale upstream with a favorable direct classification.

## Stable Identity

Stable V2 identity continues to include contract ID/version, contract verification status, classifier version, and verification scope. It excludes observation identity and all volatile clock values. Legacy source fingerprints and frozen strategy outputs remain unchanged.

## Security And Adoption

No account, order, position, deal, broker mutation, execution, readiness override, raw candle serialization, or sensitive field was introduced. No strategy, session, research-cycle, replay, evidence, readiness, UI, Paper-Demo, OpenClaw, broker, or execution consumer adopted this contract.

## Validation

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

The terminal-clock suite verifies endpoint agreement, version-`0` stub rejection, explicit Phase 2 rejection, 120-second observation expiry, and independent stale-quote rejection. The live upstream reported service version `gotrader-mt5-readonly-upstream-v1.1`, contract version `1.1.0`, a healthy read-only connection, and the wrapper exposed the same endpoint without authority changes. The final live diagnostic correctly returned `blocked_terminal_probe_unavailable` after the observation expired.

Frozen baseline hashes remain unchanged:

- IFVG v3: `1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a`
- IFVG v2: `3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224`
- strategy catalog: `43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de`

## Rollback

Revert the Phase 1.7A commit and restart the read-only upstream and wrapper from the Phase 1.7 worktree. The version-`0` wrapper fallback remains available whenever upstream contract retrieval fails.

## Final Decision

The versioned endpoint, wrapper pass-through, direct/endpoint agreement guard, and fail-closed freshness behavior are implemented. Final live acceptance still requires a fresh terminal observation while USTECH is actively quoting. Historical DST policy remains unverified and Phase 2 remains ineligible.

```text
PHASE 1.7A BLOCKED - FRESH ACTIVE-QUOTE CONTRACT CONFIRMATION PENDING
```
