# BT3 Phase 8 Stale-Owner Cancellation And Quarantine Acceptance Report

Date: 2026-08-12

Parent lease acceptance: `a20239d6a56e9f09a5508d6d476906a760ba9b8f`

Authorization: `bbfc1913a8cf19b260007543886f8c47c6ee74f9`

Implementation: `3b97e13bcbd69fc0c0cf67dcf674a5565ab03bf4`

## Decision

```text
ACC-BT3-PHASE-8-STALE-OWNER-QUARANTINE-SLICE
ACCEPTED FOR BROWSER-LOCAL CANCELLATION AND QUARANTINE

BT3 PHASE 8
REMAINS IN PROGRESS
```

Shadow orchestration now persists immutable owner-bound cancellation records
and quarantine evidence for rejected stale, foreign, released, expired, or
cancelled-owner actions. Lease and cancellation heads are checked atomically
before any guarded snapshot advancement.

Accepted identities:

- focused report: `sha256:f5e4f3dc367324a62cc67c133326ade300763c32bb063c2c414cd50befc0fe9c`;
- implementation commit: `3b97e13bcbd69fc0c0cf67dcf674a5565ab03bf4`.

Results:

- only the current unexpired owner can create cancellation evidence;
- repeated identical cancellation coalesces without changing identity;
- conflicting cancellation fails closed;
- cancellation prevents checkpoint advancement and terminal sealing;
- stale-owner advancement and cancellation attempts produce immutable quarantine evidence;
- blocker classification uses current and proof lease identities, not ambiguous error text;
- quarantine binds rejected lease, current head, owner, action, blocker, and time;
- rejected actions leave job, artifact, checkpoint, cancellation, and lease heads unchanged;
- database version 3 preserves accepted stores while adding cancellations,
  cancellation heads, and quarantines;
- lease, repository, checkpoint-recovery, and terminal-mirroring regressions passed;
- no raw candles, worker, scheduler, MT5 contact, Paper Demo, production,
  broker mutation, readiness change, or execution occurred;
- authority remained `none/none/none`.

Complete BT3 and BT2 suites, both authoritative ledgers, MT5 time contracts,
typecheck, production build, syntax, hash, and diff checks passed. Sequential
browser smoke passed all 44 tests. Existing non-failing Rollup warnings remain unchanged.

## Remaining Phase 8 Boundary

Bounded worker/service hosting, scheduler/coalescing/resource/retention
controls, operator projections and controls, fallback/rollback, and the
multi-hour operational canary remain separately gated. The legacy research
cycle remains authoritative.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
shadowCancellationAllowed: true
shadowQuarantineAllowed: true
workerStartupAllowed: false
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false

PHASE 8 NEXT SLICE UNAUTHORIZED
PHASE 9 UNAUTHORIZED
PHASE 10 UNAUTHORIZED
BT3A UNAUTHORIZED
BROKER GATEWAY UNAUTHORIZED
```
