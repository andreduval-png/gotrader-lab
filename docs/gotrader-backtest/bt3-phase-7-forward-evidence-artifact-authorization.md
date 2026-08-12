# BT3 Phase 7 Forward-Evidence Artifact Authorization

Date: 2026-08-12

Branch: `codex/gotrader-bt3-evidence-artifacts`

Parent Phase 6 acceptance: `a39cb8f80acde460d8055ab05ee7c728d858d83b`

## Decision

```text
ACC-BT3-PHASE-7-FORWARD-EVIDENCE-ARTIFACT-SLICE
APPROVED FOR ISOLATED SHADOW IMPLEMENTATION
```

This Phase 7 slice may introduce a versioned, identity-keyed IndexedDB artifact
mirror for the existing forward-evidence ledger. Migration is append-first and
shadow-only. The synchronous localStorage ledger, its storage key, readers,
writers, events, UI consumers, runtime consumers, evaluation semantics, and
readiness-facing behavior remain authoritative and unchanged.

Each artifact must retain an exact compact legacy entry projection, explicit
legacy origin, profile/detector/policy identity, source lineage, causal tags,
authority, canonical hash version, and immutable artifact identity. A separate
manifest preserves ledger ordering. Legacy entries may not be relabeled as new
V2 evidence or credited with stronger causal status.

The slice may not automatically mirror writes, delete or rewrite localStorage,
change evidence evaluation, add experiment conclusions, change readiness,
consume raw candles, contact MT5, adopt runtime behavior, mutate broker state,
place an order, or execute. Migration of any second ledger, controlled
experiment policy, multiple-comparison policy, Phase 8, and BT3A remain
unauthorized.

## Acceptance Gate

1. Artifact and manifest schemas, versions, hash version, lineage, and
   authority are explicit and canonically hash-bound.
2. Legacy compact entries project byte-for-byte after migration.
3. Input order is preserved by an immutable ordered manifest.
4. Duplicate legacy IDs, tampered hashes, unknown future schemas, sensitive
   payloads, and immutable identity conflicts fail closed.
5. Repeated equivalent migration produces identical artifacts and manifest.
6. Actual browser IndexedDB persistence and reload pass.
7. Rollback removes only the shadow namespace and preserves legacy bytes.
8. Existing localStorage readers and all current consumers remain authoritative.
9. No raw candles, secrets, account, order, position, broker mutation, readiness
   override, Paper Demo, production, or execution data enters an artifact.
10. Focused migration, existing forward-evidence, complete BT3/BT2/time,
    typecheck, build, browser IndexedDB, syntax, hash, and diff gates pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyForwardEvidenceLedgerAuthoritative: true
automaticMirroringAllowed: false
secondLedgerMigrationAllowed: false
runtimeAdoptionAllowed: false
```

No later phase or additional ledger is authorized by this decision.

## Completion Record

This Phase 7 first-ledger slice passed under implementation commit
`2c18ab38bc7212c5c6d8cc8cab3d57f32b19f9b7`, contract report
`sha256:472ab05cdba4e6cb2aec4d8439b404667abd913d913918b1242e1a861f535b8f`,
and browser IndexedDB report
`sha256:94eee6c0f2bec51a854ff5a1a1407de02c22ddd1fb7ed7169aec71315420e276`.
Additional Phase 7 ledgers and policies remain separately gated.
