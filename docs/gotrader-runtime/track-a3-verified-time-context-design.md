# Track A3 Verified-Time Shadow Context Design

## Boundary

Track A3 extends the A2 read-only runtime with two capabilities:

1. a compact, expiring current-live MT5 clock verification artifact;
2. one strategy-neutral `shadow_context_refresh` task.

It does not create strategy signals, evidence, readiness, paper-demo state, trade
intent, or broker actions.

## Flow

```text
GoTraderClockProbe
  -> MT5 read-only Python correlation
  -> upstream /time-contract
  -> bridge /time-contract
  -> strict feed proof gate
  -> durable MNQ/USTECH M5 candle_closed
  -> allowlisted scheduler
  -> bounded rolling candle windows
  -> V2 canonical market context builder
  -> compact shadow context artifact
```

The upstream and bridge must agree on contract version, artifact ID, scope,
provider basis, observed offset, generated/expiry times, classifier version,
current-live eligibility, and historical eligibility. Consumers may reject this
proof but cannot upgrade it.

## Time Contract

Freshness is `<=120` seconds, expiring is `>120` and `<=180` seconds, and stale
is `>180` seconds. Only `fresh` is close-event eligible. Current-live and
historical verification are independent; Track A3 always leaves historical DST
verification false.

A proof that was invalid at candle-close time cannot be refreshed retroactively.
When eligibility recovers, each series is re-baselined at its latest closed
candle. Reconciliation is limited to durable closes accepted under a valid proof.

## Context Task

The task is restricted to `MNQ`, broker symbol `USTECH`, and an M5 durable close
trigger. Input windows are M5, M15, H1, H4, and D1 from the feed's bounded
in-memory rolling stores. The task does not request deep history.

The context task imports only V2 authority, serialization, identity, candle, and
context modules. `shadow_ifvg_comparison` and all strategy tasks remain disabled.
Current-live proof does not make old rolling candles historically eligible, so
the context builder may correctly return a blocked artifact until required
post-verification windows exist.

## Persistence And Idempotency

State is stored under:

```text
.gotrader/runtime/always_on_shadow_context/
  feed/
  scheduler/
  context/
  time/
  observations/
```

Context cycle identity includes task type/version, trigger close-event ID, and
context runtime version. Completed IDs survive restart. Artifacts contain only
lineage, source/window identities, counts, status, blockers, warnings, and
authority. Candle arrays and full context facts are never persisted.

## Budgets

- one active context task per task type;
- queue bound inherited from scheduler: 100 events;
- context timeout: 5 seconds;
- retry budget: one;
- feed window request: at most 300 candles per timeframe;
- context artifact retention: 1,000;
- scheduler artifact retention: 1,000 by default;
- feed durable event retention: 5,000 by default;
- feed Node heap: 256 MB;
- scheduler Node heap: 256 MB.

A corrupt context checkpoint blocks the task. Ledger gaps block the scheduler.
No state is silently skipped.

## Authority

```text
marketDataCapability: read_only
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
```
