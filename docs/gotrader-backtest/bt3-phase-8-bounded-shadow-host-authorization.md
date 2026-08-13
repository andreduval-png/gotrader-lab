# BT3 Phase 8 Bounded Shadow Host Authorization

Date: 2026-08-12

Branch: `codex/gotrader-bt3-phase8-bounded-shadow-host`

Parent cancellation and quarantine acceptance: `4ba8001a685467a009a2a2299e6ce81815820c78`

## Decision

```text
AUTH-BT3-PHASE-8-BOUNDED-SHADOW-HOST-SLICE
APPROVED FOR EXPLICIT BROWSER-LOCAL FINITE-RUN HOSTING ONLY
```

This slice may add a deterministic browser-local host around the accepted
shadow orchestration, lease, cancellation, quarantine, and recovery contracts.
The host must be started with an explicit job and handlers, process only a
bounded amount of work, and stop without recurring or time-based dispatch.

## Acceptance Gate

1. The host has explicit start, stop, and terminal lifecycle states.
2. Configuration rejects unbounded concurrency, work, lease, and renewal limits.
3. One host instance runs at most its declared concurrency and stage budget.
4. Every job acquires an owner-bound lease before work and renews only at deterministic boundaries.
5. Cancellation is observed before subsequent stage advancement and leads to a cancelled terminal result.
6. Lease loss, stale ownership, foreign ownership, or failed renewal prevents further commits and preserves quarantine evidence.
7. Graceful stop admits no new work and allows only already-admitted bounded work to settle.
8. A stopped or crashed host can recover from persisted checkpoints without replaying completed stages.
9. The host attempts owner-bound lease release on every settled path and cannot commit with released proof.
10. Raw candles, recurring scheduling, autonomous dispatch, strategy logic, MT5,
    UI/operator migration, Paper Demo, production, broker mutation, readiness
    changes, and execution remain outside this slice.
11. Focused Node and browser IndexedDB tests plus complete regression, build,
    browser smoke, syntax, hash, and diff gates pass.

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
```

No scheduler, later Phase 8 slice, or later phase is authorized by this decision.
