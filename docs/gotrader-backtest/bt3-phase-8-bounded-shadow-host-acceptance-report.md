# BT3 Phase 8 Bounded Shadow Host Acceptance Report

Date: 2026-08-12

Branch: `codex/gotrader-bt3-phase8-bounded-shadow-host`

Authorization: `ba238113f7193c673f87700090213a65f24fd33d`

Implementation candidate: `5edb841d9560db45506bbe1fbb44985ec74ad10b`

## Decision

```text
ACC-BT3-PHASE-8-BOUNDED-SHADOW-HOST-SLICE
ACCEPTED FOR EXPLICIT BROWSER-LOCAL FINITE-RUN HOSTING

PHASE 8 REMAINS IN PROGRESS
```

## Accepted Evidence

- Node host report:
  `sha256:dfa975e68e1de2ec69bcd31d0f8ab02b6961f10ad531c5b1ae33d0935d2153fe`.
- Browser IndexedDB report:
  `sha256:f62e6e71339ccd7545baffd3793c22bcae693c8ac283f1226e663efa038669fe`.
- Explicit single-start lifecycle and graceful stop/drain passed.
- Configuration rejects unbounded concurrency, stage budgets, lease duration,
  and renewal boundaries.
- Admission enforces declared concurrency without queuing hidden work.
- Each run advances at most its declared stage budget.
- Lease acquisition, deterministic renewal, owner-bound release, and released
  proof rejection passed.
- Persisted cancellation is observed before further work and does not fabricate
  a post-cancellation checkpoint or terminal seal.
- Renewal loss produces immutable quarantine evidence and prevents later commits.
- Two finite browser runs resumed from the persisted checkpoint, did not replay
  completed stages, and produced the accepted terminal seal and projection.
- Complete BT3 and BT2 aggregates, authoritative forward-evidence and prediction
  ledgers, MT5 time contracts, strict typecheck, production build, syntax/diff,
  and sequential 44-test browser smoke passed.
- Production build emitted only the existing Rollup circular-export and chunk-size warnings.

The first aggregate invocation used obsolete BT2 npm aliases and stopped before
running that lane. The corrected canonical `test:bt2` aggregate passed; this was
an invocation error, not a candidate failure, and no evidence was altered.

## Boundary

The accepted host has no timer, worker constructor, recurring loop, autonomous
dispatch, network call, MT5 integration, UI control, or production adoption.
Scheduler/coalescing/resource/retention controls remain a separate unauthorized
slice.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
boundedShadowHostAllowed: true
recurringSchedulingAllowed: false
autonomousDispatchAllowed: false
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false

PHASE 8 NEXT SLICE UNAUTHORIZED
PHASE 9 UNAUTHORIZED
PHASE 10 UNAUTHORIZED
BT3A UNAUTHORIZED
BROKER GATEWAY UNAUTHORIZED
```
