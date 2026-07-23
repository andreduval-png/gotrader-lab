# GoTrader Infrastructure Track A2 Runtime Report

Generated: 2026-07-23

## Final Status

**TRACK A2 PASSED WITH DOCUMENTED FEED OR OBSERVATION LIMITATIONS**

The continuous feed and closed-candle scheduler are established and pass deterministic
restart, deduplication, recovery, resource, safety, and browser compatibility checks.
Live MT5 transport, quotes, forming candles, and rolling stores were observed on isolated
ports. Live close-event acceptance remains blocked by stale/unverified terminal clock
evidence, so no live close or scheduled cycle is claimed.

## 1. Starting Branch And Commit

```text
branch: codex/gotrader-infrastructure-track-a1
commit: d1d47b5 Add always-on read-only runtime foundation
```

## 2. Final Branch And Commit

```text
branch: codex/gotrader-infrastructure-track-a2
commit: the isolated implementation commit containing this report
```

## 3. Files Created And Modified

Created:

- `src/lib/alwaysOnRuntime/feed/*`
- `src/lib/alwaysOnRuntime/scheduler/*`
- `scripts/gotrader-continuous-feed-core.mjs`
- `scripts/gotrader-continuous-feed.mjs`
- `scripts/gotrader-autonomous-scheduler-core.mjs`
- `scripts/gotrader-autonomous-scheduler.mjs`
- `scripts/gotrader-scheduler-control.mjs`
- dedicated feed, scheduler, and integration tests;
- an isolated fixture market source;
- Track A2 design, registry, operations, recovery, and report documents.

Modified:

- `package.json`
- Track A1 runtime profile, supervisor, control, shared runtime types, and tests.

The original A1 profile remains unchanged in behavior.

## 4. Feed Architecture

```text
MT5 Desktop
  -> MT5 read-only Python upstream
    -> GoTrader read-only bridge
      -> market_data_feed
        -> latest quote
        -> forming candle state
        -> bounded closed-candle rolling stores
        -> compact durable event ledger
          -> autonomous_cycle_scheduler
```

React and localStorage are not involved.

## 5. Transport Choice

The existing bridge has bounded HTTP endpoints and no independent WebSocket or SSE
transport. A single service-level poller is used:

```text
quote: 1 second
candles: 5 seconds
time contract: before every candle poll and at least every 10 seconds
request timeout: 3 seconds
```

The first draft cached clock proof longer than a candle poll. The integration test exposed
that race, and the implementation now refreshes time proof before every candle request.

## 6. Rolling-Store Capacities

```text
M1  2,000
M5  2,000
M15 1,500
H1  1,000
H4  750
D1  500
W1  260
```

Stores are ascending, deduplicated, bounded, process-local, and absent from logs and
durable status.

## 7. Event Contracts

```text
quote_updated
forming_candle_updated
candle_closed
feed_stale
feed_recovered
source_blocked
```

All events carry stable source lineage, symbols, timeframe when relevant, market and
receipt times, time-contract version, read-only market-data capability, and authority
`none / none / none`.

## 8. Closed-Candle Proof

Close events require verified current-live MT5 time basis, fresh terminal evidence,
elapsed normalized close time, no future timestamp, no payload conflict, and a new stable
close ID. The Windows wall clock is not a substitute.

## 9. Effectively-Once Policy

Transport is described accurately as at-least-once. Stable close IDs, a bounded emitted-ID
ledger, separate payload hashes, deterministic cycle IDs, and atomic checkpoints provide
effectively-once artifacts. Receipt time is excluded from identity. A conflicting payload
for an established close blocks the source.

## 10. Scheduler Architecture

Only durable `candle_closed` events trigger work. Quote/forming/state events do not.
Scheduler and feed are independent supervisor-managed processes. A slow task cannot move
polling into the browser.

## 11. Task Allowlist

Enabled:

```text
runtime_health_snapshot
current_market_snapshot
```

Registered disabled:

```text
shadow_context_refresh
shadow_ifvg_comparison
```

Trade intent, Paper-Demo order creation, broker execution, readiness promotion, evidence,
profile mutation, calibration apply, replay, walk-forward, OOS, and Monte Carlo are
prohibited.

## 12. Queue And Concurrency

```text
maximum queue depth: 100
concurrency: one per task type
enabled task timeout: 2 seconds
enabled task retry limit: 1
```

Duplicate events coalesce. Excess events are counted and bounded. Failed or timed-out
work becomes a compact failed artifact.

## 13. Checkpoint Model

Feed state records series baselines, last close by series, emitted event IDs, payload
hashes, conflict IDs, time eligibility, and counters.

Scheduler state records the event cursor, processed event IDs, completed task IDs, pause
state, counts, and latest outcome. Artifacts contain source metadata and output IDs only.

## 14. Recovery Behavior

Deterministic integration proved:

