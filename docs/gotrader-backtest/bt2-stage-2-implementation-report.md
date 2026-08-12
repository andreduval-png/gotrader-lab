# BT2 Stage 2 Implementation Report

Date: 2026-08-12

Stage 1 parent: `6cc2644e14aa9507b337eca8f210cbd729e35539`

Implementation commit: `831044a1d9c532df47d247e1eb435bd7d3302200`

Status: `STAGE_2_ACCEPTED`

## Qualified Input

- certificate: `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`;
- registry: `sha256:ec877c21a370699094ed856d2419712f561dc8f3ef23350559c6985a9df4c9eb`;
- dataset: `sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d`;
- source repository remained read-only and outside Git;
- certificate, registry, manifest, partition, and full dataset verification passed before simulation;
- tampered or unqualified certificates fail closed before repository access.

## Shadow Acceptance

The bounded harness read 8,899 M1 candles from three immutable qualified
partitions and generated twelve deterministic synthetic canary opportunities.
These opportunities are not strategy evidence and grant no readiness or
execution authority.

| Identity or bound | Accepted value |
| --- | --- |
| Experiment | `sha256:3bbfa92a97255c25b04eaf9f00586bcee306aec9a680d2390fcd1f29c1771fd8` |
| Ledger seal | `sha256:ad063ea4b036a19df95601a16ec5855be25333bea354e1b98ea6e7194760f52b` |
| Uninterrupted report | `sha256:491744e93efcd33f0d81d62cbe05826eefdd191e2120e4a6fbd4f6de2fb74313` |
| Resumed report | `sha256:baf7bcdc20e2e8c3d4aa90ff595dbccb4a9d7cfc96fc090e5c43f6491ab9fb29` |
| Maximum partitions / workers | 3 / 1 |
| Outcomes | 11 exited, 1 insufficient data, 0 blocked |
| Peak RSS | 882,589,696 bytes |
| Maximum lane RSS increase | 397,312 bytes |
| Compact output | 49 files, 205,535 bytes |

The controlled run exited with expected native status 75 after five committed
records. Resume validated the checkpoint and produced the same ordered record
identities and ledger seal as the uninterrupted run. Future candle append did
not alter pre-existing opportunity identities. Recursive artifact inspection
found no serialized OHLC candle payloads.

## Safety

- MT5 was not contacted;
- no strategy module or frozen profile was imported;
- no parallel worker or nondeterministic merge was used;
- no raw candles were copied into BT2 storage or Git;
- synthetic opportunities used only closed source candles available at each decision timestamp;
- authority remained `none / none / none`.

## Gate Decision

```text
BT2 STAGE 2 ACCEPTED
BT2 IMPLEMENTATION COMPLETE
BT3 UNAUTHORIZED
```
