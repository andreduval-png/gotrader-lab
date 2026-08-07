# BT0 Statistics And Validation Audit

## Metric Inventory

| Metric | Implemented? | Current formula / sample | Cost and null behavior |
|---|---|---|---|
| Setup/candidate count | Yes | Array/event count | Before/after costs not relevant; definitions differ |
| Completed trade count | Partial | Terminal outcome or filled result count | Unfilled/insufficient handling differs |
| Wins/losses | Yes | Positive/negative realized R or target/invalidation labels | Depends on upstream costs |
| Win rate | Yes | wins / completed sample | Empty samples generally return zero or insufficient status |
| Target-first rate | Yes | target-first / eligible replay outcomes | Gross path classification |
| Average R / expectancy | Yes | arithmetic mean R | Cost depends on engine; ICT MFE-based R is not realized |
| Median R | Not consistently | Some reports may derive locally | Not canonical |
| Profit factor | Yes | positive R sum / absolute negative R sum | Zero-loss denominator needs explicit infinite/null policy |
| Max drawdown | Yes | peak-to-trough cumulative additive R | Not mark-to-market; no compounding |
| Win/loss streak | Not canonical | N/A | Missing |
| MAE/MFE | Partial | Raw future price excursion; some normalized R | Often from reference rather than proven fill |
| Hold time | Not canonical | N/A | Missing |
| Sharpe / Sortino / Calmar | No | N/A | Missing |
| SQN | No | N/A | Missing |
| Risk of ruin | Partial | Monte Carlo max drawdown threshold breach | Not literal capital ruin |
| Bootstrap confidence interval | Yes | Seeded IID bootstrap of mean R, usually 1,000 iterations | Costs inherited from input; minimum sample 20 |
| Session/weekday/month/quarter/year/regime | Fragmentary | Strategy-specific diagnostics | No common cube |

## Walk-Forward

Generic walk-forward creates chronological in-sample, validation, and OOS segments using configured percentages and windows (commonly 120/240/480 candles). Window starts can overlap substantially. The same frozen config runs on all splits; the engine does not fit parameters in-sample and select them in validation. Consequently, the labels represent chronological reporting rather than a complete train/select/test protocol. Split boundaries also lack carry-in warmup.

The detector-profile path is stronger. It freezes a development cutoff/profile, requires minimum OOS trades and independent dates, runs cost stress, and returns explicit pass/insufficient/forward-evidence verdicts. It should be preserved as an acceptance policy adapter.

## OOS

OOS methodology is inconsistent:

- Strategy performance scripts often own their own split/sample rules.
- Detector-profile holdout is frozen and non-overlapping after cutoff.
- ICT OOS is a script that fetches chunks and uses 30-day windows stepped by 15 days, so adjacent results overlap by 50%.
- The ICT script applies an existing calibrated profile; it does not perform nested train/validation optimization.

Minimum sample and positive-window requirements exist in selected paths, not one shared contract. OOS results cannot be aggregated without method identity.

## Optimization And Curve Fit

GoTrader explores or compares detector filters, thresholds, session constraints, stops/targets, and profile variants in research scripts and self-improvement tooling. The search space, number of trials, objective, development sample, and rejected trials are not consistently persisted as one immutable trial ledger.

Controls that help: frozen profile hashes, IFVG v2 negative control, IFVG v3 positive canary, independent-date gates, cost stress, OOS cutoffs, and forward evidence. Missing protections: nested validation, family-wise or false-discovery correction, deflated Sharpe/probability-of-backtest-overfitting analysis, preregistered objective, and complete trial accounting.

Verdict: optimization is `LOOKAHEAD/SELECTION_RISK` unless a specific frozen workflow proves otherwise.

## Monte Carlo

`ictMonteCarlo.ts` is an actual implementation, not a placeholder:

- Input: approved/watchlist ICT replay outcomes converted to R.
- Mapping: target-first uses achieved/estimated/default 2R; invalidation -1R; partial achieved/default 0.5R; stalled 0R.
- Resampling: IID with replacement.
- Runs: configurable, commonly/default 1,000.
- Seed: deterministic when supplied; otherwise `Date.now()`-based.
- Equity: additive R, not compounding.
- Drawdown: max peak-to-trough R, converted to percent by risk-per-trade percentage.
- Risk of ruin: fraction crossing a configured drawdown threshold (default-style 25%), not capital <= 0.
- Sequence: original autocorrelation/regime clustering is discarded.

Minimum usable outcome counts are small (roughly 8, with stronger rating near 30). The method is functional research diagnostics, not production-grade robustness. The future system needs retained seed identity, block/stationary bootstrap options, regime stratification, cost uncertainty, and portfolio-correlated sampling.

## Reproducibility

A complete run should record dataset ID/checksum, source fingerprint, requested/broker symbol, timeframe set, UTC range, strategy/profile/version/hash, parameter fingerprint, geometry mode, cost/risk model, engine version, code commit, time policy, intrabar policy, and random seed.

Current status:

- Phase 3F can identify a dataset strongly.
- B1 can identify requests/artifacts strongly.
- Generic/ICT run IDs often use time and randomness.
- Existing reports frequently omit source checksum, code commit, cost model, and seed.
- Browser localStorage/IndexedDB are not authoritative, durable experiment storage.
- Two clean-worktree ICT smoke tests fail from an incomplete temporary-module dependency closure.

Overall run reproducibility is weak despite strong reusable contracts.

## Required Statistical Contract

BT4 should implement one formula registry with versioned definitions, sample inclusion rules, gross/net variants, finite/undefined behavior, and test fixtures. Reports should separate trade-level, daily, monthly, and portfolio samples and must show counts alongside every rate/interval.
