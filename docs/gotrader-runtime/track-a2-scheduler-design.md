# Track A2 Scheduler Design

## Purpose

The scheduler consumes the feed's durable events without a browser. It runs a small
allowlist of strategy-neutral tasks only after a verified `candle_closed` event.

Quote, forming-candle, stale, recovered, and blocked events do not run a cycle.

## Queue Model

Track A2 implements only:

```text
live_read_only_queue
```

Deep replay, walk-forward, OOS, Monte Carlo, evidence creation, calibration, readiness,
Paper-Demo, trade-intent, and broker work remain outside this queue.

Limits:

```text
queue depth: 100
one active task per task type
task timeout: 2 seconds for enabled tasks
retry limit: 1
retained task-run IDs: 20,000
retained processed event IDs: 10,000
retained artifacts: 1,000
Node memory ceiling per feed/scheduler service: 256 MiB
```

Excess events are counted as dropped. Duplicate input IDs are coalesced. Failed timed-out
tasks become compact failed artifacts rather than blocking the process indefinitely.

## Idempotency

Cycle ID:

```text
SHA-256(task type + task version + close event ID)
```

The checkpoint records processed event IDs, completed task-run IDs, last processed event
sequence, counters, and the latest outcome. A restart reloads this state before polling the
event ledger.

If the scheduler cursor is older than the retained event ledger, processing stops with:

```text
durable_event_ledger_gap_reconciliation_required
```

It never silently skips the gap.

## Artifacts

Artifacts include compact source identity, source fingerprint, symbols, timeframe,
observed market time, task result, blockers, warnings, and output artifact IDs. They do
not include OHLC arrays, account data, orders, positions, credentials, or screenshots.

```text
productionAdoptionAllowed: false
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

## Control

Pause and resume are atomic file commands. Pausing stops event intake without deleting the
cursor or feed state. Resuming processes retained close events in order. Shutdown remains
owned by the Track A1 supervisor.
