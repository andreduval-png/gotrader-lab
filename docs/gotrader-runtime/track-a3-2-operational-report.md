# GoTrader Infrastructure Track A3.2 Operational Report

## Final Status

```text
TRACK A3.2 BLOCKED - OPERATIONAL ACCEPTANCE INCOMPLETE
```

The market-state layer, bounded higher-timeframe hydration, observer retry
policy, operational runtime profile, canonical time handoff, and deterministic
tests are complete. A full four-hour observation spanning the scheduled market
break was completed on 2026-07-29. The market-break behavior passed, but an
independent internet/broker connection loss later caused MT5 IPC timeouts,
proof loss, observer transport failures, and managed restarts. Full acceptance
is therefore not claimed. Infrastructure Track B1 and Track A4 remain blocked
until a fresh four-hour observation passes every criterion.

## 1. Starting Point

- Source branch: `codex/gotrader-infrastructure-track-a3-1`
- Source commit: `b1f7b7f8718faecfeebb53dcdf9d1f82f1f83da1`
- Isolated implementation branch:
  `codex/gotrader-infrastructure-track-a3-2`
- A3.1 status: partial operational acceptance
- Historical DST verification at start: `false`

## 2. Market-State Implementation

The runtime now classifies four independent dimensions instead of treating
every quiet period as a time-verification failure:

- market: `market_open`, `market_quiet`, `market_closed`, or
  `time_unverified`;
- transport: connected or disconnected;
- terminal: connected or disconnected;
- proof: fresh, paused for market close, awaiting fresh proof, or blocked.

The default USTECH CFD/proxy schedule is explicit in
`America/New_York`:

- Sunday open at 18:00;
- Monday through Thursday maintenance from 17:00 to 18:00;
- Friday close at 17:00;
- Saturday closed.

An unknown or contradictory market state fails closed. Transport and terminal
disconnects take precedence over the market schedule.

## 3. Verified Pause And Resume

During an explicitly classified market close:

```text
verified proof
  -> healthy_paused_market_closed
  -> feed paused_market_closed
  -> scheduler paused_market_closed
```

The verifier does not count the scheduled pause as a renewal failure. When the
session reopens, the runtime enters an awaiting-fresh-proof state and cannot
resume from Windows clock advancement alone. A new accepted MT5 terminal,
quote, candle, provider-basis, and offset correlation is required.

Deterministic tests cover pause, no-backlog behavior, fresh-proof resume, hard
disconnects, and authority preservation. A live market-break observation is
still required.

## 4. Historical Context Hydration

The new bounded hydrator performs a one-shot MT5 read-only startup preload. It
does not introduce permanent deep-history polling.

Required timeframes:

```text
M5
M15
H1
H4
D1
```

Policy:

- maximum 300 candles per timeframe;
- minimum 5 closed candles per timeframe;
- compact per-timeframe source fingerprint;
- first and last candle times;
- candle count;
- deterministic checksum;
- deterministic hydration fingerprint;
- no raw candle persistence.

After hydration is ready, live feed requests fall back to a three-candle
rolling update. The continuous feed remains the owner of current data.

Live canary hydration:

| Timeframe | Compact candle count | Ready |
| --- | ---: | --- |
| M5 | 299 | yes |
| M15 | 299 | yes |
| H1 | 299 | yes |
| H4 | 299 | yes |
| D1 | 299 | yes |

The hydration artifact contains no candle arrays, account/order/position
fields, credentials, or secrets.

## 5. Historical Time Boundary

Hydration does not promote historical time authority:

```text
historicalEligible: false
historicalDstPolicyVerified: false
comparisonEligible: false
```

Bounded history can supply shadow context only when a compact hydration
artifact and source identity are present. The context result carries an
explicit warning when pre-regime history is used while historical DST policy
remains unverified. It cannot create evidence or production adoption.

## 6. Canonical Time Handoff

The live canary exposed that MT5 server-wall-clock labels were reaching the
shadow context as if they were UTC. This made valid windows appear three hours
ahead of the UTC proof expiry.

The runtime now:

- preserves the MT5 provider timestamp internally;
- applies the independently verified current-live offset;
- emits canonical UTC quote and candle times;
- includes provider basis, offset, and normalization version in the source
  identity;
- starts a distinct source-identity regime when normalization basis or offset
  changes.

Historical DST remains unverified. The fixed current offset is used only for
bounded, shadow-only context and is explicitly ineligible for comparison,
evidence, readiness, or production use.

