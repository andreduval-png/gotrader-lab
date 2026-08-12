# BT3 Phase 8 Shadow Orchestration Slice Acceptance Report

Date: 2026-08-12

Parent Phase 7 completion: `e0b53ef31dcb783f7d223454153020750c15a712`

Authorization: `7b6b737e3ef25aefde93857abbbac76688b87433`

Implementation: `92d23bf6f9a8829816cf9e7e9bcbf6a8bd8eef74`

## Decision

```text
ACC-BT3-PHASE-8-SHADOW-ORCHESTRATION-SLICE
ACCEPTED

BT3 PHASE 8
REMAINS IN PROGRESS
```

The accepted slice adds pure deterministic contracts for an ordered shadow
research job, immutable stage artifacts, hash-bound checkpoints, bounded retry,
heartbeat progression, cancellation, exact resume, terminal sealing, and a
rebuildable compact operator projection. No current research-cycle or runtime
caller imports the engine.

Accepted identities:

- orchestration report file: `sha256:14ece299b293a6a1ebf89a0c8c5ff93c5b8d0efbe7f6977d2aecc001547b68cf`;
- deterministic fixture snapshot: `sha256:0863e3d56199db3ca33791df1e2ed44d4a198ef2c95b3d899e66aacb89a50389`;
- synthetic logical job: `sha256:a62fd29702c6aff8669badf3b4623f15f9805f41663b0770871db9417f274112`.

Results:

- completed, blocked, failed, cancelled, and skipped terminal paths passed;
- transient retry was bounded by preregistered stage policy and deterministic
  blockers did not retry;
- interruption after two stages and resume reproduced uninterrupted artifacts,
  checkpoint, terminal seal, and projection exactly;
- immutable duplicate writes coalesced and conflicting payloads failed closed;
- heartbeat regression and same-sequence conflict were rejected;
- tampered jobs, checkpoints, artifacts, authority, and stage chains failed
  identity or semantic validation before execution or sealing;
- compact payloads reject nested values, non-finite numbers, and sensitive or
  mutable trading fields;
- fixtures serialized no raw candles and made no network or MT5 contact;
- authority remained `none/none/none`.

Complete BT3 and BT2 suites, both authoritative ledgers, MT5 time contracts,
typecheck, production build, syntax, hash, and diff checks passed. Browser smoke
passed all 44 tests. Existing non-failing Rollup circular-chunk and chunk-size
warnings remain unchanged.

## Remaining Phase 8 Boundary

This acceptance does not authorize a durable repository, real stage adapters,
leases, service processes, runtime scheduling, migration of `runResearchCycle`
or Auto Research, UI adoption, or operator control of the shadow engine. The
current browser research cycle, runtime scheduler, B1 services, existing
ledgers, and their projections remain authoritative.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
currentResearchCycleAuthoritative: true
shadowOrchestrationOnly: true
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false

PHASE 8 NEXT SLICE UNAUTHORIZED
PHASE 9 UNAUTHORIZED
PHASE 10 UNAUTHORIZED
BT3A UNAUTHORIZED
BROKER GATEWAY UNAUTHORIZED
```
