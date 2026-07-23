# Track A2 Continuous Feed Design

## Purpose

Track A2 adds one browser-independent read-only market-data loop after the Track A1 MT5
bridge. React components do not own pollers. The feed does not create strategy decisions,
evidence, readiness, Paper-Demo records, or execution requests.

```text
MT5 Desktop
  -> read-only Python upstream
    -> read-only bridge
      -> market_data_feed
        -> bounded rolling stores
        -> compact durable event ledger
          -> autonomous_cycle_scheduler
```

## Transport

The current bridge exposes bounded HTTP endpoints, not WebSocket or server-sent events.
The feed therefore uses one bounded poll loop:

```text
quote: 1 second
candles: 5 seconds
time contract: refreshed before every candle poll and at least every 10 seconds
request timeout: 3 seconds
```

Intervals are environment-configurable and bounded. Polling is contained in the service;
it is not duplicated per browser page.

## Events

Event version:

```text
gotrader-runtime-market-event-v1
```

Types:

```text
quote_updated
forming_candle_updated
candle_closed
feed_stale
feed_recovered
source_blocked
```

Every event has source identity, requested and broker symbols, timeframe when applicable,
observed market time, received time, source fingerprint, time-contract version, read-only
market-data capability, and authority `none / none / none`.

Durable storage contains only close and feed-state events. Quote values and OHLC arrays are
not written to the ledger.

## Stable Identity

Source identity excludes `receivedAt`. Candle identity is:

```text
source identity
+ requested symbol
+ broker symbol
+ normalized timeframe
+ candle open time
+ candle close time
```

The payload hash is separate. A changed payload for an already-known closed identity is a
conflict and blocks the source rather than replacing history silently.

Delivery is at least once. Durable event IDs, emitted-close checkpoints, and deterministic
scheduler cycle IDs provide effectively-once artifacts after restart. Track A2 does not
claim an impossible exactly-once network transport.

## Closed-Candle Proof

A close event requires all of the following:

1. current-live MT5 time basis is verified;
2. terminal time evidence is not stale;
3. candle close time is at or before the observed market clock;
4. open time is not in the future;
5. no conflicting closed payload exists;
6. the stable close ID has not already been emitted.

The time contract is refreshed before every candle request. If proof is unavailable, quote
and forming state may continue, but close events stop and `source_blocked` is recorded.

## Rolling Stores

```text
1m: 2,000
5m: 2,000
15m: 1,500
1h: 1,000
4h: 750
1d: 500
1w: 260
```

Series are sorted ascending, deduplicated by open time, and bounded. The first successful
poll establishes a baseline and does not flood the scheduler with historical closes.

## Persistence

Default root:

```text
.gotrader/runtime/always_on_read_only_scheduler/feed/
```

Files:

```text
checkpoint.json
events.json
status.json
```

Writes are atomic. Event retention defaults to 5,000. No browser or localStorage state is
used.

## Safety

```text
marketDataCapability: read_only
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
```

No account, order, position, Paper-Demo, readiness, OpenClaw, or execution module is
imported.
