# BT3 Stage 2 IFVG v1/v4 Acceptance Report

Date: 2026-08-12

Parent Stage 1 acceptance: `2d53d9f5ddd5952768c9eb73fab675b55e7bdb6c`

Architecture authorization: `41bf45ab87187df4c120469ca3b1a286714bc9f2`

Implementation commit: `3f31744bd8eae5516220952732967123bbe53798`

## Decision

```text
ACC-BT3-IFVG-V1-V4-PARITY-STAGE-2
ACCEPTED
```

IFVG v1 baseline and IFVG v4 shallow-retest experimental fixtures now have
deterministic golden outputs and exact BT2 canonical opportunity translation.
This acceptance is fixture parity only.

Accepted identities:

- parity report: `sha256:c7d6974cfc7c32a1c28a1c447a40fdd7dd48d9acc934394eac1fc10739b84282`;
- Stage 2 snapshot: `sha256:67281b18abaf260594f6551635822d2dc925304cfaafa5c3496c977ce286e93c`;
- v1 valid parity: `sha256:e714a465c3c6b82dc7439b6435e4b1ed8f97053254dc9d1e84fe79244e70ffc0`;
- v1 no-retest parity: `sha256:5ae55738754d9ad5827c544ed7def8105c583ad4d559278167f1a42ae265b4a7`;
- v4 shallow-valid parity: `sha256:a93b3c810eba21ebbff71680c65ac50ba3fbdfaedff6cbcad9e7abe6a609a5fa`;
- v4 deep-blocked parity: `sha256:6103321638ca73665370b91a60bd2f7a26f86dcb86ca08261e29b1a781c3ab96`;
- v1 opportunity: `sha256:ddc2ddab9af2c4475f4492ca2369800b833a479ef407dd0433e27150ebd66072`;
- v4 opportunity: `sha256:4b65b48b1baf90d36c88fb0aaba427551351bf1e0b16bce2053712d0ffffa395`.

Results:

- two consecutive detector generations were byte-identical;
- v1 native geometry preserved entry `95`, stop `93.9021`, target `98.6`;
- v4 native geometry preserved entry `95`, stop `93.9095`, target `98.6`;
- v1 no-retest and v4 deep-retest blockers were preserved exactly;
- v4 remains experimental and non-promotable;
- Phase 0 baseline snapshot hashes remained unchanged;
- no historical dataset was claimed, no raw candles were serialized, MT5 was
  not contacted, and authority remained `none / none / none`.

Validation passed `test:ict-ifvg`, complete `test:bt3`, frozen baseline
snapshot generation, BT2 contract/simulator/restart suites, typecheck, build,
and `git diff --check`. Existing non-failing Rollup circular-chunk and size
warnings remain unchanged.

## Boundary

CMD, Silver Bullet, Turtle Soup, CISD, session raid, Phase 2 adapters,
historical strategy simulation, comparison, BT3A, analytics, search,
statistics, runtime adoption, readiness, Paper Demo, production, broker
mutation, and execution remain unauthorized.
