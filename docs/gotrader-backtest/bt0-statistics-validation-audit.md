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

The largest implemented candidate population is the ICT approved-profile grid: 2,560 deterministic post-detection filter combinations, of which the browser evaluates 50 by default. Generic Auto Research authors at most 25 candidates, and the IFVG audit compares 26 hand-written variants. None of these paths has an immutable experiment-family ledger, durable large-scale scheduler, complete survivor funnel, formal multiple-comparisons correction, or one-way holdout lifecycle. See `bt0-parameter-search-and-anti-overfitting-addendum.md` for the parameter-by-parameter inventory.

## Canonical Sharpe Definition

The UI's current `sharpeLike` fields are not canonical Sharpe ratios. BT4A must define canonical Sharpe from **net daily equity returns** produced by an identified fixed-risk policy:

- include every eligible trading day, including zero-return days;
- identify the trading calendar, annualization factor, risk-free assumption, currency, cost model, and return convention;
- define minimum day count, finite/null behavior, and zero-variance behavior;
- keep gross and net variants separate, with net canonical for acceptance;
- never substitute trade-level observations for daily returns.

Trade-level mean R divided by trade-level R standard deviation may be reported as `tradeReturnQuality`, with its own versioned formula and effective-sample-size warning. It must not be labeled or compared as Sharpe.

## Sequential Validation Funnel

Every experiment family must retain every attempted configuration and publish stage counts, rejection reasons, and survivor distributions for:

1. population and schema validity;
2. sample sufficiency;
3. positive net performance;
4. risk-adjusted and concentration limits;
5. multiple-comparisons correction;
6. chronological OOS and era stability;
7. cold-instrument validation when generalization is claimed;
8. sealed holdout.

Sample sufficiency is a versioned policy over completed trades, independent dates, effective sample size, concentration, and independent windows. BT0 does not adopt a universal trade-count threshold. An adaptive or Bayesian search remains part of the same family and must retain rejected, canceled, and failed trials.

## Multiple Comparisons

No formal implementation was found. BT4B must preregister the family, primary statistic, null, alpha/FDR target, and correction before evaluation. The result contract retains raw p-value, family size, rank, critical value, adjusted p/q-value, correction version, dependency assumption, and decision.

Benjamini-Hochberg FDR is required for discovery reporting but is not sufficient by itself because nearby configurations share trades and are highly dependent. Holm or Bonferroni must be available for family-wise control, and dependent-selection diagnostics should include an accepted bootstrap reality-check method plus Deflated Sharpe Ratio and Probability of Backtest Overfitting where their assumptions are met. A method whose assumptions are not met reports `NOT_APPLICABLE`; it is never silently replaced with an easier pass.

## Null Models And Ablation

No random-entry, direction-shuffle, return-permutation, block-bootstrap null, session-matched null, or strategy-label permutation engine exists. Current Monte Carlo resamples observed strategy outcomes and therefore does not test a no-edge null.

BT4B must freeze null constraints, run count, seed, costs, eligible population, and statistic. Nulls should preserve trade count, eligible sessions, direction/risk/holding distributions, and serial structure where applicable. Reports retain the null distribution, percentile, p-value, effect size, and parent experiment family.

Controlled ablations must be paired child experiments using overlays or new profile versions, never mutations of frozen profiles. The adapter declares base, optional, dependent, and inseparable conditions. The report includes deltas in trade count, net expectancy, canonical Sharpe, PF, drawdown, and OOS stability, plus active-filter and tuned-dimension complexity. Predeclared parameter neighborhoods must reveal whether a survivor is a stable region or an isolated peak.

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

The canonical result must additionally retain `researchProgramId`, `strategyFamilyId`, `experimentFamilyId`, `configurationId`, instrument/era/run IDs, search method and seed, trial disposition, complete funnel stage, raw and adjusted significance, correction/null identities, complexity/neighborhood results, cold-instrument state, and sealed-holdout state. Reporting only top candidates is invalid because selection accounting depends on the full attempted population.

For every funnel stage, the report should retain minimum, p5, p25, median, p75, p95, and maximum for trade count, net expectancy, canonical Sharpe, PF, drawdown, and win rate. Operational distributions should also include setups/trades per year, best/worst day/week/month, losing/winning streaks, profitable-day/week/month percentages, median monthly R, monthly dispersion, time in market, and holding time when defined. Robust selection policies may choose a low-complexity Pareto representative, cluster medoid, median robust survivor, low-drawdown survivor, or cross-instrument stable survivor; the absolute historical maximum is not the default.
