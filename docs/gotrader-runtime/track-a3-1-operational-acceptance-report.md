# GoTrader Infrastructure Track A3.1 Operational Acceptance Report

## Final Status

```text
TRACK A3 IMPLEMENTATION COMPLETE - OPERATIONAL OBSERVATION INCOMPLETE
```

The persistent probe, verifier watcher, verified runtime profile, restart
reconciliation, and acceptance observer are implemented and deterministic tests
pass. Live acceptance is intentionally not claimed: the compiled EA has not yet
been attached to an actively quoting USTECH chart, and the required four-hour
observation has not run.

## 1. Starting Branch And Commit

- Source branch: `codex/gotrader-infrastructure-track-a3`
- Source commit: `168ee5a776b13f9e4522e459e68c3e728afc0499`
- Isolated implementation branch:
  `codex/gotrader-infrastructure-track-a3-1`

## 2. Final Branch And Commits

- Persistent probe commit:
  `2afc41eead474f4543bd447cd67173d62fbac95d`
- Final A3.1 integration commit: recorded after this report is committed.

## 3. Files Created And Modified

The isolated change set adds the persistent MQL5 EA, strict Python parser tests,
collector/watcher services, watcher state engine, operator controls, acceptance
observer, verified profile wiring, integration tests, and this report. Existing
A1, A2, and A3 profiles remain available.

## 4. Probe Deployment Model

`GoTraderClockProbeEA` is a timer-driven Expert Advisor installed under:

```text
MQL5\Experts\GoTrader\GoTraderClockProbeEA
```

The installer locates the active terminal data folder through read-only MT5
terminal metadata, copies source, compiles with MetaEditor, and requires zero
errors and zero warnings. It never attaches the EA automatically.

## 5. Probe Refresh Interval

- default: 30 seconds;
- lower bound: 10 seconds;
- upper bound: 60 seconds;
- refresh source: `OnTimer`;
- one-shot `GoTraderClockProbe` remains available.

## 6. Terminal Identity

The compact probe contains schema/version, observation ID, terminal-instance
fingerprint, data-path fingerprint, terminal build, server fingerprint,
requested/broker/chart symbol, chart timeframe, generated/local/server/GMT
times, quote time, M5 bar time, and connection state. It excludes account
number, balance, equity, margin, orders, positions, deals, and credentials.

## 7. Atomic Output Model

The EA writes a per-terminal temporary file in `FILE_COMMON`, closes it, and
atomically replaces the active artifact. The reader rejects partial, malformed,
oversized, future, stale, wrong-instance, wrong-symbol, disconnected, stopped,
sensitive, and conflicting duplicate observations.

## 8. Verifier Watch Architecture

```text
MT5 persistent EA
  -> compact common-file probe
  -> read-only Python correlation
  -> upstream /time-contract
  -> bridge /time-contract
  -> watcher agreement and artifact
  -> continuous feed close eligibility
  -> scheduler
  -> shadow context
```

The watcher runs browser-independently, polls every 10 seconds by default,
persists compact atomic state, and exposes loopback GET-only health/status.

## 9. Proof Renewal Behavior

- accepted proof freshness ceiling: 120 seconds;
- artifact lifetime: 180 seconds;
- new observations renew proof;
- identical observations do not renew;
- changed content under an existing observation ID blocks;
- transient failures preserve existing proof only until natural expiry;
- hard identity, connection, or agreement failures block immediately;
- historical DST eligibility always remains false.

Continuity is stable across accepted renewals and restarts. A gap over 180
seconds or a terminal/basis/offset identity change starts a new continuity
regime.

## 10. Runtime Profile

New profile:

```text
always_on_shadow_context_verified
```

It is additive. The existing `always_on_read_only`,
`always_on_read_only_scheduler`, and `always_on_shadow_context` profiles are
unchanged.

## 11. Dependency Order

```text
mt5_terminal
mt5_readonly_upstream
mt5_readonly_bridge
current_live_time_verifier
market_data_feed
autonomous_cycle_scheduler
shadow_context_refresh
```

## 12. Diagnostics And Controls

Commands:

```text
gotrader:time:install-probe
gotrader:time:watch-current-live
gotrader:time:status
gotrader:time:stop-watch
gotrader:time:resume-watch
gotrader:verified:scheduler:status
gotrader:verified:context:status
gotrader:observe:a3-acceptance
```

Status includes probe state/age/identity, verification ID/time/expiry, renewal
and failure counts, continuity start/reset count, provider basis, offset,
current-live eligibility, and historical eligibility. Raw probes are not
served.

## 13. Verified Close Results

Deterministic integration accepted two sequential fixture close boundaries,
including one after restart/expiry recovery, with zero duplicates.

Live isolated observation on 2026-07-23:

- accepted M5 closes: 0;
- rejected/blocked because persistent probe was stale;
- quote and candle endpoints remained available;
- no missed close was accepted retroactively.

## 14. Context-Cycle Results

Deterministic integration produced exactly two context task cycles for two
accepted close IDs. Live context cycles: 0 because close eligibility was
blocked before scheduling.

