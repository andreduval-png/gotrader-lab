# BT3 Phase 8 Operational Canary Cadence Correction Authorization

Date: 2026-08-13

Branch: `codex/gotrader-bt3-phase8-operational-canary`

Canary authorization: `0d015e85c7128f465e4741d16e0fbff3c813fe26`

Integrity correction: `64c76e95e7816cb9be7333d3d19806cd80a116c4`

## Decision

```text
AUTH-BT3-PHASE-8-CANARY-CADENCE-CORRECTION
APPROVED FOR FIXED-DEADLINE SAMPLE SCHEDULING AND REVALIDATION ONLY
```

The blocked replacement run
`sha256:baefc6ce7d8484042b18a814c9e3bebaeafaf48166910cb03192244c2b13a543`
must remain immutable. It completed more than four real wall and monotonic hours with
zero unexpected failures, but produced only 40 of 48 required samples because the
five-minute delay began after each sample workload completed.

The correction must schedule each sample against a fixed monotonic deadline so
sample work does not accumulate cadence drift. It must preserve the four-hour
minimum, 48-sample minimum, checkpoint integrity, resource limits, authority,
external-contact boundaries, and all accepted Phase 8 behavior. Focused tests must
prove the schedule remains bounded, does not busy-loop, handles overruns safely,
and reaches 48 samples within four hours when individual sample work is bounded.

Exactly one new four-hour observer may start only after focused and complete
validation passes from a clean correction commit. No failed evidence may be edited
or deleted.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
externalContactAllowed: false
runtimeAdoptionAllowed: false
replacementCanaryAllowedAfterValidation: true
```

Phase 8 acceptance, Phase 8 freeze, and every later phase remain unauthorized.
