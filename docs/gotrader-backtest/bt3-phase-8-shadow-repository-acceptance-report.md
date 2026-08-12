# BT3 Phase 8 Shadow Repository Slice Acceptance Report

Date: 2026-08-12

Parent orchestration acceptance: `0753c5319f80846a3cdd3968ec9d42e9a5fd8473`

Authorization: `fd9c4d3476ccc3fcfae8d9990ed950e9f4a24913`

Implementation: `e3f8edc4d219e557c2be7f9be9f055475135da42`

## Decision

```text
ACC-BT3-PHASE-8-SHADOW-REPOSITORY-SLICE
ACCEPTED

BT3 PHASE 8
REMAINS IN PROGRESS
```

The accepted slice adds an isolated IndexedDB repository for validated shadow
jobs, immutable stage artifacts, checkpoints, terminal seals, and compact
operator projections. A per-job head advances monotonically in the same atomic
transaction as immutable evidence writes.

Accepted identities:

- repository browser report: `sha256:8660d40a9a63ed425d959371c50054a78555f8d7f77efd84575cc8df84355c60`;
- orchestration report: `sha256:14ece299b293a6a1ebf89a0c8c5ff93c5b8d0efbe7f6977d2aecc001547b68cf`;
- deterministic fixture snapshot: `sha256:0863e3d56199db3ca33791df1e2ed44d4a198ef2c95b3d899e66aacb89a50389`;
- synthetic logical job: `sha256:a62fd29702c6aff8669badf3b4623f15f9805f41663b0770871db9417f274112`.

Results:

- six explicit versioned stores were created in a separate database;
- interrupted state advanced atomically to terminal state and reopened exactly;
- same identity/same payload coalesced and immutable payload conflict failed;
- heartbeat regression and same-sequence conflict remain fail closed;
- terminal projection rebuilt exactly from the sealed validated artifact chain;
- interrupted-chain tampering and missing stored artifacts failed closed;
- rollback removed all job-owned jobs, stages, checkpoints, seals, projections,
  and head records;
- no current caller imports the repository, no legacy database changed, no raw
  candles were serialized, no MT5 contact occurred, and authority remained
  `none/none/none`.

Complete BT3 and BT2 suites, both authoritative ledgers, MT5 time contracts,
typecheck, production build, syntax, hash, and diff checks passed. Browser smoke
passed all 44 tests. Existing non-failing Rollup warnings remain unchanged.

## Remaining Phase 8 Boundary

Real stage adapters, leases, workers/services, current research-cycle or Auto
Research migration, runtime scheduling, UI adoption, and operator controls are
not authorized. The existing research cycle, runtime scheduler, B1 services,
ledgers, and UI projections remain authoritative.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
currentResearchCycleAuthoritative: true
shadowRepositoryOnly: true
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false

PHASE 8 NEXT SLICE UNAUTHORIZED
PHASE 9 UNAUTHORIZED
PHASE 10 UNAUTHORIZED
BT3A UNAUTHORIZED
BROKER GATEWAY UNAUTHORIZED
```
