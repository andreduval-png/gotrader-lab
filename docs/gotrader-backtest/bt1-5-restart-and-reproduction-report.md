# BT1.5 Restart And Reproduction Report

Date: 2026-08-07

## Deterministic Validation

Offline tests passed for both interruption boundaries:

- failure after immutable partition write but before checkpoint commit causes
  one idempotent refetch and no duplicate canonical candle;
- controlled interruption after checkpoint commit resumes without refetching
  the committed page;
- an interrupted BT1 v1 checkpoint is upgraded by recounting its immutable
  partitions and then resumes under the BT1.5 checkpoint schema;
- tampered storage is blocked by envelope, timeframe, count, and dataset
  checksum verification.

The reproduction comparator independently labels
`deterministic_rematerialization` and `provider_requery`. It requires matching
request ID, partition IDs, timeframe checksums, dataset checksum, dataset ID,
manifest hash, and lineage-node key. Report integrity hashes are verified
before comparison.

## Operational Status

| Gate | Result |
| --- | --- |
| Actual provider controlled stop/resume | pending |
| No duplicate committed partitions | pending live proof |
| Root A deterministic rematerialization | pending |
| Root B provider re-query | pending |
| Stable dataset and lineage identities | pending |

Offline success does not claim operational reproduction. The actual live job
must be interrupted without stopping MT5 or another service, then completed
and compared under both reproduction labels.
