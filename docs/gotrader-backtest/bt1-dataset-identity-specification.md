# BT1 Dataset Identity Specification

Date: 2026-08-07

Schema: `gotrader-historical-dataset-manifest` version `bt1-v1`

## Identity Layers

BT1 uses independent content identities so mutable transport state cannot
silently redefine a dataset.

### Request identity

The canonical request hash includes:

- provider ID, provider version, and source fingerprint;
- requested symbol and broker symbol;
- sorted source and derived timeframes;
- sorted parent dataset IDs;
- half-open UTC date range;
- page size;
- complete time-normalization policy;
- time authority ID;
- symbol specification ID;
- calendar ID and version;
- timeframe-alignment policy;
- creation-policy ID and version.

Any changed field creates a new request ID and a separate checkpoint.

### Source-page and partition identity

Each fetched page receives a source-page fingerprint over provider identity,
symbol identity, timeframe, cursor chain, compact source candles, warnings, and
authority. The immutable partition ID then includes that fingerprint,
normalized candles, rejected integrity events, request ID, page ordinal,
normalization provenance, and authority.

An existing partition path may be reused only when its canonical envelope is
byte-identical. A different payload under the same identity blocks as an
immutable artifact conflict.

### Timeframe checksum

Each timeframe checksum is the SHA-256 canonical hash of:

```text
normalization version
timeframe
ordered canonical candles
```

Input order cannot change this checksum because candles are sorted and exact
duplicates are coalesced before sealing. Conflicting duplicate open times block.

### Dataset checksum and dataset ID

The dataset checksum covers sorted timeframe checksum/count entries. The
dataset ID hashes the complete manifest core, including request identity,
provider and source identity, symbols, timeframes, range, time/DST policy,
time authority, symbol specification, calendar, alignment, normalization,
creation policy, partition IDs, integrity IDs, derived-lineage IDs, checksum,
verification status, authority, and disabled capabilities.

Changing any governed input or sealed content produces a new dataset ID.

## Immutability

Immutable artifacts:

- request records;
- source and derived partitions;
- integrity ledgers;
- dataset manifests;
- derived-timeframe lineage;
- B1-L1 dataset nodes and parent edges.

The ingestion checkpoint is the only mutable artifact. There is exactly one
checkpoint path per request ID, and each successful page atomically replaces
its state after the immutable partition has been verified on disk.

## Reproduction Contract

Exact reproduction requires the same:

- provider version and source fingerprint;
- source page content and cursor semantics;
- request and policy snapshots;
- canonical serializer and normalization version;
- closed-candle range;
- verified calendar and alignment rules.

The deterministic fixture produced dataset ID
`sha256:e2986a123090676f4bc7110c3b589a6f719b90dd873c4b8363975e0c6500e647`
and checksum
`sha256:a8e415abadca11383fd8b837aa5d838981d36a6d75285823ba6223441ca8df87`
in two independent storage roots.

## Sharing Contract

Strategy name, strategy version, parameters, experiment ID, and optimization
state are intentionally absent from dataset identity. Multiple strategies may
reference one accepted dataset manifest. They may not mutate, rewrite, or add
strategy-specific claims to that manifest.

## Failure Rules

Verification blocks on malformed envelopes, hash mismatch, partition mismatch,
cross-partition candle conflict, timeframe checksum/count mismatch, dataset
checksum mismatch, missing integrity ledger, missing lineage, non-none
authority, enabled capability, unverified required policy, or manifest identity
mismatch.
