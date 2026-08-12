# BT1.6 Historical Qualification Governance Record

Date: 2026-08-12

BT1.6 acceptance commit: `d263ce2e81c4137d3e4bfd84b6230135e2dffcf8`

## Accepted Identities

- candidate base: `2f307ef09df3fa600fe20a57b78da72ebd4a808b`;
- dataset: `sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d`;
- certificate: `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`;
- registry: `sha256:ec877c21a370699094ed856d2419712f561dc8f3ef23350559c6985a9df4c9eb`;
- deterministic comparison: `sha256:6efa53df39db263a1c4fe4cf88e38d054ca46445c6df7f4b12c4286486ed8dde`;
- provider requery comparison: `sha256:5b7193c15f02d3c8a44b68b7076b21c960982fffbc68a5584d50f4317c84a2e9`.

The certificate covers the half-open range `2024-08-01T00:00:00.000Z`
through `2026-08-01T00:00:00.000Z` for requested symbol `MNQ` through MT5
broker symbol `USTECH`. The source is a CFD/proxy historical research source,
not CME futures truth. Raw candles remain outside Git and outside runtime
governance storage.

## Authority Decision

```text
BT1.6 HISTORICAL INPUT QUALIFICATION ACCEPTED
BT2 UNAUTHORIZED
B1.3 UNAUTHORIZED
```

This record grants no automatic runtime adoption and no strategy, simulation,
parameter-search, statistics, risk, portfolio, evidence, readiness, Paper Demo,
production, broker-mutation, or execution capability. Any consumer must be
separately authorized and bind the compact certificate or registry identity;
it must not copy raw candles into runtime ledgers.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

BT2 requires its own architecture and concurrency authorization. BT1.6
acceptance does not activate a simulator or authorize implementation implicitly.
