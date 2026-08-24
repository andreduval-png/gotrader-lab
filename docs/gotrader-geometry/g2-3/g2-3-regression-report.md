# G2.3 Regression Report

Passed:

- `npm.cmd run test:ict-ifvg`
- `npm.cmd run test:ict-trade-construction`
- `npm.cmd run test:current-opportunity-scanner`
- `npm.cmd run test:ict-activate-market-pipeline`
- `npm.cmd run test:operator-console`
- `node scripts/test-ict-current-read-flow.mjs`
- `node scripts/test-ict-news-session-risk.mjs`
- `npm.cmd run typecheck`
- `npm.cmd run build` (passed with existing Rollup circular-chunk warnings)
- Static unauthorized IFVG construction scan: `0`

Live dashboard smoke check passed at `http://127.0.0.1:5173/dashboard`: Operator Console rendered, authority remained none/none/none, and rejected canonical geometry displayed no partial entry/stop/target/R:R values. The visible stored cycle predates G2.3 and therefore retains its old lowercase blocker label.

Harness limitations discovered before test assertions:

- `test:ifvg-live-opportunity` cannot resolve generated `validationProvenance`.
- `test-ict-target-invalidation-rr-audit` cannot resolve generated `ictSessionRaidReversal.mjs`.

These missing-dependency harness defects are outside G2.3 and were not masked by unrelated rewrites. Build and final focused regression results are recorded in the final acceptance report.
