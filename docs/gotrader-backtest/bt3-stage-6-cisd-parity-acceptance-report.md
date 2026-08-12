# BT3 Stage 6 CISD Parity Acceptance Report

Date: 2026-08-12

Parent Turtle Soup Stage 5 acceptance: `44ae07bbe3b787959927770aa61d465b538bd952`

Authorization: `34f97998c1aefb260c971587c0e60247f74a1dd4`

Implementation: `0a3ff40ebe2b27707708c7de1eb3c2ba1fd13fdb`

## Decision

```text
ACC-BT3-CISD-PARITY-STAGE-6
ACCEPTED
```

CISD v1 now has compact deterministic fixture parity with the BT2 canonical
opportunity contract. Native 5m long and 15m short fixtures preserve geometry
and close timing, while weak-displacement and no-retest states emit no
opportunity.

Accepted identities:

- report: `sha256:56956f1d91a28a379595727b86371d821a08ce6b76bd285007667c641109a539`;
- snapshot: `sha256:b1e86247a16ddd3238e32b8f237d159c548b688bb1c28cff5e29e99425484aeb`;
- 5m long parity: `sha256:567d31a800c214f6366fd3bce01a1084bb14178d553386a682dee16dce9742f3`;
- 15m short parity: `sha256:5bc94420683df0381c6a0c389e6e6aba37d03ededa9e24a2bf521e8f41b337c9`;
- weak-CISD parity: `sha256:4a795975d59bebfd54205a7c4d868c4b037467687a954aa77b8fd3933ef054c4`;
- no-retest parity: `sha256:daf735622e555be8e662e234192892a56fb5670c51b0601dad4110596e50662e`.

Results:

- four fixtures were byte-stable across repeated generation;
- eligible fixtures preserved native side, entry, stop, target, and 5m/15m
  source-close boundaries;
- weak-displacement and no-retest fixtures remained blocked;
- attempts to rewrite the audited negative-control facts failed closed;
- CISD retained 109 audited candidates, 72.48% invalidation-first, degraded
  OOS, rejected robustness, and `negative_control` classification;
- prior frozen BT3 snapshots remained unchanged;
- no MT5 contact, raw candles, historical claim, promotion, or authority was
  created.

Validation passed the native CISD suite, time normalization, complete BT3 and
BT2 regressions, frozen snapshot checks, typecheck, build, and diff checks.
Existing non-failing Rollup warnings remain unchanged.

## Boundary

Session raid is next in roadmap order but remains separately gated. Historical
strategy simulation, performance comparison, BT3A, analytics, search,
statistics, runtime adoption, readiness, Paper Demo, production, broker
mutation, and execution remain unauthorized.