## 7. Renewal Handoff Resilience

The canary also exposed a short atomic handoff window between watcher renewal
and bridge contract decoration. Without a guard, the feed could re-baseline
and suppress an M5 close.

The feed may retain its prior eligible contract only when all of the following
remain true:

- prior contract is eligible;
- watcher state is healthy;
- watcher proof is fresh and unexpired;
- terminal identity, provider basis, offset, classifier version, and
  continuity regime agree;
- market is open or quiet;
- artifact and watcher identities agree;
- authority is `none / none / none`;
- blockers are limited to the known atomic-renewal handoff set.

Stale proof, terminal disconnect, identity conflict, unsupported blocker, or
authority change blocks immediately. Proof lifetime was not extended.

The live canary retained 63 short renewal handoffs without adding a duplicate,
conflict, rejection, or context gap after the canonical migration baseline.

## 8. Observer Transport Resilience

The acceptance observer now retries one failed status request once.

- recovered retry: increments `observerTransportWarnings`;
- unrecovered retry: increments `transportFailures`;
- checkpoints continue after recovered warnings;
- failures remain visible;
- runtime process continuity is sampled independently.

Proof uptime is now calculated over active-market samples. Safe
market-closed pause samples are tracked separately and must all show verifier,
feed, and scheduler pause agreement.

## 9. Operational Runtime Profile

New additive profile:

```text
always_on_shadow_context_operational
```

Service order:

```text
MT5 Desktop
  -> MT5 read-only upstream
  -> MT5 read-only bridge
  -> current-live verifier
  -> bounded hydration stage in feed startup
  -> continuous feed
  -> autonomous scheduler
  -> shadow context refresh
```

Disabled capabilities remain:

- strategy scheduling;
- IFVG comparison;
- trade-intent generation;
- Paper Demo;
- execution;
- evidence creation;
- readiness promotion;
- AI supervisor;
- profile mutation;
- autonomous calibration apply;
- replay, walk-forward, OOS, and Monte Carlo.

## 10. Live Canary And Reacceptance Result

Canary snapshot captured on 2026-07-24:

- verifier: healthy;
- proof: fresh;
- market: open;
- feed: healthy;
- scheduler: healthy;
- hydration: ready;
- canonical M5 close emitted;
- completed five-timeframe shadow contexts: 2;
- latest shadow context status: completed;
- latest context blockers: none;
- queue depth: 0;
- duplicate delta after canonical migration baseline: 0;
- conflict delta after canonical migration baseline: 0;
- rejected-close delta after canonical migration baseline: 0;
- authority: `none / none / none`.

Earlier development-canary counters remain in the local ledger for audit. They
include blocked artifacts from the pre-normalization attempt and are not
silently deleted. The formal observer must establish a new compact baseline
and evaluate deltas from that point.

### 2026-07-29 four-hour reacceptance

Observer:

```text
a3_2_acceptance_1785352322549
```

The integrity-hashed report completed the requested 14,400-second duration and
recorded:

- elapsed time: 14,403 seconds;
- active-market span: 3.167 hours;
- verified M5 closes: 25;
- completed canonical contexts: 20;
- safe scheduled-break pause samples: 714;
- unsafe scheduled-break samples: 0;
- fresh proof resumed after the scheduled break: yes;
- duplicate close delta: 0;
- duplicate context delta: 0;
- payload conflict delta: 0;
- ledger gap delta: 0;
- raw candles or context facts persisted: no;
- authority: `none / none / none`.

The observer did not pass. At 18:30 America/New_York, the MT5 terminal journal
recorded a connection loss during an external internet/broker outage. It
recorded authorization and reconnection at 18:56. During that interruption,
the prior implementation allowed blocking terminal IPC to delay health
surfaces and trigger a verifier/feed restart cascade.

Failure deltas:

- verifier failures: 182;
- unrecovered observer transport failures: 93;
- managed restart delta: 2;
- final status: `observation_incomplete`.

The report remains preserved at:

```text
.gotrader/runtime/always_on_shadow_context_operational/observations/a3_2_acceptance_1785352322549.json
```

Integrity hash:

```text
sha256:4bb5fb0d2ffd87610fde1e189694b1eb4317ccd60076c9b2bc8692b62f6461b2
```

This run proves that the scheduled maintenance break is handled correctly. It
does not prove uninterrupted operational acceptance because the later external
disconnect exposed a local nonblocking-recovery defect.

