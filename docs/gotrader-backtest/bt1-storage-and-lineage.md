# BT1 Storage And Lineage

Date: 2026-08-07

## Storage Boundary

The repository accepts an injected storage adapter. The Node adapter requires
an explicit isolated root and rejects absolute paths, backslashes, empty path
segments, dot segments, and parent traversal.

Dataset storage is separate from runtime, canonical research jobs, GBrain,
Native Evidence, readiness, and browser storage. It is authoritative only for
the historical OHLC artifacts in its accepted manifests.

## Layout

```text
requests/<request-hash>.json
checkpoints/<request-hash>.json
partitions/<partition-hash>.json
integrity/<ledger-hash>.json
manifests/<dataset-hash>.json
lineage/<lineage-or-edge-hash>.json
```

Every file is a canonical storage envelope with schema version, artifact kind,
payload hash, and payload. Reads recompute the payload hash before use.

## Atomicity And Restart

Writes use a unique temporary file in the destination directory followed by an
atomic rename and read-back verification. Bounded retry is permitted only for
transient local contention codes.

The write order for source pages is:

1. retrieve and validate one bounded page;
2. normalize and hash the immutable partition;
3. write and read back the partition;
4. atomically advance the one request checkpoint.

If the process stops between steps 3 and 4, resume fetches that page again. It
may reuse the existing partition only when the complete canonical envelope is
identical, then advances the same checkpoint. It never creates a second
checkpoint or appends duplicate candles.

The injected interruption test proved this exact boundary.

## Integrity And Verification

Sealing writes one integrity ledger per timeframe. Verification rereads every
manifest, lineage artifact, partition, and integrity ledger; recomputes
partition identity, canonical candle order, timeframe checksums/counts, and
the dataset checksum; and blocks on any mismatch.

Immutable artifacts cannot be overwritten with different content. The Node
adapter intentionally exposes no delete operation through the BT1 storage
interface.

## Derived Timeframe Lineage

M5, M15, H1, H4, D1, and W1 may be built deterministically from the smallest
available compatible parent timeframe. Each derived lineage records:

- parent request ID and parent timeframe;
- sorted parent partition IDs;
- target timeframe;
- alignment policy ID and version;
- completeness classification;
- blockers and warnings;
- content-derived lineage ID.

Raw lineage is never rewritten. A changed parent partition, alignment rule, or
closure classification produces a different lineage and dataset identity.

## B1-L1 Boundary

Every sealed dataset persists a B1-L1 `external_authoritative` node. Its compact
metadata references provider, source fingerprint, symbols, range, dataset
checksum, normalization, time authority, symbol specification, calendar,
integrity, verification flags, and historical-OHLC scope.

Declared parent datasets create `derived_into` required-causal edges. The
repository loads and verifies the parent manifests before writing those edges.
Missing or mismatched parent lineage blocks.

B1 receives compact IDs and metadata only. Raw candles remain in BT1 dataset
partitions and are not copied into B1 jobs, memory, evidence, UI state, or
advisory packets.

## Sharing And Retention

Completed identical requests coalesce to one manifest. Strategy identity is
outside the dataset identity, so multiple future strategies can reference the
same sealed dataset without copying or mutating it.

Retention and deletion policy for operational two-year datasets requires a
separate operator decision. BT1 provides immutable creation and verification,
not automated deletion or lifecycle authority.
