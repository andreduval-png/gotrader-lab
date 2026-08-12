# BT3 Phase 7 Controlled Experiment Policy Authorization

Date: 2026-08-12

Branch: `codex/gotrader-bt3-experiment-policy`

Parent second-ledger acceptance: `d03cd8bc4660ba59b0795c615a51850df4983e1d`

## Decision

```text
AUTH-BT3-PHASE-7-CONTROLLED-EXPERIMENT-POLICY
APPROVED FOR ISOLATED RESEARCH-ONLY IMPLEMENTATION
```

This final Phase 7 slice may add deterministic, hash-bound controlled-experiment
preregistration and multiple-comparison assessment contracts. It may implement
Benjamini-Hochberg false-discovery-rate reporting plus Holm and Bonferroni
family-wise controls over a complete preregistered candidate family.

The policy must retain the frozen family membership, candidate identity,
hypothesis, primary statistic, tail, significance targets, raw p-value, rank,
critical threshold, adjusted value, decision, dependency assumption, and
diagnostic applicability. Missing candidates, duplicate IDs, invalid p-values,
post-registration mutation, unknown methods, or unsupported assumptions fail
closed. Input order must not affect identities or decisions.

The slice is a pure research-policy boundary. It may not estimate p-values,
generate null samples, run parameter search, rank or select Auto Research
candidates, alter current promotion/readiness decisions, write either accepted
artifact ledger, migrate a third ledger, consume raw candles, contact MT5,
change Paper Demo, mutate broker state, place an order, or execute. Deflated
Sharpe, PBO, bootstrap reality check, nested validation, Phase 8, Phase 9,
Phase 10, BT3A, and broker gateway work remain separately gated.

## Acceptance Gate

1. Preregistration and assessment schemas are canonical-hash versioned.
2. Family membership is complete, unique, immutable, and order-normalized.
3. BH-FDR reports rank, critical threshold, adjusted q-value, and decision.
4. Holm and Bonferroni report adjusted p-values and family-wise decisions.
5. Adjusted values are bounded, monotone where required, and deterministic.
6. Ties use candidate identity as a deterministic secondary order.
7. Missing/extra trials, duplicate IDs, invalid values, mismatched family IDs,
   unknown methods, and tampered identities fail closed.
8. Dependency assumptions and unavailable dependent-selection diagnostics are
   explicit; `not_applicable` can never be interpreted as a pass.
9. Pure fixtures cover all-reject, partial-reject, no-reject, ties, boundary
   values, input-order invariance, and malformed families.
10. Complete BT3/BT2/ledger/time/typecheck/build/browser/syntax/hash/diff gates
    pass with no runtime integration or authority change.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
researchPolicyOnly: true
automaticCandidateSelectionAllowed: false
automaticPromotionAllowed: false
thirdLedgerMigrationAllowed: false
runtimeAdoptionAllowed: false
```

No later phase is authorized by this decision.
