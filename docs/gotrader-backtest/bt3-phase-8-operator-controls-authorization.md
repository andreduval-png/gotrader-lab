# BT3 Phase 8 Operator Projections And Controls Authorization

Date: 2026-08-12

Branch: `codex/gotrader-bt3-phase8-operator-controls`

Parent scheduler-controls acceptance: `2f55baff3447eeda9020a7bb7ed3be5af056ea11`

## Decision

```text
AUTH-BT3-PHASE-8-OPERATOR-CONTROLS-SLICE
APPROVED FOR EXPLICIT BROWSER-LOCAL INSPECTION AND MANUAL COMMANDS ONLY
```

This slice may add deterministic read-only operator projections and explicit,
one-shot browser-local commands over the accepted scheduler, lease,
cancellation, quarantine, checkpoint, seal, projection, and dispatch evidence.
It may not add automatic startup, recurring execution, or production adoption.

## Acceptance Gate

1. Operator snapshots deterministically identify scheduler state, queue and resource
   pressure, active lease ownership, cancellation and quarantine state, checkpoint
   progress, terminal evidence, dispatch receipts, blockers, and evidence freshness.
2. Empty, partial, stale, and invalid evidence fail closed without invented status.
3. Manual tick, pause, resume, stop, cancellation request, and inspection require an
   explicit command carrying operator, logical-job, expected-owner, and time identity.
4. Commands are hash-identified, immutable, audit-receipted, and idempotent across
   retries and concurrent browser tabs.
5. Stop or cancellation that can discard pending work requires an identity-bound
   confirmation token.
6. Stale, foreign, released, or superseded lease owners cannot cancel or commit work;
   their rejected command remains visible as quarantine or blocker evidence.
7. Manual tick cannot bypass scheduler admission, lease, cancellation, quarantine,
   host concurrency, stage, retry, or resource guards.
8. Inspection never mutates scheduler or orchestration state.
9. No application UI, interval, timeout, worker constructor, application-load hook,
   network contact, MT5 integration, strategy logic, Paper Demo, production adoption,
   readiness change, broker mutation, or execution is added.
10. Focused Node and browser IndexedDB tests cover deterministic projections, stale
    labels, command validation and idempotence, owner-bound cancellation, concurrent
    tab contention, audit receipts, and safe empty/error states.
11. Complete BT3, BT2, authoritative-ledger, time-contract, strict typecheck,
    production build, browser smoke, syntax, hash, and diff gates pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
legacyResearchCycleAuthoritative: true
manualOperatorCommandsAllowed: true
operatorUiAllowed: false
automaticSchedulerStartupAllowed: false
runtimeAdoptionAllowed: false
```

No fallback/rollback slice or later phase is authorized by this decision.
