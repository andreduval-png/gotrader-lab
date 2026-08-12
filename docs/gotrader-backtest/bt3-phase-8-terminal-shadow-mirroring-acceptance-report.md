# BT3 Phase 8 Terminal Shadow Mirroring Acceptance Report

Date: 2026-08-12

Parent adapter acceptance: `d74bfb02e429d72c45a987f2a0a5178916f7a140`

Authorization: `a2e040ac2f4cd3dac05a537ca72b36c0dd39212f`

Implementation: `5c33e0da98ec74a542396070404c49fb1ae529e6`

## Decision

```text
ACC-BT3-PHASE-8-TERMINAL-SHADOW-MIRRORING-SLICE
ACCEPTED

BT3 PHASE 8
REMAINS IN PROGRESS
```

The authoritative legacy research-cycle caller now mirrors compact terminal
results into the accepted browser-local shadow repository after the legacy save
has completed. The mirror is idempotent, reload-validated, observable, and
failure-isolated from the legacy result.

Accepted identities:

- implementation report: `sha256:25cc474150535de1ffd8b383437f92dd5b5667f00c3c496652b5a353d8441395`;
- immutable mirror receipt: `sha256:6ab2dd1a00f574c73a2395bb8553678361d4b1dfd6a6d26608ba4d1630a48b0c`;
- logical shadow job: `sha256:68621eb0bdd1e4393d396ce2907c2f3c5f433984eb563ec0f887c2c274ff0e74`;
- terminal seal: `sha256:508f51e2c317e75ee0cc95ae78240ee08a6ca8148ac0ef8eb000d418f10240b8`;
- compact projection: `sha256:e88919e77f50d310c4738cf6adba77e22842a81536111286f86abd5d44a23421`;
- parity assessment: `sha256:3757e1bdeb68ddbfc8353e2b7f7c6151a17618850c177e35dcf98e4037832286`.

Results:

- all eight terminal legacy return paths save first and mirror second;
- repeated mirroring reproduces the same receipt and one persisted job head;
- persisted jobs, artifacts, checkpoint, seal, and projection reload and reproduce;
- invalid authority and invalid terminal shapes report failure without changing legacy bytes;
- browser events expose mirrored, unchanged, and failed outcomes without UI adoption;
- no raw candles, intermediate updates, strategy work, retry worker, scheduler,
  MT5 contact, broker mutation, readiness change, or execution occurred;
- authority remained `none/none/none`.

Complete BT3 and BT2 suites, both authoritative ledgers, MT5 time contracts,
typecheck, production build, syntax, hash, and diff checks passed. Browser smoke
passed all 44 tests. One initial smoke invocation started concurrently with the
build and failed because `dist/index.html` did not yet exist; the sequential
rerun against the completed build passed 44/44. Existing non-failing Rollup
warnings remain unchanged.

## Remaining Phase 8 Boundary

Mirroring terminal compact outcomes does not authorize shadow execution,
intermediate checkpoints from legacy callers, retry workers, leases, services,
runtime scheduling, UI/operator migration, or replacement of the legacy cycle.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
terminalShadowMirroringAllowed: true
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false

PHASE 8 NEXT SLICE UNAUTHORIZED
PHASE 9 UNAUTHORIZED
PHASE 10 UNAUTHORIZED
BT3A UNAUTHORIZED
BROKER GATEWAY UNAUTHORIZED
```
