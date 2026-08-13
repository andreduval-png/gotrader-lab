# BT3 Phase 8 Stale-Owner Cancellation And Quarantine Authorization

Date: 2026-08-12

Branch: `codex/gotrader-bt3-phase8-stale-owner-quarantine`

Parent lease acceptance: `a20239d6a56e9f09a5508d6d476906a760ba9b8f`

## Decision

```text
AUTH-BT3-PHASE-8-STALE-OWNER-QUARANTINE-SLICE
APPROVED FOR BROWSER-LOCAL CANCELLATION AND QUARANTINE ONLY
```

This slice may add immutable cancellation and quarantine evidence around the
accepted shadow lease coordinator. It may prevent stale, foreign, released, or
cancelled owners from advancing shadow snapshots. It may not start workers,
schedule work, contact MT5, or replace the authoritative legacy cycle.

## Acceptance Gate

1. Cancellation identity binds job, current lease, owner, epoch, reason, and time.
2. Only the current unexpired owner can request cancellation.
3. Repeated identical cancellation coalesces; conflicting cancellation fails closed.
4. Cancellation prevents later checkpoint advancement or terminal sealing.
5. Stale, foreign, released, expired, and superseded attempts create immutable quarantine evidence.
6. Quarantine evidence binds the rejected lease, current lease head, attempted action, and blocker.
7. A stale owner cannot overwrite the current lease, cancellation head, job head, or artifacts.
8. IndexedDB checks cancellation and lease ownership atomically with snapshot persistence.
9. Existing lease, recovery, and terminal-mirroring behavior remains backward compatible.
10. Raw candles, retries, workers, services, scheduling, UI/operator migration, MT5,
    Paper Demo, production, broker mutation, readiness changes, and execution remain outside this slice.
11. Focused and complete regression/build/browser/hash/diff gates pass.

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
```

No later slice or phase is authorized by this decision.