### Disconnect-recovery remediation

The local runtime now:

- collects the direct terminal clock asynchronously with an eight-second bound;
- uses one serialized background MT5 connection monitor;
- serves nonblocking cached health and status while MT5 IPC is unavailable;
- applies bounded exponential reconnect backoff;
- fails market-data routes closed with
  `mt5_terminal_disconnected`;
- pauses verifier, feed, and scheduler as
  `paused_terminal_disconnected`;
- does not emit candle closes, context tasks, or rejection events while paused;
- does not count a known disconnect pause as repeated verifier failure;
- requires a fresh accepted terminal/quote/candle correlation before resuming.

The remediation preserves all ledgers and the failed checkpoint. It does not
weaken proof freshness, historical-time, comparison, evidence, readiness,
Paper Demo, broker, production, or execution gates.

An initial post-remediation live canary started at 23:29 UTC. By 23:42 UTC it
had handled three terminal-disconnect pause/reconnect transitions without a
managed service restart. The verifier returned to fresh current-live proof,
the feed and scheduler were healthy, hydration remained ready, a new M5 close
and completed canonical context were recorded, and all authority fields
remained `none`. This is useful recovery evidence, but it is not a substitute
for the required four-hour acceptance observation.

## 11. Resource Snapshot

The live canary snapshot reported:

- feed RSS: 74,735,616 bytes;
- scheduler RSS: 106,065,920 bytes;
- verifier RSS: 69,382,144 bytes;
- queue depth: 0;
- managed restart count during the final canary: 0.

These are canary observations, not four-hour maxima.

## 12. Verification Results

Passed:

- `npm.cmd run build`;
- `npm.cmd run smoke:routes` - 44/44;
- `npm.cmd run test:browser-smoke` - 44/44;
- `npm.cmd run test:gotrader-market-state`;
- `npm.cmd run test:gotrader-historical-context-hydration`;
- `npm.cmd run test:gotrader-observer-transport`;
- `npm.cmd run test:gotrader-runtime-a3-2`;
- `npm.cmd run test:gotrader-runtime-a3-2-integration`;
- all A1, A2, A3, and A3.1 runtime/feed/scheduler/verifier/shadow suites;
- `npm.cmd run test:core`;
- `npm.cmd run test:strategy-baselines`;
- `npm.cmd run test:source-integrity`;
- `npm.cmd run test:provenance`;
- `npm.cmd run test:safety`;
- `npm.cmd run test:mt5-readonly-disconnect-recovery`;
- `npm.cmd run test:mt5-readonly-safety`.

The existing Rollup circular-chunk and large-chunk warnings remain unchanged.

## 13. Frozen Baselines

The core, strategy-baseline, source-integrity, provenance, and safety suites
all passed. Frozen strategy behavior and baseline hashes are unchanged by
Track A3.2. No strategy code executes in the operational profile.

## 14. Authority And Safety

```text
marketDataCapability: read_only
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
```

The MT5 safety suite confirms that mutation verbs and account, order,
position, pending-order, trade-history, and execution paths remain blocked.

## 15. Remaining Acceptance Work

A fresh four-hour observer run after the disconnect-recovery remediation must:

- use `always_on_shadow_context_operational`;
- span a scheduled market break;
- record at least 3 verified M5 closes;
- record at least 3 completed canonical contexts;
- observe explicit safe proof/feed/scheduler pause;
- observe fresh-proof resume;
- show zero duplicate close and context deltas;
- show zero payload-conflict and ledger-gap deltas;
- show zero unrecovered observer transport failures.
- show zero verifier-failure and managed-restart deltas during any recoverable
  disconnect pause;
- resume only after fresh current-live proof.

Until that run completes, A3.2 remains blocked.

## 16. Rollback

Operational rollback:

```powershell
node scripts/gotrader-runtime-control.mjs stop --profile always_on_shadow_context_operational
npm.cmd run gotrader:shadow-context:verified:start
```

The A3.1 verified profile remains additive and unchanged. MT5 Desktop is left
running by runtime stop.

## 17. B1 And A4 Readiness

```text
Infrastructure Track B1: NOT AUTHORIZED
Track A4: NOT AUTHORIZED
```

The architecture, canary behavior, scheduled-break handling, and
disconnect-recovery behavior are ready for final operational reacceptance.
Authorization requires a fresh passing four-hour report, not the failed
2026-07-29 observation.
