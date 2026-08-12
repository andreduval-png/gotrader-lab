# BT3 Stage 3 CMD Parity Acceptance Report

Date: 2026-08-12

Parent IFVG Stage 2 acceptance: `ee7b6be68a0ac03073b3aaeb1738695617c356eb`

Authorization: `4dd3b64509f48c545bdf8d80ad780d63d06a45a1`

Implementation: `79c49946d13a4b72ebfc431dbe55f46b94011b25`

## Decision

```text
ACC-BT3-CMD-PARITY-STAGE-3
ACCEPTED
```

CMD fixture parity now distinguishes policy ownership from detector ownership.
The v1 paper-watchlist lane remains policy-only and emits no opportunity. The
experimental v2 detector preserves eligible native short geometry and a
representative stale-signal blocker.

Accepted identities:

- parity report: `sha256:29c71b12eb6501393285c5f43d3e662681ba3087c7737e11cdeb49a901a9c02f`;
- snapshot: `sha256:b2dc1d9c5ca276876a264bb4776ff7c918dc9b6d54327d263939a78f78c133f3`;
- v1 policy parity: `sha256:e4aa43e83cd8e7d1e613803d30b8a85f3a193348fdd9d3b66eb84c93e194e3bc`;
- v2 valid parity: `sha256:fac0f50235e35b7c443a54f8b3d884cbcc0279ce3ed07b0ef085f216055684bc`;
- v2 stale parity: `sha256:28f5511794e95e700a27d5d4f922d103b526142be4e928b973018d16f93ee84b`;
- v2 opportunity: `sha256:9d0135bf4f9a720a4e7486d5a3d82ad092faf4677d0a235f324d3480197973c1`.

Results:

- CMD fixtures were byte-stable across two generations;
- v1 retained `canonical_cmd_v1_detector_ownership_missing` and independent
  date blockers with no geometry;
- v2 preserved short entry `100`, stop `102`, target `94`, and `3R`;
- stale displacement remained blocked;
- attempts to attach borrowed geometry to v1 fail closed;
- the independent-date gate retained the one-date overfit-risk decision;
- prior frozen snapshots remained unchanged;
- no MT5 contact, raw candles, historical claim, promotion, or authority was
  created.

Validation passed CMD detector and independent-date suites, complete BT3 and
BT2 regressions, frozen snapshot checks, typecheck, build, and diff checks.
Existing non-failing Rollup warnings remain unchanged.

## Boundary

Silver Bullet is next in roadmap order but remains separately gated. Historical
CMD simulation, performance claims, comparison, BT3A, analytics, search,
statistics, runtime adoption, readiness, Paper Demo, production, broker
mutation, and execution remain unauthorized.
