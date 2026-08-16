# Results Source-of-Truth Remediation Acceptance

Status: accepted

## Identities

- Authorization: `6823168`
- Source-truth implementation: `d132f29`
- Deterministic browser-smoke correction: `9660b951c378760cefdccf97547c98797e397ea7`
- Parent: `43cc64359435e8fc1317bcb8ac74a300025bd7e5`
- Branch: `codex/gotrader-results-source-truth`

## Accepted Contract

- Every Results section declares whether its evidence is `current_cycle`, `historical_evidence`, or `unavailable`.
- Current-cycle metrics require an exact cycle and provenance match.
- Historical or unmatched replay, walk-forward, Monte Carlo, validation, Paper Demo, prediction, and profile evidence cannot be rendered as current-cycle proof.
- Missing metrics remain `null`/`n/a`; the UI does not substitute zero P&L, a default balance, a legacy hit rate, or a default frozen IFVG profile.
- Ordinary losses are not labeled false positives. The canonical compatibility field is displayed as attributed avoidable losses.
- The Results packet invariant rejects values whose current evidence relationship is unavailable.
- Execution, broker, and readiness-override authority remain `none/none/none`.

## Validation

- `npm run typecheck`: passed.
- `npm run test:results-source-truth`: passed.
- `npm run test:results-workspace`: passed.
- `npm run test:trade-plan-outcomes`: passed.
- `npm run test:v2-strategy-manifest`: passed.
- `npm run test:core`: passed, including the new Results source-truth gate.
- `npm run test:provenance`: passed.
- `npm run build`: passed with the pre-existing disclosed Rollup circular-export and large-chunk warnings.
- In-app browser verification: passed for the source map and fail-closed Backtest cards.
- `npm run smoke:browser`: 44/44 passed sequentially after isolating the optional local agent sidecar.

## Preserved Failures

- The first aggregate acceptance wrapper invoked a nonexistent `test:metric-semantics` npm script on this ancestry. The command failure is preserved and no metric-semantics result is claimed.
- The first browser run failed 12/44 because an unrelated sidecar on port 8799 rejected the smoke origin by CORS.
- The first isolated-sidecar rerun also failed 12/44 because the stub intentionally returned HTTP 503, which Chromium logged as a resource error.
- The accepted smoke harness now returns a deterministic research-only unavailable payload with HTTP 200; it neither contacts nor mutates a real sidecar.

No raw candles, trading intent, orders, broker mutation, Paper Demo promotion, readiness override, or production adoption were created.
