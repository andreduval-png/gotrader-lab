# BT3 Stage 4 Silver Bullet Parity Acceptance Report

Date: 2026-08-12

Parent CMD Stage 3 acceptance: `c4f9df85b6c8f7ba0caebc3f91a8bbbb53bd3b04`

Authorization: `a31382a7b478841e37e6b5afc7f5b910f8c37c26`

Implementation: `da78ccbbc8166ccaf672ab54dbf65486964d3625`

## Decision

```text
ACC-BT3-SILVER-BULLET-PARITY-STAGE-4
ACCEPTED
```

Silver Bullet v1 and v2 now have compact, deterministic fixture parity with
the BT2 canonical opportunity contract. Both profiles preserve native long and
short geometry when eligible, while representative sweep failures remain
blocked and emit no opportunity.

Accepted identities:

- parity report: `sha256:3052c1b57e3d146a34de578d1a488dbb74c205281e7b81ed09ed1d940c1ed14e`;
- snapshot: `sha256:d4fb1bb31688761b0787d73ac2161e2760c6ae4f4a671a5843a6e19353d47413`;
- v1 long parity: `sha256:b9e6c1f281e7f6d05f4a3454638d9af932a9e0f91207fa0a6a8a9a5b69024db9`;
- v1 short parity: `sha256:f3b21d02078c0d6c5b5173461c3df20dda816b8b8f777938a49dda1fb9df0ec5`;
- v1 blocked parity: `sha256:10c0c5dd0ee5698de55bcf8aef73a1f5f0e9116c12a3a1d48f1d398fdf3634af`;
- v2 long parity: `sha256:12ab47141926a93ebed7d7d833dad7bc14c5fcac9783a94e123d236cce217817`;
- v2 short parity: `sha256:aa8319361f556315c722f07f5a465354e9ac591103d8e7fcf30ca40be7fe441e`;
- v2 blocked parity: `sha256:b266d6d9f68b0a1a5e9c0c820dc117e063a509df95875c27d85b0345c759737b`.

Results:

- six fixtures were byte-stable across repeated generation;
- four eligible fixtures preserved exact side, entry, stop, target, and timing;
- two representative sweep failures remained blocked with no opportunity;
- one-minute source close boundaries and the New York AM session expiry were
  preserved exactly;
- v1 remained a rejected `negative_control` profile;
- v2 remained a `strict_research` profile with insufficient sample depth;
- attempts to promote a fixture or attach geometry to a blocked result failed
  closed;
- prior frozen BT3 snapshots remained unchanged;
- no MT5 contact, raw candles, historical claim, promotion, or authority was
  created.

Validation passed both native Silver Bullet detector suites, New York/MT5 time
normalization, complete BT3 and BT2 regressions, frozen snapshot checks,
typecheck, build, and diff checks. Existing non-failing Rollup circular-chunk
and large-chunk warnings remain unchanged.

## Boundary

Turtle Soup is next in roadmap order but remains separately gated. Historical
strategy simulation, performance comparison, BT3A, analytics, search,
statistics, runtime adoption, readiness, Paper Demo, production, broker
mutation, and execution remain unauthorized.
