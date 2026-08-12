# BT3 Phase 8 Terminal Shadow Mirroring Authorization

Date: 2026-08-12

Branch: `codex/gotrader-bt3-phase8-terminal-shadow-mirroring`

Parent adapter acceptance: `d74bfb02e429d72c45a987f2a0a5178916f7a140`

## Decision

```text
AUTH-BT3-PHASE-8-TERMINAL-SHADOW-MIRRORING-SLICE
APPROVED FOR BROWSER-LOCAL TERMINAL MIRRORING ONLY
```

This Phase 8 slice may automatically adapt and persist a compact terminal
`ResearchCycleRun` after the authoritative legacy save completes. The mirror
must use the accepted adapter and shadow repository without invoking or
replacing any legacy research stage.

## Acceptance Gate

1. Only terminal compact runs may be mirrored.
2. The authoritative legacy save occurs before mirroring is attempted.
3. Mirror failure cannot change the legacy result, status, bytes, or return.
4. Repeating the same terminal run is idempotent and reproduces one job head.
5. A compact immutable receipt binds cycle, source, job, seal, projection, and parity identities.
6. Persisted evidence reloads and validates before a receipt is accepted.
7. IndexedDB absence and persistence failure fail isolated and observable.
8. Intermediate updates, raw candles, strategy work, retries, workers, scheduling, UI, MT5, broker mutation, and execution remain outside this slice.
9. Complete BT3/BT2/ledger/time/typecheck/build/browser/diff gates pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
terminalShadowMirroringAllowed: true
runtimeAdoptionAllowed: false
operatorMigrationAllowed: false
```

No later slice or phase is authorized by this decision.
