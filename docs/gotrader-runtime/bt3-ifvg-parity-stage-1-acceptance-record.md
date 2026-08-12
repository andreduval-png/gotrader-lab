# BT3 IFVG Parity Stage 1 Acceptance Record

Date: 2026-08-12

BT3 acceptance commit: `2d53d9f5ddd5952768c9eb73fab675b55e7bdb6c`

BT3 implementation commit: `e625a5228370228055542e38d862a05c153b1d53`

BT3 architecture commit: `6bf1d25e4b999e09d04f4c7768e091c4fb67272d`

Parent BT2 acceptance: `0d98523cc74286a5a146afb34ccdca3fb9ee11ad`

## Decision

```text
ACC-BT3-IFVG-PARITY-STAGE-1
ACCEPTED
```

BT3 Stage 1 completed deterministic frozen-fixture parity for the IFVG v2
negative control and IFVG v3 positive canary. Two native-geometry candidates
and two exact no-opportunity blocker cases passed without changing frozen
snapshots, contacting MT5, serializing raw candles, or creating authority.

Accepted identities:

- compact parity report: `sha256:e7980a79a27341e33d245a5e2ef43150829f829361d6f5ac53a555c596927d1c`;
- IFVG v2 snapshot: `sha256:3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224`;
- IFVG v3 snapshot: `sha256:1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a`;
- v2 negative-control parity: `sha256:d8f0229ee4e730815971d2e64a23a054bcb733ccd9c076d458e2d87bb587c4fc`;
- v3 valid parity: `sha256:510a202c62ad2a9eac5005e961868a18ae522718ae184619beb454982982d7b1`;
- v3 forming parity: `sha256:78a78756113eaac3bb422b9a06c545fa8c382ca3d01b60d5b2ebff82564a9b33`;
- v3 rejected parity: `sha256:7db7796e47881359d18da28bf3c650936ecd63a7e03c058087f946d3bf596cff`.

## Boundary

This acceptance authorizes no runtime adoption and no historical dataset-backed
IFVG simulation. Migration of another strategy, strategy comparison, BT3A,
analytics, parameter search, statistics, B1.3/B1.4, evidence, readiness, Paper
Demo, production, broker mutation, and execution remain unauthorized.

```text
BT3 HISTORICAL SIMULATION UNAUTHORIZED
BT3 NEXT STRATEGY UNAUTHORIZED
BT3A UNAUTHORIZED
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```
