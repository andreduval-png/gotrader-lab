# BT3 Phase 8 Intermediate Checkpoint Recovery Authorization

Date: 2026-08-12

Branch: `codex/gotrader-bt3-phase8-checkpoint-recovery`

Parent terminal-mirroring acceptance: `a2bf27dca46eb8cc68dc10428bc5af1c71a6e0e6`

## Decision

```text
AUTH-BT3-PHASE-8-INTERMEDIATE-CHECKPOINT-RECOVERY-SLICE
APPROVED FOR BROWSER-LOCAL OBSERVATION ONLY
```

This Phase 8 slice may mirror the contiguous completed prefix of a compact,
running legacy `ResearchCycleRun` into a separate browser-local shadow
observation job. It may reload and validate that prefix as recovery metadata.

## Acceptance Gate

1. Observation identity is stable for one legacy cycle and source identity.
2. Only contiguous terminal step results before the active/pending suffix are persisted.
3. Starts, candidate progress, duplicate updates, and unchanged prefixes coalesce.
4. Per-cycle writes are serialized so delayed IndexedDB work cannot regress the head.
5. Recovery validates job, checkpoint, stage chain, source identity, and authority.
6. Recovery is descriptive only and cannot invoke, resume, skip, or replace legacy work.
7. Terminal mirroring remains the accepted separate terminal evidence path.
8. Adapter/repository failure cannot alter observer behavior or legacy run bytes.
9. Raw candles, retries, leases, workers, scheduling, UI/operator migration, MT5,
   broker mutation, readiness changes, and execution remain outside this slice.
10. Complete BT3/BT2/ledger/time/typecheck/build/browser/diff gates pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
intermediateCheckpointObservationAllowed: true
recoveryExecutionAllowed: false
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false
```

No later slice or phase is authorized by this decision.
