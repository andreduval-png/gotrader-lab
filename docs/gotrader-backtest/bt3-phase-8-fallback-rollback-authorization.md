# BT3 Phase 8 Fallback And Rollback Authorization

Date: 2026-08-13

Branch: `codex/gotrader-bt3-phase8-fallback-rollback`

Parent operator-controls acceptance: `7869ded711bdc45b2ed8dbb317b597fb2730e83c`

## Decision

```text
AUTH-BT3-PHASE-8-FALLBACK-ROLLBACK-SLICE
APPROVED FOR EXPLICIT BROWSER-LOCAL SHADOW HEAD RECOVERY ONLY
```

This slice may add deterministic preview and explicitly confirmed, owner-bound,
atomic movement of a shadow orchestration head to validated preserved evidence.
It may not delete evidence, start automatically, or affect authoritative runtime.

## Acceptance Gate

1. Preview binds logical job, expected current head, explicit target checkpoint,
   rollback depth, owner proof, observation time, and preserved evidence counts.
2. Empty, corrupt, missing, terminal-incomplete, stale, foreign, released, expired,
   superseded, or over-depth state fails closed.
3. Application requires the exact preview identity and deterministic destructive
   confirmation token.
4. Current active lease ownership is validated inside the same transaction as the
   expected-head compare-and-set.
5. Rollback changes only the current job head; jobs, stages, checkpoints, seals,
   projections, leases, cancellations, quarantines, dispatch receipts, operator
   command receipts, and rollback evidence remain immutable.
6. Each application creates an immutable canonical receipt; retry and reopen
   coalesce to the same receipt.
7. Concurrent tabs cannot apply conflicting rollback targets.
8. Rolled-back shadow state remains non-authoritative and cannot promote legacy,
   runtime, strategy, Paper Demo, broker, production, readiness, or execution state.
9. No automatic rollback, interval, timeout, worker, visible UI, network contact,
   MT5 integration, strategy logic, or runtime adoption is added.
10. Focused Node/browser tests and complete regression/build/browser/hash/diff gates pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
manualRollbackAllowed: true
automaticRollbackAllowed: false
evidenceDeletionAllowed: false
runtimeAdoptionAllowed: false
```

No operational canary, Phase 8 freeze, or later phase is authorized by this decision.
