# BT3 Phase 7 Prediction Artifact Acceptance Report

Date: 2026-08-12

Parent first-ledger acceptance: `27b05baf2f6e233ea8c583a70eb76df2f3210512`

Authorization: `251e7f08dfe918e13cfa4c545c6d784eaacf2a37`

Implementation: `01d4e2097ee0f9b8d349d0c96c0a639a4737dc58`

Compatibility-test correction: `9f86866a9f6c5f91ec12f53ca208015588a9b5d3`

## Decision

```text
ACC-BT3-PHASE-7-PREDICTION-ARTIFACT-SLICE
ACCEPTED
```

The second Phase 7 ledger slice adds versioned, identity-keyed prediction
artifacts and ordered manifests to the accepted evidence-artifact IndexedDB
repository. The database upgrade from version 1 to version 2 is additive and
preserves the existing forward-evidence stores and records. Migration remains
explicitly invoked and shadow-only. The prediction localStorage ledger and all
current readers, writers, subscriptions, events, consumers, calibration
semantics, and lifecycle behavior remain authoritative and unchanged.

Accepted identities:

- contract report: `sha256:b59e3df941a690f9016bf8fa0d59e79d25906fcd8ddd09b15f44bccce3f8445f`;
- browser IndexedDB report: `sha256:b95fd2ee9ce1f67983e0c45a724afb942c072ac5723d7005987a56fa86929feb`;
- snapshot: `sha256:1fabc15457b0a5f7dd4e165531f8dd5707359d04da344235d64d7de8f85497a6`;
- manifest: `sha256:57ae736979edeb177b5119eb49bc5181744b09ba61db3d93ef65ed9b12f37752`;
- artifacts: `sha256:2c8b5c607b9b4c81ee9a687e33ba56f833758ddfc9673bcef561c7de013465a2`,
  `sha256:f36b3fd6e9be1c00971c555cef0082cf7f829c8334bfe89dddcdf6e6dbdd0c7f`,
  `sha256:19044b99e57a96671b07f4b184fc907cff87191fe0dfaaebbb78111b2e3ef300`,
  and `sha256:4f63d09b2a769786f7776196953b36f21b988ce150ca1fa1fc3812a15b42c1e0`.

Results:

- pending, resolved target-first, invalidated/invalidation-first, and
  context-only not-actionable entries preserved exact legacy projections;
- model, scenario, provider, symbol, timeframe, source fingerprint, causal
  timing, lifecycle, probability provenance, safety, derivation, hash version,
  and authority were hash-bound;
- equivalent migration was byte-stable and ordered manifests preserved ledger
  order and legacy updated-at identity;
- duplicate IDs, unknown schemas, tampered hashes, unsafe payloads, and poisoned
  immutable IndexedDB records failed closed;
- an actual Chromium version 1 to version 2 upgrade retained forward-evidence
  artifacts and added prediction stores without rewriting either family;
- browser persistence, reload, idempotency, shared-reference retention, scoped
  rollback, immutable-conflict rejection, and cross-family isolation passed;
- prediction rollback preserved exact localStorage bytes and all
  forward-evidence artifacts;
- automatic mirroring was not added and migrated ledger count is exactly two;
- no MT5 contact, raw candles, readiness change, Paper Demo, broker mutation,
  production activation, or execution occurred;
- authority remained `none/none/none`.

Complete BT3 and BT2 suites passed. The original prediction and forward-evidence
ledgers, MT5 time normalization and upstream time contracts, typecheck,
production build, syntax, hash, and diff checks passed. Browser smoke passed all
44 routes. The prediction-ledger source-contract test initially exposed a stale
regex that still required the pre-canonical `identity.dataFingerprint` spelling;
the production source had used `canonicalFingerprint` since commit `c0c3183`.
The compatibility assertion was corrected narrowly and the gate then passed.
Existing non-failing Rollup circular-chunk and chunk-size warnings remain.

## Boundary

Prediction and forward-evidence localStorage ledgers remain authoritative. No
automatic mirroring or runtime adoption is enabled. Phase 7 remains open for a
separately authorized controlled-experiment and multiple-comparison policy;
migration of a third ledger is not authorized by this acceptance. Phase 8,
BT3A, readiness, Paper Demo, production, broker mutation, and execution remain
unauthorized.
