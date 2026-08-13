# BT3 Phase 8 Operator Projections And Controls Acceptance Report

Date: 2026-08-12

Branch: `codex/gotrader-bt3-phase8-operator-controls`

Authorization: `f489ae3e33693f6276a7b5d80960ef0ee1715637`

Implementation candidate: `e00c22c2979be0bf38ebf3ad688449c98c288f21`

## Decision

```text
ACC-BT3-PHASE-8-OPERATOR-CONTROLS-SLICE
ACCEPTED FOR EXPLICIT BROWSER-LOCAL INSPECTION AND MANUAL COMMANDS

PHASE 8 REMAINS IN PROGRESS
```

## Accepted Evidence

- Node projection and command report:
  `sha256:fb946313e85a60c8bf0471f5dc6e02ca1c6eb739615eb8c344df7fdc6622eb52`.
- Browser IndexedDB report:
  `sha256:cdc9aee59de88cf084443e9060ffea742f0c1d9fc815b4c7632b35ae5beef291`.
- Operator snapshots canonically bind scheduler state, queue depth and resource
  pressure, lease ownership, cancellation and quarantine evidence, checkpoint
  progress, terminal identities, dispatch receipts, blockers, and freshness.
- Identical projection inputs reproduce the same identity; unavailable and stale
  evidence fail closed with explicit blockers.
- Commands canonically bind action, logical job, operator, expected lease, explicit
  timestamp, reason, confirmation, and authority boundary.
- Cancellation and stop require deterministic identity-bound confirmation tokens.
- Claim-before-execute persistence permits one concurrent-tab command execution;
  contenders observe in-progress state and completed retries coalesce to the same receipt.
- Command receipts are immutable, canonical, and preserve rejected blockers.
- A stale owner cancellation was rejected and quarantined while the current lease
  remained unchanged.
- Read-only IndexedDB enumeration exposes queue, dispatch, and quarantine evidence
  without modifying accepted records.
- Focused Node and browser tests, complete BT3 and BT2 suites, both authoritative
  ledgers, MT5 time contracts, strict typecheck, production build, syntax/diff,
  and sequential 44-test browser smoke passed.
- Production build emitted only the existing Rollup circular-export and chunk-size warnings.

## Boundary

This slice adds library contracts and IndexedDB persistence only. It adds no visible
operator UI, timer, worker, application-load hook, network call, MT5 contact,
strategy logic, runtime adoption, readiness change, Paper Demo, broker mutation,
production authority, or execution.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
manualOperatorCommandsAllowed: true
operatorUiAllowed: false
automaticSchedulerStartupAllowed: false
runtimeAdoptionAllowed: false

PHASE 8 FALLBACK/ROLLBACK SLICE UNAUTHORIZED
PHASE 9 UNAUTHORIZED
PHASE 10 UNAUTHORIZED
BT3A UNAUTHORIZED
BROKER GATEWAY UNAUTHORIZED
```
