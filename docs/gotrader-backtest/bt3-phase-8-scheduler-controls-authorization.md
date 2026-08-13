# BT3 Phase 8 Scheduler Controls Authorization

Date: 2026-08-12

Branch: `codex/gotrader-bt3-phase8-scheduler-controls`

Parent bounded-host acceptance: `a3d1473d57c65d2c21a7e9b7e34e393da727bd88`

## Decision

```text
AUTH-BT3-PHASE-8-SCHEDULER-CONTROLS-SLICE
APPROVED FOR EXPLICIT BROWSER-LOCAL POLICY AND PERSISTENCE ONLY
```

This slice may add deterministic schedule definitions, manually invoked due-work
evaluation, queue coalescing, resource admission, bounded retries, immutable
dispatch receipts, and evidence-safe retention around the accepted finite host.
It may not auto-start, register timers, or dispatch work without an explicit call.

## Acceptance Gate

1. Schedule definitions are hash-identified and calculate due times only from injected timestamps.
2. Duplicate logical jobs coalesce without duplicate queue entries or dispatch receipts.
3. Queue depth, per-tick dispatch, retry count, and resource estimates have hard upper bounds.
4. Backpressure rejects admission before host execution when a resource ceiling is exceeded.
5. Dispatch receipts are immutable, identity-validated, and bind schedule, job, attempt, result, and time.
6. Retry eligibility is deterministic and exhaustion cannot create an unbounded loop.
7. Pause, resume, and stop are explicit policy transitions; stopped schedulers cannot resume.
8. Browser persistence survives reopen and prevents concurrent-tab duplicate admission.
9. Retention is deterministic and cannot remove active leases, cancellation, quarantine,
   current checkpoint heads, terminal seals, projections, or dispatch audit evidence.
10. Scheduling cannot bypass accepted lease, cancellation, quarantine, concurrency, or stage-budget guards.
11. No interval, timeout, worker constructor, application-load registration, network
    contact, MT5, strategy logic, operator UI, Paper Demo, production adoption,
    broker mutation, readiness change, or execution is added.
12. Focused Node/browser tests and complete regression/build/browser/hash/diff gates pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
manualSchedulerTickAllowed: true
automaticSchedulerStartupAllowed: false
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false
```

No operator-control slice or later phase is authorized by this decision.