- feed baseline without historical close flood;
- one close event for one new close;
- scheduler restart without duplicate artifacts;
- durable pause and retained event processing after resume;
- loss of time proof stops new close events;
- verified recovery reconciles the missed close;
- mutation requests return 405;
- a ledger retention gap blocks instead of silently skipping.

## 15. Runtime Profiles

Preserved:

```text
always_on_read_only
```

Added:

```text
always_on_read_only_scheduler
```

The A2 profile adds `market_data_feed` and `autonomous_cycle_scheduler` after the bridge.
It does not silently alter A1.

## 16. Status And Health

Feed status projects state, quote/forming/close times, bounded store counts, event counters,
time eligibility, checkpoint health, blockers, and warnings.

Scheduler status projects feed eligibility, cursor, cycles, artifacts, queue/counters,
active/enabled/disabled tasks, checkpoint health, and latest outcome. A stale status file
is reported as stopped when its process is no longer running.

## 17. Resource Budgets

```text
Node heap ceiling: 256 MiB per new service
feed event ledger: 5,000
scheduler artifacts: 1,000
processed events: 10,000
completed task IDs: 20,000
queue: 100
feed request timeout: 3 seconds
```

Live 20-second observation:

```text
feed working set: 64.6 MiB
scheduler working set: 54.8 MiB
feed CPU: 0.83 seconds
scheduler CPU: 0.39 seconds
queue depth: 0
dropped/coalesced: 0/0
```

## 18. Live Acceptance

Default ports remained foreign-owned and untouched:

```text
8000 -> PID 33876
7341 -> PID 37316
```

The full A2 profile started on isolated ports:

```text
18000 upstream
17341 bridge
17343 feed
17344 scheduler
```

Observed:

```text
quote updates: advancing
forming updates: advancing
rolling stores: 300 each for 1m, 5m, 15m, 1h, 4h, 1d
feed state: blocked
scheduler state: degraded
closed events/cycles: 0/0
```

Reason:

```text
current_live_time_basis_not_verified
terminal_time_evidence_stale
closed_candle_events_paused_until_time_contract_is_verified
```

The isolated profile stopped cleanly and released all four isolated ports. MT5 Desktop
and the two foreign default-port processes remained running.

## 19. Extended Observation

Only a 20-second live sample was run in this implementation session. It proves transport
and fail-closed behavior, not unattended multi-hour reliability. Multi-hour observation
and at least one live verified M5 close remain operational acceptance work.

## 20. Tests And Commands

Passed:

```text
npm.cmd run build
npm.cmd run test
npm.cmd run test:gotrader-runtime
npm.cmd run test:gotrader-continuous-feed
npm.cmd run test:gotrader-autonomous-scheduler
npm.cmd run test:gotrader-runtime-a2-integration
npm.cmd run test:core
npm.cmd run test:strategy-baselines
npm.cmd run test:source-integrity
npm.cmd run test:provenance
npm.cmd run test:safety
npm.cmd run test:browser-smoke
npm.cmd run test:v2-ifvg-phase3-canary-gate
npm.cmd run test:v2-ifvg-phase3-evidence
git diff --check
```

`build` retains existing Rollup circular-chunk and large-chunk warnings.

## 21. Exact Results

```text
runtime tests: 13 passed
feed tests: passed
scheduler tests: passed
integration: 3 close events, 6 artifacts, no duplicates
browser smoke: 44 passed
core baseline suite: passed
strategy baseline suite: passed
source integrity: passed
provenance: passed
safety: passed
Phase 3 gate/evidence: passed, Phase 4 still unauthorized
```

## 22. Frozen Hashes

Unchanged:

```text
IFVG v3
1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a

IFVG v2
3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224

strategy catalog
43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de
```

## 23. Authority And No-Execution Result

```text
marketDataCapability: read_only
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
```

Safety suites and static import checks passed.

## 24. Known Limitations

1. terminal-side current-live time verification is stale/missing;
2. no live close event can be accepted until that proof is refreshed;
3. no multi-hour observation was completed;
4. the durable ledger is bounded, so an excessive outage becomes an explicit
   reconciliation blocker;
5. only strategy-neutral snapshot tasks are enabled.

## 25. Rollback

Stop the A2 profile, verify managed ports are released, return to
`always_on_read_only`, and revert the isolated Track A2 commit. No strategy, evidence,
readiness, Paper-Demo, or execution state is affected.

## 26. Track A3 Prerequisites

Before any later task enablement:

1. refresh terminal clock evidence;
2. observe at least one verified live M5 close and one effectively-once cycle;
3. run a multi-hour feed observation;
4. retain zero duplicate/conflicting closes and zero ledger gaps;
5. authorize each shadow task separately;
6. keep Phase 4 and production adoption false unless their independent gates pass.

## 27. Explicit Safety Statement

Track A2 implemented no trade intent, Paper-Demo order, broker order, account access,
position access, readiness promotion, profile mutation, autonomous calibration apply,
OpenClaw trade tool, or AI execution authority.
