# BT3 Stage 5 Turtle Soup Parity Acceptance Report

Date: 2026-08-12

Parent Silver Bullet Stage 4 acceptance: `91e27fd25906951f1fd0da43f4c871f9079a8a96`

Authorization: `941b76820e705c9f500c12381e729d48bec3c5ba`

Implementation: `ca5d6733b4428b7cb64e0f940b9d382948bc0e15`

## Decision

```text
ACC-BT3-TURTLE-SOUP-PARITY-STAGE-5
ACCEPTED
```

Turtle Soup v1 now has compact deterministic fixture parity with the BT2
canonical opportunity contract. Native long/short synthetic fixtures preserve
detector geometry, while representative no-sweep and no-MSS states emit no
opportunity.

Accepted identities:

- parity report: `sha256:ee7eac7d3f0c2e405695d23fa062b3b9b6dea86b0ec03592058724bb0d492b14`;
- snapshot: `sha256:039e627e1031e3723f5874dceab0d093c95c1f4db7bf85bd6098d2432e02f636`;
- short parity: `sha256:9930784ef22880757552bb9e551ae7ac9cce5507b762a2d8d40fff87f7975bd9`;
- long parity: `sha256:fcf13b2c3486451362d872670e0f63607c417e65c961ddd9bda5519951d6fae4`;
- no-sweep parity: `sha256:cd71f45b66f1b380a87264990b7e28a43773ee3f6a1f72d7ecca8e3170c71437`;
- no-MSS parity: `sha256:4795b20b70a2588314dba8c828deef086f1b1ac8910c4d272aa8edc999296af8`.

Results:

- four fixtures were byte-stable across repeated generation;
- two eligible fixtures preserved exact side, entry, stop, target, and timing;
- no-sweep and no-MSS fixtures remained blocked with no opportunity;
- attempts to attach geometry to a blocked fixture failed closed;
- attempts to rewrite the audited historical candidate count failed closed;
- the profile remained `diagnostic_control`, with zero audited historical
  candidates and `needs_more_data` robustness;
- prior frozen BT3 snapshots remained unchanged;
- no MT5 contact, raw candles, historical claim, promotion, or authority was
  created.

Validation passed the native Turtle Soup detector suite, New York/MT5 time
normalization, complete BT3 and BT2 regressions, frozen snapshot checks,
typecheck, build, and diff checks. Existing non-failing Rollup circular-chunk
and large-chunk warnings remain unchanged.

## Boundary

CISD is next in roadmap order but remains separately gated. Historical strategy
simulation, performance comparison, BT3A, analytics, search, statistics,
runtime adoption, readiness, Paper Demo, production, broker mutation, and
execution remain unauthorized.
