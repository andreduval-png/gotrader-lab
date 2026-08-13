# BT3 Phase 8 Shadow Lease And Single-Owner Coordination Authorization

Date: 2026-08-12

Branch: `codex/gotrader-bt3-phase8-shadow-lease`

Parent checkpoint-recovery acceptance: `91100d0e171fb62c735fa97f4deedcd25c9434f0`

## Decision

```text
AUTH-BT3-PHASE-8-SHADOW-LEASE-SLICE
APPROVED FOR BROWSER-LOCAL SINGLE-OWNER COORDINATION ONLY
```

This Phase 8 slice may add deterministic browser-local lease records and atomic
single-owner coordination for accepted shadow-orchestration jobs. It may guard
checkpoint advancement and terminal sealing, but it may not start a worker,
schedule work, contact MT5, or replace the authoritative legacy research cycle.

## Acceptance Gate

1. Lease identity binds the logical job, owner, epoch, acquisition, expiry, and prior lease.
2. One unexpired owner excludes every foreign owner atomically.
3. Same-owner acquisition is idempotent and renewal advances the lease epoch.
4. An expired lease may be taken over with a hash-linked predecessor identity.
5. Release is owner-bound, idempotent, and cannot release a foreign lease.
6. Checkpoint advancement and terminal sealing require the current unexpired owner and epoch.
7. Stale, released, expired, malformed, and foreign leases fail closed without artifact mutation.
8. IndexedDB transactions preserve one current lease head per logical job across reopen.
9. Existing checkpoint recovery and terminal mirroring remain descriptive and legacy-authoritative.
10. Raw candles, workers, services, scheduling, retries, UI/operator migration, MT5,
    broker mutation, readiness changes, Paper Demo, production, and execution remain outside this slice.
11. Focused lease, complete BT3/BT2/ledger/time/typecheck/build/browser/hash/diff gates pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
shadowLeaseCoordinationAllowed: true
workerStartupAllowed: false
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false
```

No later slice or phase is authorized by this decision.
