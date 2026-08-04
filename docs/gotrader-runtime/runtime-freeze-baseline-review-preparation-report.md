# Runtime Freeze And Baseline Review Preparation Report

## Status

```text
PREPARATION COMPLETE

STRICT OR GOVERNED LIMITED A3.2 ACCEPTANCE REQUIRED

RUNTIME NOT FROZEN

BASELINE NOT ACCEPTED
```

## Purpose

This change prepares the read-only gate between A3.2 operational acceptance and
the formal Runtime Freeze / Baseline Review. It does not modify the A3.2 runtime
candidate or any observer artifact. It supports either strict observer
acceptance or a separately integrity-hashed `accepted_with_limitations`
operator decision governed by architecture change control.

The preparation harness reads two repositories:

1. the isolated A3.2 runtime candidate; and
2. the isolated B1 preparation branch.

It emits a compact integrity-hashed manifest to standard output. It does not
write either repository, start or stop services, probe broker state, or mutate
runtime ledgers.

## Captured Baseline Inputs

The manifest records:

- exact repository root, branch, HEAD, and clean-worktree state;
- the operational runtime profile ID and version;
- the configured read-only service graph and expected ports;
- runtime profile validation and disabled capability flags;
- SHA-256 hashes for the runtime, observer, MT5 read-only, and architecture
  allowlist;
- the A3.2 operational report classification and content hash;
- the observer evidence file hash, canonical integrity result, acceptance-check
  result, and compact counts;
- the operator acceptance decision hash, runtime lineage, evidence binding,
  authority boundary, and permitted next gates when limited acceptance is used;
- the B1 preparation commit chain through `d642887`;
- authority `none / none / none`.

Raw candles, context facts, account/order/position data, credentials, and
secrets are not copied into the manifest.

Runtime implementation and A3.2 evidence are read from the isolated A3.2
candidate. Architecture governance, B1 specifications, and B1 commit
compatibility are read from the isolated preparation branch. The harness does
not require planning documents to be merged into A3.2 before acceptance.

## Gate Semantics

The evaluator can return only:

- `blocked_pending_a3_2_acceptance` when the static baseline is coherent and
  only the formal A3.2 report/evidence gate remains;
- `blocked_baseline_mismatch` when repository identity, hashes, profile,
  authority, safety flags, integrity, or B1 compatibility are invalid; or
- `ready_for_baseline_review` after either strict A3.2 acceptance or a valid,
  narrowly bounded `accepted_with_limitations` decision.

Limited acceptance is valid only when the observer artifact is integrity-valid,
exactly `marketBreakHandledSafely` is false, exactly one transition sample is
unsafe, all other checks pass, proof uptime is 100%, fresh proof resumes, every
safety and data-integrity counter is zero, the decision matches the evidence,
and the accepted candidate is an ancestor of the reviewed runtime HEAD.

Even `ready_for_baseline_review` preserves:

```text
runtimeFrozen: false
baselineAccepted: false
```

An explicit review is still required to freeze and accept the baseline.

## Current A3.2 Interpretation

The 2026-08-03 observer artifact remains `observation_incomplete` and is never
rewritten by this harness. The committed operator record may govern that result
as `accepted_with_limitations` only through the narrow validation described
above. Missing, tampered, unrelated, broadened, or authority-changing decisions
fail the baseline audit.

## Safety Boundary

The harness preserves:

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

It cannot enable strategy execution, evidence creation, readiness changes,
Paper Demo, broker access, production adoption, or execution. It has no runtime
registration and no scheduler registration.

## Usage

Run the focused fixture suite:

```powershell
npm.cmd run test:runtime-freeze-baseline-review
```

Inspect a runtime candidate without modifying it:

```powershell
npm.cmd run audit:runtime-freeze-baseline-review -- --runtime-repo "C:\Users\andre\OneDrive\Documents\gotrader-runtime-track-a3" --expected-runtime-head e605c10ed6681512da89fa2a4b29791b03a67168
```

A ready result authorizes baseline review only; it does not activate B1.2,
production, Paper Demo, broker, execution, evidence, or readiness capabilities.
