# BT3 Stage 1 IFVG Parity Acceptance Report

Date: 2026-08-12

Parent BT2 acceptance: `0d98523cc74286a5a146afb34ccdca3fb9ee11ad`

Architecture authorization: `6bf1d25e4b999e09d04f4c7768e091c4fb67272d`

Implementation commit: `e625a5228370228055542e38d862a05c153b1d53`

## Decision

```text
ACC-BT3-IFVG-PARITY-STAGE-1
ACCEPTED
```

The frozen IFVG v2 negative-control and IFVG v3 positive-canary fixtures now
translate deterministically into the accepted BT2 canonical opportunity
contract. This is fixture parity only and is not historical-dataset simulation
or strategy-performance evidence.

## Accepted Identities

- parity report: `sha256:e7980a79a27341e33d245a5e2ef43150829f829361d6f5ac53a555c596927d1c`;
- IFVG v2 snapshot: `sha256:3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224`;
- IFVG v3 snapshot: `sha256:1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a`;
- v2 negative-control parity: `sha256:d8f0229ee4e730815971d2e64a23a054bcb733ccd9c076d458e2d87bb587c4fc`;
- v3 valid parity: `sha256:510a202c62ad2a9eac5005e961868a18ae522718ae184619beb454982982d7b1`;
- v3 forming parity: `sha256:78a78756113eaac3bb422b9a06c545fa8c382ca3d01b60d5b2ebff82564a9b33`;
- v3 rejected parity: `sha256:7db7796e47881359d18da28bf3c650936ecd63a7e03c058087f946d3bf596cff`;
- v2 opportunity: `sha256:cd7d82e3a4c58c4b9cd8b575b67784a1dc20b60004c53df7f7978d020e69e6a6`;
- v3 opportunity: `sha256:3c2c3080773406400b6c9c76b73d0ccd6ca5b350708b5507e980f929b00606be`.

## Results

- four frozen fixtures verified against their committed canonical-text hashes;
- v2 negative control and v3 valid canary preserve entry `95`, stop `93.9095`,
  target `98.6`, direction `long`, and native geometry mode;
- the negative control remains non-promotable;
- v3 forming and rejected cases emit no opportunity and preserve exact blockers;
- deterministic repeats produce identical parity and opportunity IDs;
- malformed hash, unsupported profile, and geometry/state inconsistency fail
  closed;
- synthetic fixture dataset/certificate identities are distinct from BT1.6;
- raw candles are absent, MT5 was not contacted, and authority remains
  `none / none / none`.

Validation passed:

- `npm run test:bt3`;
- `npm run test:v2-baseline-snapshots`;
- `npm run test:bt2-contracts`;
- `npm run test:bt2-simulator`;
- `npm run test:bt2-restart`;
- `npm run typecheck`;
- `npm run build`;
- `git diff --check` and frozen-fixture diff inspection.

The build retained pre-existing circular-chunk and large-chunk warnings but
completed successfully with no BT3 error.

## Boundary

BT3 historical dataset-backed simulation, migration of another strategy,
cross-strategy comparison, analytics, parameter search, statistics, runtime
adoption, B1.3/B1.4, Paper Demo, readiness, production, broker mutation, and
execution remain unauthorized pending separate decisions.
