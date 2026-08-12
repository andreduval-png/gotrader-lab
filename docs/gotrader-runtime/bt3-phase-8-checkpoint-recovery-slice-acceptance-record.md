# BT3 Phase 8 Intermediate Checkpoint Recovery Acceptance Record

Date: 2026-08-12

Freeze-governance parent: `a43176f3ec7b7ad2f4fdebf6696fe8270a3d2e56`

Authorization: `97db2c49b23ba31bbcb4ea8f82eae50f07f395c7`

Implementation: `1e060c7fde87242cddd4c9ba199c8f6b0a768d7b`

## Decision

```text
ACC-BT3-PHASE-8-INTERMEDIATE-CHECKPOINT-RECOVERY-SLICE
ACCEPTED FOR BROWSER-LOCAL DESCRIPTIVE RECOVERY ONLY

PHASE 8 REMAINS IN PROGRESS
```

The authoritative legacy caller may now persist stable completed-step prefixes
to a separate shadow observation job. Recovery may describe the latest validated
prefix but may not execute or resume research work.

Acceptance evidence:

- implementation `1e060c7fde87242cddd4c9ba199c8f6b0a768d7b`;
- report `sha256:fc3e42914eaf153264b5ccdf061d817c4ef3bad617b700bc696dbc8880960e9c`;
- recovery descriptor `sha256:b7d79fb8709c8340472d2fc9c175212a58ab47c4926de5057b49fd531781313a`;
- observation job `sha256:abfbf99743f5c077b40e6b46f5c1357baf19dd86c6a981eb99f836de04c6dc0e`;
- latest checkpoint `sha256:4ceebc36492432e45ad1e3f765afaf626228079776c1fcc52af07f144b4df95a`;
- complete regression/build and 44-test browser smoke passed;
- no raw candles, MT5, broker mutation, execution, or authority changed.

The legacy research cycle remains authoritative. Execution recovery, stage
invocation, retry/lease workers, runtime scheduling, UI migration, and operator
control remain separately gated.

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
