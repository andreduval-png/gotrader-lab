# BT3 Phase 8 Research-Cycle Shadow Adapter Authorization

Date: 2026-08-12

Branch: `codex/gotrader-bt3-phase8-cycle-adapter`

Parent shadow-repository acceptance: `b08e86300b05b1d9c982888f3e2da4c1ff97b002`

## Decision

```text
AUTH-BT3-PHASE-8-RESEARCH-CYCLE-SHADOW-ADAPTER-SLICE
APPROVED FOR ISOLATED SHADOW IMPLEMENTATION
```

This third Phase 8 slice may add a pure one-way adapter from an already compacted,
terminal legacy `ResearchCycleRun` into the accepted shadow orchestration job and
stage contracts. It may add a canonical parity assessment covering ordered step
membership, status mapping, blockers/warnings, source identity, terminal status,
and compact projection identity.

The adapter must not invoke `runResearchCycle`, Auto Research, strategy logic,
backtests, validation, readiness, LLMs, communications, MT5, or storage. It may
consume only synthetic compact fixtures shaped like terminal legacy runs. The
legacy run remains authoritative and its bytes must remain unchanged.

Automatic mirroring, IndexedDB writes from legacy callers, real stage adapters,
leases, workers/services, runtime adoption, UI migration, and the remaining
Phase 8 work remain separately gated.

## Acceptance Gate

1. The eleven current legacy step IDs map once, in exact stable order.
2. Legacy passed/completed, warning, failed, and skipped states map explicitly.
3. Idle/running runs and pending/running steps fail closed.
4. Failed and canceled terminal semantics cannot become completed.
5. Stable legacy cycle/source identities are required and hash-bound.
6. Summaries are compact and sensitive/raw fields are excluded.
7. Adapter output is byte stable and input-order mutation fails parity.
8. Legacy input bytes are unchanged after adaptation.
9. Shadow projection and parity assessment reproduce exactly.
10. Complete BT3/BT2/ledger/time/typecheck/build/browser/diff gates pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
automaticMirroringAllowed: false
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false
```

No later slice or phase is authorized by this decision.
