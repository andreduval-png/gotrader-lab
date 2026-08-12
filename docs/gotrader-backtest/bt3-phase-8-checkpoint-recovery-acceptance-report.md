# BT3 Phase 8 Intermediate Checkpoint Recovery Acceptance Report

Date: 2026-08-12

Parent terminal-mirroring acceptance: `a2bf27dca46eb8cc68dc10428bc5af1c71a6e0e6`

Authorization: `97db2c49b23ba31bbcb4ea8f82eae50f07f395c7`

Implementation: `1e060c7fde87242cddd4c9ba199c8f6b0a768d7b`

## Decision

```text
ACC-BT3-PHASE-8-INTERMEDIATE-CHECKPOINT-RECOVERY-SLICE
ACCEPTED FOR DESCRIPTIVE RECOVERY ONLY

BT3 PHASE 8
REMAINS IN PROGRESS
```

Stable completed-step prefixes from a running legacy research cycle are now
mirrored into a separate browser-local observation job. Per-cycle serialization
prevents delayed writes from regressing the head, and reload produces a
validated non-executable recovery descriptor.

Accepted identities:

- implementation report: `sha256:fc3e42914eaf153264b5ccdf061d817c4ef3bad617b700bc696dbc8880960e9c`;
- recovery descriptor: `sha256:b7d79fb8709c8340472d2fc9c175212a58ab47c4926de5057b49fd531781313a`;
- observation job: `sha256:abfbf99743f5c077b40e6b46f5c1357baf19dd86c6a981eb99f836de04c6dc0e`;
- latest checkpoint: `sha256:4ceebc36492432e45ad1e3f765afaf626228079776c1fcc52af07f144b4df95a`;
- descriptor report identity: `sha256:f0816cdcaeebc7ccca9c18abff29ca1eb09fd7ec5cf0936ca7033cd51a0a25fd`.

Results:

- rapid one-stage then three-stage updates persisted in call order;
- duplicate completed prefixes coalesced without another job head;
- recovery reloaded and validated exact job, checkpoint, chain, source, and authority identities;
- non-contiguous completed prefixes failed closed;
- starts, candidate/scenario progress, failed/skipped suffixes, and terminal runs do not enter this path;
- provisional legacy summaries cannot rewrite already observed stage artifacts;
- terminal mirroring remains a separate accepted evidence path;
- recovery cannot invoke, resume, skip, retry, or replace legacy work;
- no raw candles, leases, workers, scheduling, UI migration, MT5 contact,
  broker mutation, readiness change, or execution occurred;
- authority remained `none/none/none`.

Complete BT3 and BT2 suites, both authoritative ledgers, MT5 time contracts,
typecheck, production build, syntax, hash, and diff checks passed. Browser smoke
passed all 44 tests. Existing non-failing Rollup warnings remain unchanged.

## Remaining Phase 8 Boundary

Execution recovery, stage invocation, retries, leases, workers/services,
runtime scheduling, UI/operator migration, and replacement of the legacy cycle
remain unauthorized.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
intermediateCheckpointObservationAllowed: true
recoveryExecutionAllowed: false
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false

PHASE 8 NEXT SLICE UNAUTHORIZED
PHASE 9 UNAUTHORIZED
PHASE 10 UNAUTHORIZED
BT3A UNAUTHORIZED
BROKER GATEWAY UNAUTHORIZED
```
