# BT3 Phase 7 Prediction Artifact Authorization

Date: 2026-08-12

Branch: `codex/gotrader-bt3-prediction-artifacts`

Parent first-ledger acceptance: `27b05baf2f6e233ea8c583a70eb76df2f3210512`

## Decision

```text
ACC-BT3-PHASE-7-PREDICTION-ARTIFACT-SLICE
APPROVED FOR ISOLATED SHADOW IMPLEMENTATION
```

This second Phase 7 slice may add versioned, identity-keyed prediction artifacts
and ordered manifests to the accepted evidence-artifact IndexedDB repository.
The repository database may advance additively from version 1 to version 2 only
to create prediction stores. Existing forward-evidence stores, records,
manifests, identities, projections, and rollback behavior must remain intact.

Migration is explicitly invoked and shadow-only. The prediction localStorage
state, storage key, synchronous readers and writers, candle-close subscriptions,
operator and performance consumers, calibration semantics, events, and clear
behavior remain authoritative and unchanged.

Prediction artifacts preserve exact persisted legacy entry projections,
lifecycle and resolution state, model/scenario/source identity, causal timing,
probability provenance, safety, authority, typed derivation, canonical hash
version, and immutable identity. A manifest preserves ledger order and legacy
state identity without treating predictions as evidence or readiness.

The slice may not automatically mirror writes, alter probability or calibration,
upgrade causal credit, change a prediction lifecycle, clear or rewrite
localStorage, migrate another ledger, consume raw candles, contact MT5, change
readiness, adopt runtime behavior, mutate broker state, place an order, or
execute. Experiment governance, further Phase 7 ledgers, Phase 8, and BT3A remain
unauthorized.

## Acceptance Gate

1. Database version 1 forward-evidence records survive the additive version 2
   upgrade with identical artifact, manifest, and legacy projection bytes.
2. Prediction artifact and manifest schemas, lineage, versions, causal timing,
   probability provenance, safety, authority, and IDs are hash-bound.
3. Pending, resolved, invalidated/expired, and context-only states remain exact.
4. Actual persisted prediction localStorage JSON projects byte-for-byte.
5. Ordered manifests preserve prediction ledger ordering and updated-at identity.
6. Duplicate IDs, unknown schemas, tampered hashes, sensitive payloads, and
   immutable conflicts fail closed.
7. Actual browser IndexedDB persistence, reload, idempotency, shared-reference
   retention, scoped rollback, and cross-family isolation pass.
8. Prediction rollback preserves legacy bytes and all forward-evidence artifacts.
9. Existing prediction tests and current consumers remain authoritative.
10. Focused prediction/repository upgrade, complete BT3/BT2/time, typecheck,
    build, 44-route browser smoke, syntax, hash, and diff gates pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyPredictionLedgerAuthoritative: true
legacyForwardEvidenceLedgerAuthoritative: true
automaticMirroringAllowed: false
migratedLedgerCount: 2
thirdLedgerMigrationAllowed: false
runtimeAdoptionAllowed: false
```

No additional ledger or later phase is authorized by this decision.
