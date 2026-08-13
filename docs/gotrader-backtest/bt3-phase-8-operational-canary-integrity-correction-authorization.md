# BT3 Phase 8 Operational Canary Integrity Correction Authorization

Date: 2026-08-13

Branch: `codex/gotrader-bt3-phase8-operational-canary`

Canary authorization: `0d015e85c7128f465e4741d16e0fbff3c813fe26`

Harness implementation: `b0cfb5dcee306eca63230b41f73dc8057ada76af`

## Decision

```text
AUTH-BT3-PHASE-8-CANARY-INTEGRITY-CORRECTION
APPROVED FOR CHECKPOINT HASH-CORE CORRECTION AND REVALIDATION ONLY
```

The failed run `sha256:743c7047824e2c4e690e88fa794d18feaae4cebbe58a5526dfeec243d5251e90`
must remain immutable. Its second checkpoint demonstrated that mutable observer state
retained a prior `integrityHash`; spreading that state into the next hash core made
the serialized checkpoint differ from the hashed checkpoint.

The correction must construct every checkpoint from an explicit field allowlist,
exclude all prior sealing metadata, and independently validate consecutive,
round-tripped, browser-restart, resumed, and final-report evidence. It may not alter
elapsed-time gates, resource limits, authority, external-contact boundaries, or any
accepted Phase 8 behavior.

Exactly one replacement four-hour observer may start only after focused and complete
validation passes from a new clean correction commit. No failed evidence may be
edited or deleted.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
externalContactAllowed: false
runtimeAdoptionAllowed: false
replacementCanaryAllowedAfterValidation: true
```

Phase 8 acceptance, Phase 8 freeze, and every later phase remain unauthorized.
