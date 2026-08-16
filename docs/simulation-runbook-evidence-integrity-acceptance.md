# Simulation Runbook Evidence Integrity Acceptance

Status: accepted

## Identities

- Parent Results acceptance: `38bfbc337074d90d8b291a3d89549eccdf020798`
- Authorization: `a1a3564`
- Implementation: `deae0e81990e83c25bbe3a115466a45f84998b8a`
- Branch: `codex/gotrader-runbook-evidence-integrity`

## Accepted Contract

- Every simulation-runbook check is backed by a unique immutable evidence receipt.
- Receipts are bound to the exact current research-cycle identity and linked by an integrity hash chain.
- A receipt source must match the check-specific source allowlist; conflicting replacement evidence is rejected.
- Legacy browser-local checklist state is archived only as untrusted context and contributes zero completed checks.
- Authoritative runbook evidence is stored by the local sidecar independently of browser origin and development-server port.
- Readiness fails closed unless the exact current cycle has an integrity-valid 10/10 evidence set, including broker-skipped, zero-state, and shutdown receipts.
- The runbook UI is read-only and distinguishes evidence-bound checks from missing evidence.
- No execution, broker, readiness-override, production-adoption, or trading authority was introduced.

## Validation

- Strict TypeScript typecheck passed.
- Simulation-runbook evidence contract tests passed, including cycle binding, immutable evidence, restart integrity, legacy-state distrust, and browser-port independence.
- Local sidecar tests passed, including durable hash-chained runbook evidence.
- Readiness blocker-priority tests passed.
- Aggregate core, provenance, and canonical AI-agent-interface checks passed.
- Production build passed.
- Sequential Playwright browser validation passed 44/44, including `/simulation-runbook` and `/readiness-gate`.
- Manual browser inspection confirmed ten evidence rows, no editable checkboxes, and explicit durable-storage copy.
- `git diff --check` passed.

## Preserved Disclosure

- `test:ict-activate-market-readiness` remains independently blocked by a pre-existing missing generated `.gotrader/currentOpportunity` module on this ancestry. This unrelated generated-artifact failure is not represented as passing and does not weaken the runbook evidence acceptance.
- Existing Rollup circular-export and large-chunk warnings remain disclosed.

## Authority

- `executionAuthority: none`
- `brokerAuthority: none`
- `readinessOverrideAuthority: none`

