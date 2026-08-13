# BT3 Phase 8 Fallback And Rollback Acceptance Record

Date: 2026-08-13

Freeze-governance parent: `2d005591215e4280d8d5fd7813a2ed30b8ee9c88`

Authorization: `1a5ef0474450d8d55e3708ecc2436b6a4999237a`

Implementation: `c94f3c0154b13f8ab79d3a2ea749d7012ea4ba4c`

Compatibility correction: `7a9ec50a7c92e9c65340bb1b053c8ffba05dd5a2`

Acceptance: `249631e36fde497892b42242b03c0edbbd86a290`

## Decision

```text
ACC-BT3-PHASE-8-FALLBACK-ROLLBACK-SLICE
ACCEPTED FOR EXPLICIT BROWSER-LOCAL SHADOW HEAD RECOVERY

PHASE 8 REMAINS IN PROGRESS
```

Accepted evidence:

- Node report `sha256:d91a90fce239a926d3cb0a842650b67c9e47c463df0f025e4d5322845dda68f6`;
- browser report `sha256:54b235f79173f8edf89acbd58dd561be000857d4cc6ba5503013e83ee7503fb4`;
- deterministic bounded previews, exact confirmation, atomic expected-head and
  owner-lease compare-and-set, concurrent coalescing, reopen idempotence, immutable
  receipts, stale-owner quarantine, and evidence preservation passed;
- schema-v4 compatibility corrections removed hard-coded version 3 from three
  legacy browser harnesses;
- complete BT3/BT2, ledger, time, typecheck, build, syntax/diff, and sequential
  44-test browser smoke passed from clean `7a9ec50`;
- the acceptance report preserves all harness and first full-matrix failures;
- no raw candles, evidence deletion, automatic rollback, UI, timer, worker, MT5,
  runtime adoption, Paper Demo, production authority, broker mutation, readiness
  change, or execution occurred.

The Phase 8 multi-hour operational canary and freeze remain separately gated.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
manualRollbackAllowed: true
automaticRollbackAllowed: false
evidenceDeletionAllowed: false
runtimeAdoptionAllowed: false

PHASE 8 NEXT SLICE UNAUTHORIZED
PHASE 9 UNAUTHORIZED
BT3A UNAUTHORIZED
BROKER GATEWAY UNAUTHORIZED
```
