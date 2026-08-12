# BT3 Phase 7 Forward-Evidence Artifact Acceptance Report

Date: 2026-08-12

Parent Phase 6 acceptance: `a39cb8f80acde460d8055ab05ee7c728d858d83b`

Authorization: `b552b5e1fa13c97789c99d85da27e16031325648`

Implementation: `2c18ab38bc7212c5c6d8cc8cab3d57f32b19f9b7`

## Decision

```text
ACC-BT3-PHASE-7-FORWARD-EVIDENCE-ARTIFACT-SLICE
ACCEPTED
```

The first Phase 7 ledger slice now provides a versioned, identity-keyed
IndexedDB artifact mirror for compact forward-evidence entries. It is an
explicitly invoked shadow migration. The existing localStorage ledger and all
current readers, writers, events, views, runtime consumers, evidence evaluation,
and readiness-facing behavior remain authoritative and unchanged.

Accepted identities:

- contract report: `sha256:472ab05cdba4e6cb2aec4d8439b404667abd913d913918b1242e1a861f535b8f`;
- browser IndexedDB report: `sha256:94eee6c0f2bec51a854ff5a1a1407de02c22ddd1fb7ed7169aec71315420e276`;
- snapshot: `sha256:de819bc6d056dbd69cc420b8f90e3a406de7ebe529dc3e4d0b796a3d1b94b9b5`;
- manifest: `sha256:2c9242cf4f4f4bb1c8df32b8297705db00427852645f89212d6615068d980aef`;
- first artifact: `sha256:0b1b6af620282789b136d9d08e5eec48044871f3e107b17fbe5ad603393e461a`;
- second artifact: `sha256:6780b5b46fa2e9c3a6d653a3213dbaae396d3d86f095e19aa89a569a1d18a7ca`.

Results:

- equivalent migration was byte-stable and reproduced identical identities;
- ordered manifests preserved legacy ledger order without changing content IDs;
- artifact projection reproduced actual persisted legacy JSON bytes exactly;
- explicit profile, detector, construction, cost, risk, calendar, source,
  causal, derivation, hash-version, and authority fields were hash-bound;
- duplicate legacy IDs, unknown schemas, tampered hashes, unsafe payloads, and
  poisoned immutable IndexedDB records failed closed;
- actual Chromium IndexedDB persistence, reload, and idempotent repeat passed;
- rollback retained artifacts shared by another manifest and removed them only
  after their final manifest was rolled back;
- localStorage legacy bytes remained unchanged before, during, and after
  migration and rollback;
- automatic mirroring was not added and migrated ledger count was exactly one;
- no MT5 contact, raw candles, secrets, account/order/position data, new causal
  credit, readiness change, Paper Demo, broker mutation, or execution occurred;
- authority remained `none/none/none`.

Validation passed the focused artifact and actual browser IndexedDB suites, the
original forward-evidence ledger, complete BT3 and BT2 regressions, historical
and MT5 time contracts, typecheck, production build, syntax, hash, and diff
checks. The browser route smoke passed all 44 tests. Existing non-failing Rollup
circular-chunk and chunk-size warnings remain unchanged.

## Boundary

The legacy forward-evidence ledger remains authoritative and no automatic
mirroring or runtime adoption is enabled. Phase 7 remains open for separately
authorized one-ledger-at-a-time slices plus controlled-experiment and
multiple-comparison policy. Migration of a second ledger, Phase 8 orchestration,
BT3A, readiness, Paper Demo, production, broker mutation, and execution remain
unauthorized.
