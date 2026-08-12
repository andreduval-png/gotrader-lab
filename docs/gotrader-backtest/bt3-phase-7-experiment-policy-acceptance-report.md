# BT3 Phase 7 Controlled Experiment Policy Acceptance Report

Date: 2026-08-12

Parent second-ledger acceptance: `d03cd8bc4660ba59b0795c615a51850df4983e1d`

Authorization: `88eb3d0d876fe81323d55c492e904359aae550bb`

Implementation: `af46cc69a8195650c598d188d01495fa26e5be76`

## Decision

```text
ACC-BT3-PHASE-7-CONTROLLED-EXPERIMENT-POLICY
ACCEPTED

BT3 PHASE 7
COMPLETE
```

The final Phase 7 slice adds a deterministic, hash-bound research policy for
preregistered experiment families and multiple-comparison assessment. It
reports Benjamini-Hochberg false-discovery-rate results independently from Holm
and Bonferroni family-wise controls. It is not integrated into Auto Research,
selection, promotion, readiness, runtime, or either accepted artifact ledger.

Accepted identities:

- policy report: `sha256:b7fc0d8e18955efa8ce45153dee967f8ef59cd81c1c8694b59f2ad3e9726a518`;
- snapshot: `sha256:84f0470ceb5a8406e1f44391697ee95c1ecf5051fc07d95f0784817bc60f1920`;
- partial-reject family: `sha256:9c07b11bb583cc0009a76f406aa8b9e911ea6a55fd7da94328561f806bae530f`;
- partial-reject assessment: `sha256:392f60c905da156681d2f6bdb52a566b8f1cd8a7650898b3abcffdd865d8ac4e`;
- all-reject family: `sha256:9dab2043553714b93cac9ceecafc8648ba11c4abea4cc388e67ed3881735c614`;
- all-reject assessment: `sha256:587d6de9522528c591d8171b02367931e2e5cd650c8f86ba0a451679a9fac454`;
- no-reject family: `sha256:fce312d673fa19c223690ffe2aecf3351f32071ca754bbd3234d097cfddba8c7`;
- no-reject assessment: `sha256:0eb446473bb516f8a2dcc1145c42bb2a2846646254a16cd7726c4eabe69bc658`;
- ties/boundaries family: `sha256:a7fb8691f7cd0da69c7557375892dad44492478b69c049f4e22b66c0fad9c2e4`;
- ties/boundaries assessment: `sha256:81f5c518a1cfc256cf1dc56b0a0362af450665a4a0ae79a2e660ca0b0cbcfb3e`.

Results:

- family key, hypothesis, statistic, tail, alpha, FDR target, dependency
  assumption, complete candidate membership, methods, and authority are
  preregistered and hash-bound;
- candidate family order is canonicalized and p-value ties use candidate ID as
  the deterministic secondary order;
- BH critical thresholds, monotone adjusted q-values, and decisions passed
  exact expected-value fixtures;
- Holm step-down thresholds, monotone adjusted p-values, and decisions passed;
- Bonferroni thresholds, adjusted p-values, and decisions passed;
- all-reject, partial-reject, no-reject, ties, zero/one boundaries, and reversed
  input order reproduced stable identities and decisions;
- missing or extra trials, duplicate IDs, invalid/NaN p-values, family mismatch,
  unknown schemas or methods, unsupported dependence, authority mutation, and
  tampered hashes failed closed;
- bootstrap reality check, Deflated Sharpe, and PBO are explicitly
  `not_applicable` with reasons and cannot be interpreted as passes;
- no raw candles, MT5 contact, artifact write, third-ledger migration,
  automatic selection, promotion, readiness change, Paper Demo, production,
  broker mutation, or execution occurred;
- authority remained `none/none/none`.

Complete BT3 and BT2 suites, both authoritative ledgers, both artifact-family
browser suites, time contracts, typecheck, production build, syntax, hash, and
diff checks passed. Browser smoke passed all 44 routes. Existing non-failing
Rollup circular-chunk and chunk-size warnings remain unchanged.

## Phase 7 Completion Boundary

Phase 7 is complete for its planned scope: versioned compact artifacts,
one-ledger-at-a-time shadow migration for forward evidence and predictions,
identity lineage, causal tags, and controlled multiple-comparison policy.
Legacy ledgers remain authoritative and automatic artifact adoption is off.

This acceptance does not estimate p-values, generate null distributions, run
nested validation, implement bootstrap reality check/Deflated Sharpe/PBO, or
connect experiment results to candidate selection. Those capabilities require
new authorization and assumption-specific evidence.

```text
PHASE 8 UNAUTHORIZED
PHASE 9 UNAUTHORIZED
PHASE 10 UNAUTHORIZED
BT3A UNAUTHORIZED
BROKER GATEWAY UNAUTHORIZED
```
