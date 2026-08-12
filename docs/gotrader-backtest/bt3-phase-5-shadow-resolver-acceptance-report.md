# BT3 Phase 5 Shadow Conflict/Confluence Resolver Acceptance Report

Date: 2026-08-12

Parent Session Raid Stage 7 acceptance: `b79a5cc56927621ae2489cbdfa7521aeaf520c1d`

Authorization: `7ab949116711f6f70b276255051451a0dcc2081e`

Implementation: `98a5196bb587508f8b7d8d25945f24f7943db049`

## Decision

```text
ACC-BT3-PHASE-5-SHADOW-RESOLVER
ACCEPTED
```

The evidence-family-aware shadow resolver now classifies active canonical
opportunity overlap without selecting or changing any trade candidate. It
groups only explicit evidence-family tags and reports single, same-family,
cross-family confluence, cross-family conflict, mixed, and no-active states.

Accepted identities:

- report: `sha256:0a4afca28b77c027d057148b4fd471e22642396732b25b038cd1598bc10eab36`;
- snapshot: `sha256:369ad3520891aae6b5e02170fb4a7db0f3c8d02a5c351751e128d8ed00294646`;
- single: `sha256:59cdeefb9a3fedec8a75745402044a9afed387434cff9202be55f37be0164277`;
- same-family overlap: `sha256:c9dddb6fe283d976b8074061c730e2c7ee30656b062ec6ac68d1dadff2b7051c`;
- cross-family confluence: `sha256:643e4c9764a90d4c1faf4929883903c71ad1cfba01dad28b2d7018565e064269`;
- cross-family conflict: `sha256:2de5a169827430c1e894aa096e6b4a5f7f7cbe4819c5d8458106f1f85c78596b`;
- mixed: `sha256:554c68425acf427da3a90ed68542853fd0292b9d783a02c2d3d3790a95082e4b`;
- no-active: `sha256:b91e382db5b9620bd0180e6b92248b535723d8cc22eb239321dd85368a1485bd`.

Results:

- six fixtures were byte-stable across repeated generation;
- equivalent reversed inputs produced the same resolution identity and bytes;
- canonical opportunity hashes and structure were verified before resolution;
- duplicate IDs, mixed symbol scope, and tampered opportunity hashes failed
  closed;
- explicit evidence-family grouping prevented strategy-name inference;
- every active and inactive candidate identity was preserved;
- selected opportunity count was exactly zero;
- no geometry, eligibility, priority, ranking, or production behavior changed;
- no MT5 contact, raw candles, historical run, evidence, readiness, Paper Demo,
  broker mutation, or authority was introduced.

Validation passed the focused resolver suite, complete BT3 and BT2 regressions,
time normalization, frozen snapshot checks, typecheck, build, syntax, hash, and
diff checks. Existing non-failing Rollup circular-chunk and chunk-size warnings
remain unchanged.

## Boundary

Current live opportunity resolution remains authoritative. Phase 6 geometry and
instrument-neutral structural-risk consolidation remains separately gated and
unauthorized. BT3A, analytics, performance comparison, strategy selection,
runtime adoption, readiness, Paper Demo, production, broker mutation, and
execution remain unauthorized.