Higher-timeframe windows are limited to the live rolling store. Missing M5,
M15, H1, H4, or D1 data returns an explicit
`insufficient_context_window:<timeframe>` blocker; the live queue does not fetch
deep history.

## 15. Restart Reconciliation Results

Deterministic A3.1 integration passed:

- watcher state restart and renewal continuation;
- scheduler restart with no duplicate task cycle;
- feed restart with no duplicate close;
- proof expiry blocks new close;
- recovery re-baselines without retroactive close;
- next verified close creates exactly one additional context cycle.

## 16. Observation Duration

- required: 14,400 seconds (four hours);
- live diagnostic sample: 12 seconds;
- market-hour span: 0 hours;
- status: incomplete.

The short sample verifies fail-closed operations only; it is not operational
acceptance.

## 17. Proof Uptime

Live accepted-proof uptime was 0%. The active terminal was connected, but its
previous one-shot observation was stale and the persistent EA was not attached.
Accepted verifier renewals were therefore 0.

## 18. Duplicate Counts

- deterministic duplicate close count: 0;
- deterministic duplicate context count: 0;
- live duplicate close count: 0;
- live duplicate context count: 0.

## 19. Conflict Counts

- deterministic payload conflicts: 0;
- live payload conflicts: 0;
- conflicting duplicate probe behavior: covered and blocked by tests.

## 20. Ledger-Gap Counts

- deterministic ledger gaps: 0;
- live sampled ledger gaps: 0.

## 21. Resource Metrics

Twelve-second isolated live sample:

- maximum feed RSS: 75,853,824 bytes;
- maximum scheduler RSS: 96,141,312 bytes;
- maximum verifier RSS: 57,098,240 bytes;
- maximum queue depth: 0;
- feed CPU delta: 78,000 microseconds;
- scheduler CPU delta: 62,000 microseconds;
- verifier CPU delta: 0 microseconds;
- transport failures: 0;
- managed restarts: 0.

## 22. Test Commands And Exact Results

All required suites passed:

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | passed |
| `npm.cmd run build` | passed; existing Rollup circular-chunk and size warnings only |
| `npm.cmd run test` | passed |
| `npm.cmd run test:gotrader-runtime` | passed, 13/13 |
| `npm.cmd run test:gotrader-continuous-feed` | passed |
| `npm.cmd run test:gotrader-autonomous-scheduler` | passed |
| `npm.cmd run test:gotrader-runtime-a2-integration` | passed |
| `npm.cmd run test:gotrader-current-live-time-verification` | passed |
| `npm.cmd run test:gotrader-shadow-context` | passed |
| `npm.cmd run test:gotrader-runtime-a3` | passed |
| `npm.cmd run test:gotrader-terminal-clock-probe` | passed |
| `npm.cmd run test:gotrader-time-verifier-watch` | passed |
| `npm.cmd run test:gotrader-runtime-a3-1-integration` | passed |
| `npm.cmd run test:core` | passed, 26 commands |
| `npm.cmd run test:strategy-baselines` | passed, 14 commands |
| `npm.cmd run test:source-integrity` | passed, 16 commands |
| `npm.cmd run test:provenance` | passed |
| `npm.cmd run test:safety` | passed |
| `npm.cmd run test:browser-smoke` | passed, 44/44 |
| `npm.cmd run test:v2-ifvg-phase3-evidence` | passed |
| `git diff --check` | passed; line-ending notices only |

## 23. Frozen Hashes

Unchanged:

- IFVG v3:
  `1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a`
- IFVG v2:
  `3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224`
- strategy catalog:
  `43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de`

## 24. Authority And Safety Result

```text
marketDataCapability: read_only
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
historicalEligible: false
```

No account, order, position, deal, execution, evidence, readiness, profile
mutation, or calibration capability was added.

## 25. Known Limitations

1. The operator must attach the compiled EA to an actively quoting USTECH chart
   once after installation.
2. Four-hour operational observation remains unrun.
3. Three real verified M5 closes and three real context cycles remain
   unobserved.
4. Higher-timeframe live windows need natural accumulation and may initially
   block context while M5 closes are still accepted.
5. Historical DST/time normalization remains a separate unverified contract.

## 26. Rollback

1. Stop `always_on_shadow_context_verified`.
2. Remove the EA from its MT5 chart or disable automated trading at the EA
   level; the EA has no trading code.
3. Start `always_on_shadow_context`, `always_on_read_only_scheduler`, or
   `always_on_read_only`.
4. Preserve runtime state and logs for diagnosis.

## 27. Track A4 Prerequisites

Before Track A4:

- attach and verify the persistent EA;
- run at least four continuous hours during active market time;
- observe at least three accepted M5 closes;
- observe at least three completed context cycles;
- span at least two market hours;
- retain zero duplicate closes/context artifacts, conflicts, and ledger gaps;
- document restart reconciliation from live events;
- review the complete integrity-hashed acceptance report.

## 28. Explicit Disabled-Capability Confirmation

All remain disabled:

```text
shadow_ifvg_comparison
trade_intent_generation
Paper-Demo
broker execution
evidence creation
readiness promotion
profile mutation
calibration apply
AI execution authority
```

Track A4 was not implemented.
