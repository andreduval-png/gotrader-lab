# BT3 Phase 8 Operational Canary Acceptance Report

Date: 2026-08-13

Branch: `codex/gotrader-bt3-phase8-operational-canary`

Authorization: `0d015e85c7128f465e4741d16e0fbff3c813fe26`

Harness implementation: `b0cfb5dcee306eca63230b41f73dc8057ada76af`

Integrity correction authorization: `9b668d8c7213776498d90a7086338918e5816c70`

Integrity correction: `64c76e95e7816cb9be7333d3d19806cd80a116c4`

Cadence correction authorization: `66c22c5203ad268efde51cfd041bc19dc6b62f04`

Cadence correction: `30b349865996317fdd6f12506543d39f2789bde9`

## Decision

```text
ACC-BT3-PHASE-8-OPERATIONAL-CANARY
ACCEPTED FOR FOUR-HOUR BROWSER-LOCAL SHADOW ORCHESTRATION CONTINUITY

PHASE 8 REMAINS IN PROGRESS PENDING FREEZE
```

## Accepted Evidence

- Run ID: `sha256:c7697e9759aae1304ad493cd14da60e75a206c7aaa98569268ae77019af43c91`.
- Config ID: `sha256:edcf8cec70802890e0cb16ffd0dd7e9c7ed8239124a08d0af99552da678ee1d7`.
- Final checkpoint: `sha256:41181c1c2a9456647ee2f081877ffe30fa85beacc4d703e21beb3a02dd38de65`.
- Final report: `sha256:879bfce557767b5c721b0fef51edbd74d80d61228e7ca8ecf225c169eceb427c`.
- The final checkpoint and report independently passed canonical hash validation and
  exact report-to-checkpoint binding.
- Real wall elapsed time was 14,400,493 ms and monotonic elapsed time was
  14,400,074 ms. Sequence 49 exceeded the required 48 samples.
- Controlled cancellation and browser restart were observed.
- Orchestration, checkpoint recovery, lease, cancellation, quarantine, bounded
  host, scheduler, operator, and rollback contracts were all exercised.
- Zero unexpected failures, blockers, authority violations, external contacts, or
  runtime adoption were observed.
- Peak RSS was 219,156,480 bytes against the 1 GiB bound. Governed storage was
  163,738 bytes against the 128 MiB bound.
- Complete BT3 and BT2 suites, both authoritative ledgers, MT5 time contracts,
  strict typecheck, production build, syntax/diff checks, and sequential 44-test
  browser smoke passed from clean `30b3498`.
- Production build emitted only the previously disclosed Rollup circular-export
  and chunk-size warnings.

## Preserved Failures

- Run `sha256:743c7047824e2c4e690e88fa794d18feaae4cebbe58a5526dfeec243d5251e90`
  remains preserved and rejected because checkpoint sequence 2 failed independent
  integrity validation.
- Run `sha256:baefc6ce7d8484042b18a814c9e3bebaeaf48166910cb03192244c2b13a543`
  and report `sha256:556f59e936a74473c80b6e5578770112efc7ff5147a1da426aa9e54d9983cc60`
  remain preserved and blocked because only 40 of 48 required samples completed.
- During final validation, the first PowerShell logging wrapper treated a known
  Rollup warning written to stderr as a terminating native-command error. The build
  was rerun directly and exited zero; all remaining gates then passed. The wrapper
  log remains preserved under `.gotrader/bt3-phase8-operational-canary/logs`.

## Boundary

The accepted canary is browser-local, shadow-only, bounded, and non-authoritative.
It does not authorize production runtime adoption, strategy execution, simulation
promotion, parameter search, statistics promotion, risk allocation, portfolio
action, Paper Demo, broker mutation, readiness changes, or execution.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
externalContactObserved: false
runtimeAdoptionObserved: false

PHASE 8 FREEZE REQUIRES SEPARATE AUTHORIZATION AND ACCEPTANCE
PHASE 9 UNAUTHORIZED
BT3A UNAUTHORIZED
BROKER GATEWAY UNAUTHORIZED
```
