# BT1.6 Two-Year Ingestion Report

Status: `NOT_STARTED`

Planned half-open range:

```text
startUtc: 2024-08-01T00:00:00.000Z
endUtc:   2026-08-01T00:00:00.000Z
requestedSymbol: MNQ
brokerSymbol: USTECH
```

M1, D1, and W1 are native sources. M5, M15, H1, and H4 are derived from M1.
D1 and W1 must not be produced by fixed-UTC derivation. No live partitions,
manifest, checksum, or dataset ID have been accepted.
