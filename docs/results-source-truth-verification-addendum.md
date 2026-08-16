# Results Source-Truth Verification Addendum

Status: verified with disclosed evidence classes

Date: 2026-08-15

## Verified Contract

- A section may claim `current_cycle` only when its immutable `sourceCycleId` equals the exact current cycle ID.
- Replay, walk-forward, Monte Carlo, and validation evidence with matching profile provenance but no cycle binding is historical evidence, never current evidence.
- The active source must exactly match provider, requested symbol, broker symbol, timeframe, and canonical source fingerprint.
- Unmatched or missing evidence renders `n/a` or `unavailable`; zero remains a real numeric zero.
- Current-cycle Backtest readiness cannot fall back to historical runtime readiness.
- The calendar and outcome log are identified as a global local simulation ledger.
- Trade-plan records are identified as mutable browser-origin evidence, not certified evidence.
- The canonical compatibility loss count is labeled `Estimated validation losses`; it is not presented as qualified avoidable-loss attribution.
- Results authority remains `none/none/none`.

## Tested Surfaces

- Overview and complete evidence source map.
- Trade Plans and four-week descriptive review.
- Backtest statistics, curve, readiness, and outcome log.
- Replay evidence.
- Walk-Forward chronological OOS evidence.
- Paper Demo, forward evidence, and prediction calibration.
- Robustness and Monte Carlo evidence.

## Validation

- Focused Results, trade-plan, source, validation-chain, walk-forward, prediction-ledger, Paper Demo, forward-evidence, research-quality, and readiness tests passed.
- Strict TypeScript validation passed.
- Aggregate core and provenance suites passed.
- Production build passed with the existing disclosed Rollup circular-export and large-chunk warnings.
- In-app browser inspection passed across all seven Results tabs with no visible `null`, `undefined`, or `NaN` values.
- Sequential browser smoke passed 44/44 with the Results test visiting all seven tabs.

## Preserved Failure

- One full browser run recorded a timeout while loading the unrelated `/research` route. The exact route passed in isolation and the complete sequential 44-test matrix then passed without code changes related to that route.

## Evidence Boundary

The Results page is source-truth accurate for the evidence it can identify and now fails closed when identity or cycle binding is absent. Local outcome and trade-plan ledgers remain mutable local evidence; the UI labels them honestly and does not claim that they are certified or current-cycle validation proof.
