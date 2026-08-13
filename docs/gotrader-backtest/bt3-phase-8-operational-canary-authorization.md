# BT3 Phase 8 Operational Canary Authorization

Date: 2026-08-13

Branch: `codex/gotrader-bt3-phase8-operational-canary`

Parent fallback/rollback acceptance: `249631e36fde497892b42242b03c0edbbd86a290`

## Decision

```text
AUTH-BT3-PHASE-8-OPERATIONAL-CANARY
APPROVED FOR ONE EXPLICIT FOUR-HOUR BROWSER-LOCAL SHADOW OBSERVATION
```

This slice may add and run one bounded browser-local canary against isolated test
databases. It may not adopt the application runtime or contact an external service.

## Acceptance Gate

1. A focused harness validates configuration, canonical checkpoint/report identity,
   monotonic elapsed accounting, resume identity, and fail-closed report assessment.
2. The operational run lasts at least four real monotonic hours; injected wall-clock
   samples may label evidence but cannot satisfy elapsed duration.
3. Exactly one observer process and one browser context run at a time.
4. Periodic checkpoints are integrity-hashed, append-only, and resume only from an
   identity-valid checkpoint bound to candidate, configuration, and run identity.
5. The isolated run exercises orchestration/checkpoint recovery, lease lifecycle,
   stale-owner rejection, cancellation/quarantine, bounded host, scheduler bounds,
   operator commands/projections, and fallback/rollback.
6. Cancellation plus process restart/resume is proved without clearing test evidence.
7. Concurrency, queue, stage, retry, storage, memory, and sample counts remain bounded.
8. There are zero unexpected blockers, conflicts, duplicates, gaps, corruption,
   authority violations, external contacts, or evidence mutations.
9. Final state is healthy, fresh, complete, integrity-valid, and blocker-free.
10. No application startup, visible UI, MT5/network contact, strategy logic, Paper
    Demo, runtime adoption, production authority, broker mutation, readiness change,
    or execution is added.
11. Focused and complete regression/build/browser gates pass before operation; complete
    gates run again only after an integrity-valid operational report passes.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
oneOperationalCanaryAllowed: true
minimumRealDurationHours: 4
externalContactAllowed: false
runtimeAdoptionAllowed: false
```

Phase 8 freeze and every later phase remain unauthorized.
