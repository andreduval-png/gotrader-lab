# BT3 Phase 6 Native Geometry And Structural Risk Acceptance Report

Date: 2026-08-12

Parent Phase 5 acceptance: `1f90c73722bfb7fbf384011d6505714d2bcce64c`

Authorization: `50adf3059e4e0f84626af837833351d6f78c70bf`

Implementation: `bd59f70c3bf221a03343f7f76cf0f6c7d602ce25`

## Decision

```text
ACC-BT3-PHASE-6-NATIVE-GEOMETRY-RISK
ACCEPTED
```

The native geometry assessment now validates one canonical BT2 opportunity and
describes its existing geometry using absolute price distance and dimensionless
R. It preserves declared entry, stop, signal, and target values and does not
apply a risk policy.

Accepted identities:

- report: `sha256:c4106d5cc597263f10974a74606b2a0293bd98a644c4ba523c6907853db142cd`;
- snapshot: `sha256:23271dfc0313ceaf11dc5a68484a3eefbc7fbee37a40e489096be6f7448a0ccb`;
- long multiple targets: `sha256:9c4f2b8580a82a47ff6a09391580b4b4f9ced320fe1da23f7feed5d2a5864255`;
- short single target: `sha256:08e8c29d21361c4d429c33fba1b927a827b4128cbcdb9a078fdd67cf634deefc`;
- displaced non-monotonic targets: `sha256:6d29188d6fca21b6cf55a284f4c08a23b2f7f41389c80bb5b66b0528692f7976`.

Results:

- three fixtures were byte-stable across repeated generation;
- long and short native geometry produced exact price-distance and R measures;
- multiple targets retained declared order and no target was selected or ranked;
- signal-entry displacement and non-monotonic target distance were reported as
  factual states without changing eligibility or geometry;
- canonical hash tampering, assessment tampering, and non-native geometry mode
  failed closed;
- native opportunity bytes remained unchanged after assessment;
- policy thresholds, instrument-unit conversions, sizing calculations, selected
  targets, and standardized RR experiments were all zero;
- no MT5 contact, raw candles, PnL, performance comparison, evidence, readiness,
  Paper Demo, broker mutation, runtime adoption, or execution was introduced;
- authority remained `none/none/none` and all capabilities remained disabled.

Validation passed the focused geometry suite, complete BT3 and BT2 regressions,
historical-time and MT5 time-contract checks, frozen snapshot checks, typecheck,
build, syntax, hash, and diff checks. Existing non-failing Rollup circular-chunk
and chunk-size warnings remain unchanged.

## Boundary

Current live geometry remains authoritative. Point, pip, tick, cash, margin,
portfolio, sizing, and standardized RR work requires separately sealed inputs
and authorization. Phase 7 compact-artifact and ledger migration work remains
separately gated and unauthorized. BT3A, analytics, performance comparison,
strategy selection, readiness, Paper Demo, production, broker mutation, and
execution remain unauthorized.
