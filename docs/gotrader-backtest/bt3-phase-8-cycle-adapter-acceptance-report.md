# BT3 Phase 8 Research-Cycle Shadow Adapter Acceptance Report

Date: 2026-08-12

Parent shadow-repository acceptance: `b08e86300b05b1d9c982888f3e2da4c1ff97b002`

Authorization: `0e02ad7112d90fbebaec9d82f6fd212b99f7adaf`

Implementation: `e4eb8bc4ceb425ee6529d523ee5abe20063457d0`

## Decision

```text
ACC-BT3-PHASE-8-RESEARCH-CYCLE-SHADOW-ADAPTER-SLICE
ACCEPTED

BT3 PHASE 8
REMAINS IN PROGRESS
```

The accepted slice adds a pure one-way adapter from an already compacted,
terminal legacy `ResearchCycleRun` into the accepted shadow orchestration
contracts. It emits a canonical parity assessment but does not invoke, persist,
mirror, or replace the legacy cycle.

Accepted identities:

- adapter report: `sha256:f1ea0d4191281d1439a8bb6874f34ee0e380ee8953c4eb767eea90b07dea7006`;
- deterministic snapshot: `sha256:ada6e15f6fb90214df31902952c0ddc92b1282a3fe08e6fd6eea70e763064170`;
- completed parity: `sha256:3757e1bdeb68ddbfc8353e2b7f7c6151a17618850c177e35dcf98e4037832286`;
- warning/skip parity: `sha256:300a0c267b68cdd306306570254e70d24e51f6d13edae2e91ae5a49df21c9e78`;
- failed parity: `sha256:c6d58e9de45d2f32586f9256965a8602ebbbf9bc9591a3a64b544dbcc743b447`;
- canceled parity: `sha256:06d3b25450aca1110edbbd27772a1aa147f846956c8c4eb8afda6af7eeb3fece`.

Results:

- all eleven current legacy step IDs mapped once in exact stable order;
- passed/completed, warning, failed, skipped, and canceled semantics mapped
  explicitly without retrying legacy work;
- source identity and cycle/promotion blocker-set identities are hash-bound;
- running, pending, reordered, inconsistent failure, and unsafe-authority inputs
  failed closed;
- legacy input bytes remained unchanged after adaptation;
- adaptation and parity assessment reproduced byte-stable identities;
- no raw candles, storage writes, legacy mutation, runtime integration, MT5
  contact, readiness change, broker mutation, or execution occurred;
- authority remained `none/none/none`.

Complete BT3 and BT2 suites, both authoritative ledgers, MT5 time contracts,
typecheck, production build, syntax, hash, and diff checks passed. Browser smoke
passed all 44 tests. Existing non-failing Rollup warnings remain unchanged.

## Remaining Phase 8 Boundary

Automatic shadow mirroring, persistence from legacy callers, real stage
execution adapters, leases, services/workers, runtime scheduling, UI adoption,
and operator controls remain unauthorized. The legacy research cycle remains
authoritative.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
automaticMirroringAllowed: false
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false

PHASE 8 NEXT SLICE UNAUTHORIZED
PHASE 9 UNAUTHORIZED
PHASE 10 UNAUTHORIZED
BT3A UNAUTHORIZED
BROKER GATEWAY UNAUTHORIZED
```
