# GoTrader Infrastructure Track A3.1 Operational Acceptance Report

## Final Status

```text
TRACK A3.1 FOUR-HOUR OBSERVATION COMPLETE - PARTIAL ACCEPTANCE / TRACK A4 BLOCKED
```

The persistent probe, verifier watcher, verified runtime profile, restart
reconciliation, and acceptance observer are implemented and deterministic tests
pass. A four-hour live observation completed on 2026-07-23 with 21 verified M5
closes, exact-once event delivery, automatic post-market-break recovery, and
zero duplicate, conflict, or ledger-gap failures. Full operational acceptance
is not claimed because proof freshness did not span the scheduled market break,
no higher-timeframe context cycle completed, and the observer recorded one
transport timeout.

## 1. Starting Branch And Commit

- Source branch: `codex/gotrader-infrastructure-track-a3`
- Source commit: `168ee5a776b13f9e4522e459e68c3e728afc0499`
- Isolated implementation branch:
  `codex/gotrader-infrastructure-track-a3-1`

## 2. Final Branch And Commits

- Persistent probe commit:
  `2afc41eead474f4543bd447cd67173d62fbac95d`
- A3.1 implementation commit:
  `1e10113`
- Live-discovered stabilization commits:
  `5501a92`, `1695cf1`, `d470e8a`, and `143342f`
- Final operational report commit: recorded after this report is committed.

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

Four-hour live observation on 2026-07-23:

- accepted M5 closes: 21;
- matching shadow-context task triggers: 21;
- duplicate closes: 0;
- payload conflicts: 0;
- ledger gaps: 0;
- managed feed, scheduler, and verifier restarts: 0;
- market-break closes were not accepted while verified time was unavailable;
- processing resumed automatically after fresh terminal correlation returned.

## 14. Context-Cycle Results

Deterministic integration produced exactly two context task cycles for two
accepted close IDs. The live observer recorded 21 exactly-once context task
triggers. Completed live context cycles remained 0 because all 21 attempts
failed closed on:

```text
insufficient_context_window:4h
insufficient_context_window:1d
```

Higher-timeframe windows are limited to the live rolling store. Missing M5,
M15, H1, H4, or D1 data returns an explicit
`insufficient_context_window:<timeframe>` blocker; the live queue does not fetch
deep history. The live result confirms that historical higher-timeframe
hydration is required before Track A4.

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
- live observation: 14,403 seconds;
- market-hour span: 3.75 hours;
- duration check: passed;
- market-hour-span check: passed;
- status: `observation_incomplete` because not all acceptance checks passed.

## 17. Proof Uptime

Live accepted-proof uptime was 75.72%, with 358 accepted renewals. Proof was
fresh before the scheduled market break, failed closed while the terminal
server/tick clock remained frozen at the last market timestamp, and recovered
automatically when quoting resumed. The break produced 368 failed verification
samples and caused `proofFreshnessMaintained` to fail.

The behavior protected the feed correctly, but market-closed state must be
classified separately from a broken live time contract. A future acceptance run
must show an explicit healthy paused state during the break and require fresh
correlation before resuming.

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
- live four-hour ledger gaps: 0.

## 21. Resource Metrics

Four-hour live observation:

- maximum feed RSS: 181,673,984 bytes;
- maximum scheduler RSS: 109,133,824 bytes;
- maximum verifier RSS: 73,089,024 bytes;
- maximum queue depth: 0;
- feed CPU delta: 157,704,000 microseconds;
- scheduler CPU delta: 39,109,000 microseconds;
- verifier CPU delta: 21,266,000 microseconds;
- observer transport failures: 1;
- managed restarts: 0.

The isolated observer timeout did not stop any runtime process and subsequent
checkpoints continued, but `noObserverTransportFailures` correctly failed.

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

Final four-hour close-out validation:

| Command | Result |
| --- | --- |
| integrity-hash recomputation | passed; `sha256:9cd59f43c4758810e1eac5b548477f2de0753708589a279a4c1429789c7e8567` |
| `npm.cmd run typecheck` | passed |
| `npm.cmd run build` | passed; existing Rollup circular-chunk and size warnings only |
| `npm.cmd run test:gotrader-terminal-clock-probe` | passed |
| `npm.cmd run test:gotrader-current-live-time-verification` | passed |
| `npm.cmd run test:gotrader-time-verifier-watch` | passed |
| `npm.cmd run test:gotrader-runtime-a3-1-integration` | passed |
| `npm.cmd run test:gotrader-continuous-feed` | passed |
| `npm.cmd run test:gotrader-autonomous-scheduler` | passed |
| `npm.cmd run test:gotrader-shadow-context` | passed |
| `npm.cmd run test:mt5-readonly-safety` | passed |

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

1. Scheduled market closure freezes the terminal server/tick clock and currently
   appears as proof degradation rather than an explicit market-closed pause.
2. Higher-timeframe live windows are not hydrated from read-only historical
   candles, so `4h` and `1d` context remain unavailable after a fresh startup.
3. One observer HTTP request timed out during the four-hour run.
4. Historical DST/time normalization remains a separate unverified contract.
5. Full operational acceptance remains blocked until the failed checks pass in
   a new observation.

## 26. Rollback

1. Stop `always_on_shadow_context_verified`.
2. Remove the EA from its MT5 chart or disable automated trading at the EA
   level; the EA has no trading code.
3. Start `always_on_shadow_context`, `always_on_read_only_scheduler`, or
   `always_on_read_only`.
4. Preserve runtime state and logs for diagnosis.

## 27. Track A4 Prerequisites

Before Track A4:

- add an explicit market-closed or market-quiet verifier state;
- pause safely without treating a frozen last tick as new time evidence;
- require fresh terminal correlation before reopening the feed;
- hydrate `4h` and `1d` canonical windows from MT5 read-only history;
- make observer transport sampling tolerant of one transient request without
  hiding or deleting the failure;
- rerun at least four continuous hours across active and closed/open boundaries;
- observe at least three completed context cycles;
- retain zero duplicate closes/context artifacts, conflicts, and ledger gaps;
- achieve all acceptance checks in the integrity-hashed final report.

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
