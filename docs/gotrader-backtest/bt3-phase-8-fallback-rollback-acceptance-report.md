# BT3 Phase 8 Fallback And Rollback Acceptance Report

Date: 2026-08-13

Branch: `codex/gotrader-bt3-phase8-fallback-rollback`

Authorization: `1a5ef0474450d8d55e3708ecc2436b6a4999237a`

Implementation: `c94f3c0154b13f8ab79d3a2ea749d7012ea4ba4c`

Compatibility correction: `7a9ec50a7c92e9c65340bb1b053c8ffba05dd5a2`

## Decision

```text
ACC-BT3-PHASE-8-FALLBACK-ROLLBACK-SLICE
ACCEPTED FOR EXPLICIT BROWSER-LOCAL SHADOW HEAD RECOVERY

PHASE 8 REMAINS IN PROGRESS
```

## Accepted Evidence

- Node report: `sha256:d91a90fce239a926d3cb0a842650b67c9e47c463df0f025e4d5322845dda68f6`.
- Browser IndexedDB report: `sha256:54b235f79173f8edf89acbd58dd561be000857d4cc6ba5503013e83ee7503fb4`.
- Preview identity deterministically binds job, expected current checkpoint, explicit
  ancestor target, bounded depth, owner, lease, timestamp, and evidence counts.
- Missing, unrelated, over-depth, and terminal-incomplete targets fail closed.
- Application requires the exact confirmation and full current lease proof.
- Expected-head and lease validation occur in the same IndexedDB transaction as
  head movement and immutable receipt creation.
- Concurrent application coalesces, reopen retry returns the same receipt, and a
  stale-owner attempt is quarantined without moving the current head.
- Rollback moves only the job head. Preserved jobs, artifacts, checkpoints,
  terminal seals, projections, leases, previews, receipts, and quarantine evidence
  remain available.
- Database schema upgraded from v3 to v4. Legacy browser harnesses now consume the
  repository's exported schema version rather than pinning stale metadata.
- Complete BT3/BT2, authoritative ledgers, MT5 time contracts, strict typecheck,
  production build, syntax/diff, and sequential 44-test browser smoke passed.
- Production build emitted only the existing Rollup circular-export and chunk-size warnings.

## Preserved Failures

- The initial focused harness destructured a nonexistent terminal field from the
  shared fixture. It was corrected to materialize snapshots with the accepted engine.
- A subsequent fixture used a terminal checkpoint from a separate deterministic run,
  which correctly failed ancestry validation. It was replaced with a preserved
  three-head resume chain from the accepted engine.
- One negative assertion expected only an ancestor blocker while the implementation
  correctly returned the more precise bounded-depth blocker; the assertion was fixed.
- The first complete matrix stopped when the older orchestration IndexedDB harness
  opened schema version 3 after the accepted implementation upgraded the database to
  version 4. Three harnesses were corrected to use the exported current version, all
  affected suites passed, and the entire matrix then passed from clean `7a9ec50`.

## Boundary

Rollback remains explicit, browser-local, shadow-only, append-only, and
non-authoritative. No automatic rollback, visible UI, timer, worker, network call,
MT5 contact, strategy logic, runtime adoption, Paper Demo, production authority,
broker mutation, readiness change, or execution was added.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
manualRollbackAllowed: true
automaticRollbackAllowed: false
evidenceDeletionAllowed: false
runtimeAdoptionAllowed: false

PHASE 8 OPERATIONAL CANARY UNAUTHORIZED
PHASE 8 FREEZE UNAUTHORIZED
PHASE 9 UNAUTHORIZED
BT3A UNAUTHORIZED
BROKER GATEWAY UNAUTHORIZED
```
