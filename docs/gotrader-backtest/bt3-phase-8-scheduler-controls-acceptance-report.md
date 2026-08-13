# BT3 Phase 8 Scheduler Controls Acceptance Report

Date: 2026-08-12

Branch: `codex/gotrader-bt3-phase8-scheduler-controls`

Authorization: `b0e946be0b8b27d6e7f30726eb01306d64d51a07`

Implementation candidate: `8aea38ceb247901110f78df94e5616eb9db5e106`

## Decision

```text
ACC-BT3-PHASE-8-SCHEDULER-CONTROLS-SLICE
ACCEPTED FOR EXPLICIT BROWSER-LOCAL MANUAL SCHEDULER TICKS

PHASE 8 REMAINS IN PROGRESS
```

## Accepted Evidence

- Node policy report:
  `sha256:eb11cec16f5147b44a49bd079e1a1bdac629d2dc377756064af8900facb65a57`.
- Browser IndexedDB report:
  `sha256:178553ffc397d4f92077b32b6d1fd4c324551239364ff2d81443891e95fa0530`.
- Schedule and queue identities are canonical and tamper-validated.
- Due-time evaluation is deterministic from explicit timestamps.
- Duplicate logical jobs coalesce at the same due boundary.
- Queue depth, dispatch count, resources, and retries have hard bounds.
- Pause, resume, and terminal stop transitions pass.
- Concurrent browser repositories admit one queue record and coalesce the duplicate.
- Queue and receipt persistence survives reopen; settlement rejects a stale claimant.
- Dispatch receipts remain immutable after queue-entry compaction.
- Scheduler retention is structurally isolated from the orchestration database and
  preserves active lease, cancellation, quarantine, checkpoint, seal, and projection evidence.
- End-to-end browser dispatch through the bounded host observed persisted cancellation
  and produced no checkpoint, proving scheduler policy cannot bypass accepted guards.
- Complete BT3/BT2, authoritative ledgers, MT5 time contracts, strict typecheck,
  production build, syntax/diff, and sequential 44-test browser smoke passed.
- Production build emitted only the existing Rollup circular-export and chunk-size warnings.

The first focused Node invocation failed because its assertion attempted to sort
an intentionally frozen returned array in place. The harness was corrected to
sort a copy; implementation state was unchanged, and both focused suites passed.

## Boundary

The scheduler exposes only explicit `start`, `pause`, `resume`, `stop`, and
manually invoked `tick` contracts. It registers no timer, worker, application-load
hook, network call, MT5 integration, operator control, or production adoption.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
manualSchedulerTickAllowed: true
automaticSchedulerStartupAllowed: false
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false

PHASE 8 NEXT SLICE UNAUTHORIZED
PHASE 9 UNAUTHORIZED
PHASE 10 UNAUTHORIZED
BT3A UNAUTHORIZED
BROKER GATEWAY UNAUTHORIZED
```
