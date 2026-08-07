# BT1.5 Two-Year Dataset Qualification

Date: 2026-08-07

Status: `PENDING_CAPACITY_PILOT_AND_LIVE_RETRIEVAL`

## Planned Request

The intended half-open historical interval is:

```text
startUtc: 2024-08-01T00:00:00.000Z
endUtc:   2026-08-01T00:00:00.000Z
duration: 730 days
requestedSymbol: MNQ
brokerSymbol: USTECH
```

The end is fully historical. The final request is not sealed until the live
source, time authority, symbol specification, and calendar identities pass.

## Timeframe Strategy

| Timeframe | Planned source |
| --- | --- |
| M1 | source native |
| M5 | derived from canonical M1 |
| M15 | derived from canonical M1 |
| H1 | derived from canonical M1 |
| H4 | derived from canonical M1 |
| D1 | source native until a session-aware daily alignment policy is qualified |
| W1 | source native until a session-aware weekly alignment policy is qualified |

Fixed-UTC derivation rejects D1 and W1. This avoids silently crossing broker
sessions or DST boundaries. Mixed native retrieval is explicit in the request
identity and repository manifest.

## Implemented Controls

- exact branch/HEAD bundle and fresh live-preflight binding;
- loopback-only GET provider;
- immutable requests/partitions/manifests and atomic checkpoints;
- dataset-wide candle and partition ceilings plus per-timeframe page ceilings;
- compact progress without candle dumps;
- controlled exit code `75` only after a committed checkpoint;
- BT1 v1 interrupted-checkpoint migration from immutable partitions;
- fully closed end and explicit 700-740 day full-run requirement;
- pilot-derived, integrity-hashed capacity plan required before full mode;
- all artifacts isolated below `.gotrader/bt1-5`.

## Current Result

No actual source page, partition, manifest, checksum, integrity ledger, or
lineage artifact has been accepted. Fixture-backed repository and operational
tests passed; they are not substituted for the two-year gate.
