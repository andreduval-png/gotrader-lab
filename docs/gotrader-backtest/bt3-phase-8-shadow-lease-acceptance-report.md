# BT3 Phase 8 Shadow Lease And Single-Owner Coordination Acceptance Report

Date: 2026-08-12

Parent checkpoint-recovery acceptance: `91100d0e171fb62c735fa97f4deedcd25c9434f0`

Authorization: `07c1abd7bb1d9c887150c7bf23bbd5362f0756c0`

Implementation: `396934036858e9f3b27bd2186e15e92e4eb14767`

## Decision

```text
ACC-BT3-PHASE-8-SHADOW-LEASE-SLICE
ACCEPTED FOR BROWSER-LOCAL SINGLE-OWNER COORDINATION

BT3 PHASE 8
REMAINS IN PROGRESS
```

Browser-local shadow orchestration now has hash-bound lease records and an
atomic per-job lease head. Checkpoint advancement and terminal evidence can be
guarded by the current unexpired owner inside the same IndexedDB transaction.

Accepted identities:

- implementation report: `sha256:bdcbe4387be6130a4c79df737a462b7d217f5cf17d1c0d1de0725bdab3a8bae7`;
- IndexedDB report: `sha256:6c4cbe6747c896c66e99e93c4e1365d94b2eb98a26be39692b3097a2c99b7809`;
- implementation commit: `396934036858e9f3b27bd2186e15e92e4eb14767`.

Results:

- concurrent foreign owners produce exactly one acquired lease and one blocked lease;
- same-owner duplicate acquisition coalesces without changing identity;
- renewal advances the epoch and hash-links the predecessor lease;
- release is owner-bound and a released lease cannot guard a commit;
- expired or released heads allow deterministic takeover with preserved lineage;
- stale, foreign, released, malformed, and expired proofs fail closed;
- lease proof is checked in the same IndexedDB transaction as snapshot advancement;
- lease heads survive database reopen and remain identity-valid;
- database version 2 preserves existing jobs, artifacts, checkpoints, seals, projections, and heads while adding immutable leases and current lease heads;
- checkpoint recovery and terminal mirroring regressions remain green;
- no worker, scheduler, MT5 contact, raw candle persistence, Paper Demo,
  production, broker mutation, readiness change, or execution occurred;
- authority remained `none/none/none`.

Complete BT3 and BT2 suites, both authoritative ledgers, MT5 time contracts,
typecheck, production build, syntax, hash, and diff checks passed. Browser smoke
passed all 44 tests. Existing non-failing Rollup warnings remain unchanged.

## Remaining Phase 8 Boundary

Stale-owner cancellation/quarantine behavior, bounded worker/service hosting,
runtime scheduling, retention, operator projection/control adoption, fallback,
rollback, and operational canary acceptance remain separately gated. The
legacy research cycle remains authoritative.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
shadowLeaseCoordinationAllowed: true
workerStartupAllowed: false
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false

PHASE 8 NEXT SLICE UNAUTHORIZED
PHASE 9 UNAUTHORIZED
PHASE 10 UNAUTHORIZED
BT3A UNAUTHORIZED
BROKER GATEWAY UNAUTHORIZED
```
