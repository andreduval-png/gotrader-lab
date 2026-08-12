# BT3 Phase 8 Shadow Repository Authorization

Date: 2026-08-12

Branch: `codex/gotrader-bt3-phase8-shadow-repository`

Parent shadow-orchestration acceptance: `0753c5319f80846a3cdd3968ec9d42e9a5fd8473`

## Decision

```text
AUTH-BT3-PHASE-8-SHADOW-REPOSITORY-SLICE
APPROVED FOR ISOLATED SHADOW IMPLEMENTATION
```

This second Phase 8 slice may add an IndexedDB-backed repository for the already
accepted shadow job, stage artifact, checkpoint, terminal seal, and compact
operator-projection contracts. It may add atomic immutable writes, idempotent
coalescing, payload-conflict rejection, latest-checkpoint recovery, terminal
chain reads, and deterministic projection rebuilding from validated sealed
artifacts.

Only synthetic compact fixtures may use the repository. The in-memory engine
remains usable for pure fixtures. The existing browser `runResearchCycle`, Auto
Research, runtime scheduler, B1 services, UI readers, and current ledgers remain
authoritative and unchanged. No production caller may import the repository.

The repository may not persist raw candles, secrets, account/order/position
state, mutable commands, strategy output, accepted evidence, or prediction
artifacts. Real stage adapters, leases, workers/services, runtime adoption,
operator migration, and the remaining Phase 8 work remain separately gated.

## Acceptance Gate

1. Database and object-store versions are explicit and additive.
2. Every write validates canonical identity and `none/none/none` authority.
3. Same identity/same payload coalesces; different payload fails closed.
4. A job write with artifacts/checkpoint/seal/projection is atomic.
5. Checkpoint heartbeat is monotone and same-sequence conflict fails closed.
6. Latest valid checkpoint and full ordered terminal chain recover after reopen.
7. Projection rebuilding exactly reproduces the stored validated projection.
8. Tampered, foreign-job, missing-stage, and broken-chain records fail closed.
9. Synthetic browser IndexedDB fixtures pass upgrade/reopen/rollback tests.
10. Complete BT3/BT2/ledger/time/typecheck/build/browser/diff gates pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
currentResearchCycleAuthoritative: true
shadowRepositoryOnly: true
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false
```

No later slice or phase is authorized by this decision.
