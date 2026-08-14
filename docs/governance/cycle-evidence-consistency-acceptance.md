# Cycle Evidence Consistency Acceptance

Date: 2026-08-14

## Accepted identity

- Branch: `codex/gotrader-cycle-evidence-consistency`
- Parent: `a65e48af58941c68298c0ceb1623e7f1a53d3ae6`
- Implementation: `067430c7f6749fa19e22c6f9335761633940628b`
- Implementation tree: `47a588a2845503fad9b1e4fa6d8541d36d506c6a`

## Accepted behavior

- Advisor validation evidence is identity-bound to the active research cycle and its current validation provenance.
- Unmatched validation-chain results are exposed only as historical evidence and cannot populate current-cycle verdict fields.
- Missing calibration evidence renders as `unavailable`; it is not represented as a measured zero percent result.
- Advisor packet construction fails closed when a passed current verdict is combined with missing or identity-mismatched current validation.
- Validation-chain entries record their source cycle identity when linked from a research cycle.
- Execution, broker, and readiness-override authority remain `none`.

## Verification

Passed focused contracts:

- `test:advisor-evidence-consistency`
- `test:research-cycle-validation-linkage`
- `test:validation-chain`
- `test:advisor-chat-bridge`
- `test:readiness-blocker-priority`
- `test:internal-agent-evidence-policy`
- `test:research-advisor-stability`
- `test:operator-console`
- `test:cycle-historical-evidence`
- strict TypeScript typecheck

Passed complete regression gates:

- `test:core`
- `test:source-integrity`
- `test:provenance`
- `test:safety`
- production build
- sequential browser smoke: 44 of 44 passed
- `git diff --check`

The production build retained the existing large-chunk warning. During focused validation, the advisor-chat bridge harness initially referenced the removed global validation-chain lookup; that harness mismatch was preserved in the work log, corrected to the packet invariant contract, and rerun successfully.

## Boundaries

This acceptance does not authorize strategy execution, Paper Demo, production adoption, broker mutation, orders, or execution. It does not change readiness thresholds or promote historical evidence into current evidence.
