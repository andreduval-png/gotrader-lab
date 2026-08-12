# BT3 Phase 8 Shadow Orchestration Authorization

Date: 2026-08-12

Branch: `codex/gotrader-bt3-phase8-shadow-orchestration`

Parent Phase 7 completion: `e0b53ef31dcb783f7d223454153020750c15a712`

## Decision

```text
AUTH-BT3-PHASE-8-SHADOW-ORCHESTRATION-SLICE
APPROVED FOR ISOLATED SHADOW IMPLEMENTATION
```

This first Phase 8 slice may add pure, deterministic research-job orchestration
contracts for ordered stage plans, immutable stage artifacts, canonical
checkpoints, bounded retry, heartbeat state, cancellation, resume, terminal
sealing, and rebuildable compact operator projections.

The implementation must run only against synthetic compact fixture handlers.
The existing browser `runResearchCycle`, Auto Research checkpointing, runtime
scheduler, B1 services, UI readers, artifact ledgers, and all current consumers
remain authoritative and unchanged. No production caller may import or invoke
the new engine in this slice.

Stage artifacts must hash-bind logical job identity, stage/version, attempt,
ordered immutable inputs, previous stage identity, status, compact allowlisted
output, stable blockers/warnings, retry policy, and authority. Checkpoints must
hash-bind ordered completed artifacts, next stage ordinal, heartbeat sequence,
cancellation state, and terminal state. Resume must reproduce uninterrupted
terminal identities exactly. Same identity/same payload coalesces; same identity
with different payload fails closed.

The slice may not run strategy logic, read raw candles, estimate statistics,
write accepted evidence/prediction artifacts, alter research-cycle storage,
adopt runtime scheduling, change UI projections, contact MT5, alter readiness,
enable Paper Demo, mutate broker state, place an order, or execute. Real stage
adapters, durable repository integration, leases, service processes, runtime
adoption, operator migration, the rest of Phase 8, Phase 9, Phase 10, BT3A, and
broker gateway work remain separately gated.

## Acceptance Gate

1. Job, stage artifact, checkpoint, terminal seal, and projection schemas are
   canonical-hash versioned and authority `none/none/none`.
2. Ordered stage registration is unique, deterministic, and immutable.
3. Completed, blocked, failed, cancelled, and skipped semantics are exact.
4. Deterministic blockers do not retry; transient failures retry only within the
   preregistered stage bound.
5. Cancellation observed before seal prevents later stages and terminal success.
6. Interrupted and resumed execution exactly matches uninterrupted stage, seal,
   checkpoint, and projection identities.
7. Duplicate job execution coalesces idempotently; payload conflict fails closed.
8. Heartbeat sequence is monotone and included in each checkpoint identity.
9. Projection is compact, rebuildable from sealed artifacts, and excludes raw
   candles, secrets, account/order/position state, and mutable commands.
10. Complete BT3/BT2/ledger/time/typecheck/build/browser/syntax/hash/diff gates
    pass with no runtime integration or authority change.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
currentResearchCycleAuthoritative: true
shadowOrchestrationOnly: true
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false
```

No later slice or phase is authorized by this decision.
