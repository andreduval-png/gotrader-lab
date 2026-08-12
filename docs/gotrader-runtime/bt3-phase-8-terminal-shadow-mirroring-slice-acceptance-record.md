# BT3 Phase 8 Terminal Shadow Mirroring Acceptance Record

Date: 2026-08-12

Freeze-governance parent: `e5405b4d3cafc3e06e07a3e1ae6638ecc0f787ed`

Authorization: `a2e040ac2f4cd3dac05a537ca72b36c0dd39212f`

Implementation: `5c33e0da98ec74a542396070404c49fb1ae529e6`

## Decision

```text
ACC-BT3-PHASE-8-TERMINAL-SHADOW-MIRRORING-SLICE
ACCEPTED FOR BROWSER-LOCAL TERMINAL MIRRORING ONLY

PHASE 8 REMAINS IN PROGRESS
```

The authoritative legacy caller may now persist deterministic shadow evidence
for compact terminal research-cycle results after its legacy save. Persistence
failure remains isolated and observable, and repeated mirrors produce one job
head and one immutable receipt.

Acceptance evidence:

- implementation `5c33e0da98ec74a542396070404c49fb1ae529e6`;
- report `sha256:25cc474150535de1ffd8b383437f92dd5b5667f00c3c496652b5a353d8441395`;
- receipt `sha256:6ab2dd1a00f574c73a2395bb8553678361d4b1dfd6a6d26608ba4d1630a48b0c`;
- terminal seal `sha256:508f51e2c317e75ee0cc95ae78240ee08a6ca8148ac0ef8eb000d418f10240b8`;
- projection `sha256:e88919e77f50d310c4738cf6adba77e22842a81536111286f86abd5d44a23421`;
- complete regression/build and sequential 44-test browser smoke passed;
- no raw candles, MT5, broker mutation, execution, or authority changed.

The legacy research cycle remains authoritative. Intermediate mirroring,
shadow execution, leases, workers/services, runtime scheduling, UI migration,
and operator control remain separately gated.

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
