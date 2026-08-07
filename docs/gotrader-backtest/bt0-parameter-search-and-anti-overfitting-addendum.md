# BT0 Parameter Search And Anti-Overfitting Addendum

## Decision

The addendum is accepted with the statistical clarifications recorded here. Current GoTrader supports bounded deterministic candidate comparison, not reproducible large-scale strategy discovery. The future architecture must treat every attempted configuration as part of an immutable experiment family and apply stronger validation as search breadth increases.

## Existing Search Implementations

| Implementation | Space / method | Identity and lifecycle | Verdict |
|---|---|---|---|
| Generic Backtest/Auto Research | Hand-authored deterministic candidates from a mutable generic config; capped at 25 | Candidate metadata/audit trail, browser checkpoint cannot resume; no dataset-complete configuration ID | Small bounded comparison only |
| ICT approved-profile optimizer | Exact grid: 4 confidence x 5 RR x 7 booleans = 2,560 candidates | Candidate ID encodes values; run/journal IDs use time/randomness; browser evaluates 50 by default and retains top rows | Largest current space, but post-filter ranking rather than full detector search |
| IFVG filter variants | 26 hand-authored predicates and compound predicates | Named variants in a script/report | Post-hoc variant audit, not a configuration generator |
| Session-raid v2 | Nine numeric threshold inputs with defaults | Threshold set retained in telemetry; no sanitizer/range or family ID | Configurable profile, unsafe for unrestricted sweep |
| Adaptive/zero-trade recovery | Deterministic follow-up candidates selected from failed gates | Browser-local cycle/proposal trail | Sequential heuristics, not a predeclared validation funnel |

No full generic grid service, random sampling, Latin hypercube, low-discrepancy sampling, Bayesian optimization, durable trial scheduler, or reproducible thousands-run experiment registry exists.

## Generic Backtest Configuration Space

`frozen` means frozen by the generic config itself; individual manifest profiles may impose stronger governance. Every listed field affects a future canonical configuration identity.

| Parameter | Source/type | Allowed range | Default | Frozen? | Causal? | Safe research sweep now? |
|---|---|---|---|---|---|---|
| `strategyProfile` | profile enum | agent consensus, IFVG v2/v3/v4, CMD v2 | `agent_consensus` | No | Yes | Only registered profiles; never blend families |
| `symbol` | config enum | ES, NQ, MES, MNQ | NQ | No | Yes | No, until CFD broker-symbol normalization |
| `timeframe` | config enum | 1m, 5m, 15m, 1h, 4h, 1d | 5m | No | Yes | Only if adapter declares support |
| `sessionFilter` | policy enum | all, Asia, London, New York, NY AM, NY PM | all | No | Yes if historical time verified | Blocked by historical-time gate |
| `marketRegime` | policy enum | trend, balanced, volatile, range, news-driven, risk-off, risk-on | trend | No | Unverified | No until as-of regime provenance is proven |
| `minimumConfluenceThreshold` | config float | 0..1 | 0.35 | No | Yes | Yes for generic research family |
| `minimumConfidenceThreshold` | config float | 0..1 | 0.42 | No | Yes | Yes for generic research family |
| `targetRMultiple` | geometry float | 0.25..8 | 2 | No | Yes | Only as `STANDARDIZED_RR_EXPERIMENT` |
| `stopModel` | geometry enum | latest swing, fixed ticks, FVG invalidation | latest swing | No | Yes | Fixed-tick option blocked for CFD units |
| `fixedTickStopSize` | geometry integer | 1..400 | 48 | No | Yes | No until point/pip contract exists |
| `maxBarsToResolveTrade` | simulation integer | 1..48 | 8 | No | Yes | Yes, with explicit expiry identity |
| `allowLong`, `allowShort` | policy booleans | true/false | true/true | No | Yes | Yes; direction-filter family must be declared |
| `agentWeights.*` | 23 config floats | 0..1.5 each | versioned defaults in `backtestConfig.ts` | No | Unverified by agent | No large sweep until causal agent inputs are certified |
| `warmupCandles` | engine integer | 6..100 | 14 | No | Yes | Yes within adapter minimums |
| `decisionInterval` | engine integer | 1..24 | 4 | No | Yes | Yes; changes candidate sampling |
| `visibleWindow` | engine integer | 8..80 | 18 | No | Yes | Yes; affects detector input and identity |
| `spreadTicks`, `slippageTicks`, `commissionTicks` | cost floats | 0..20 each | 1 each | No | Yes | No until broker point/pip cost model exists |

The continuous dimensions make a naive Cartesian space effectively unbounded. The current generator samples a small authored subset rather than defining resolution/priors for the full space.

## ICT Approved-Profile Grid

| Parameter | Type / exact values | Default/baseline | Frozen? | Causal? | Identity? | Safe sweep? |
|---|---|---|---|---|---|---|
| `minConfidence` | enum 50, 60, 70, 80 | candidate-specific | No | Yes | Yes | Yes |
| `minRr` | enum 1.5, 1.75, 2, 2.5, 3 | candidate-specific | No | Yes | Yes | Yes, but current RR is MFE-influenced |
| `requireHtfAlignment` | boolean | both values generated | No | Requires causal HTF close | Yes | After adapter proof |
| `requireFvgPresent` | boolean | both | No | Yes | Yes | Yes |
| `requireExternalLiquidityTarget` | boolean | both | No | Yes | Yes | Yes |
| `rejectEquilibrium` | boolean | both | No | Yes | Yes | Yes |
| `requireSmtConfirmationForIndex` | boolean | both | No | Requires causal comparison data | Yes | After cross-symbol proof |
| `rejectMediumNewsRisk` | boolean | both | No | Requires as-of news | Yes | After historical news contract |
| `preferredSessionsOnly` | boolean | both | No | Requires verified time | Yes | Blocked by historical-time gate |
| `rejectTargetTooClose` | fixed boolean | true | Yes | Yes | Yes | Ablation only in a new research family |
| `rejectSmtAgainstCandidate` | fixed boolean | true | Yes | Yes | Yes | Ablation only |
| `rejectHighNewsRisk` | fixed boolean | true | Yes | Requires as-of news | Yes | Ablation only |

This produces 2,560 combinations. It re-filters existing replay results, so it cannot test detector parameters that would change which opportunities existed.

## Strategy-Family Parameter Inventory

Hardcoded detector constants are listed as single-value ranges. They are frozen semantics, not currently safe sweep controls.

| Family | Exact dimensions and current values | Configuration generation | Modularity / sweep verdict |
|---|---|---|---|
| Silver Bullet v1/v2 | `SILVER_BULLET_SESSIONS`: 03:00-04:00, 10:00-11:00, 14:00-15:00 NY; sweep lookback 20; v2 displacement body/range 0.8/0.55; minimum FVG 0.15 average range; FVG delay <=5 bars; return <=10; RR 2..15; news +/-30m; `vwapExtensionThreshold` default 0.0075 | No family generator | Conditions are mostly inseparable code constants; vwap input is exposed but not governed |
| IFVG v1 | timeframe 5m/15m; inversion <=36 bars; target lookback 96; target distance max(24-bar average x0.8, 1); minimum RR 2; midpoint entry and structure buffer stop | Generic profile only | Geometry is causal but constants are not exposed |
| IFVG v2 | `minimumBodyRatio` 0.55; clean retest, pre-retest displacement, and fresh signal required | 26 named post-filter variants, not detector grid | Some filters are separable; detector thresholds remain frozen |
| IFVG v3 | clean retest and latest-closed-candle freshness required | Generic profile and frozen holdout | Frozen positive canary; not sweepable in place |
| IFVG v4 | `IFVG_V4_MAX_RETEST_PENETRATION=0.66` | One versioned candidate | Correct model for a research fork; neighborhood not implemented |
| Turtle Soup | sessions London 03:00-05:00 and NY 09:30-11:00; setup 15m/1h; entry 5m; setup lookback 48/minimum 12; sweep tolerance max(range x0.02,1); rejection <=3 bars; stale <=10; retest <=6; premium/discount 0.45/0.55; minimum RR 2.5 | None | Components can be identified conceptually but are hardcoded/inseparable |
| CISD | RTH open 09:30-10:30 and RTH to 16:00; prior delivery windows 8/14; move multipliers 1.4 and 4; direction ratios 0.58/0.55; weak body 0.85/0.28/0.42; retest <=10; target lookback 48; chop flips >=7; minimum RR 2; news +/-30m | None | No profile parameter contract |
| CMD high-displacement v2 | displacement age <=2; score >=1.25; FVG age <=6; RR 2..20; scan windows 40/12, context 2,500, liquidity 600 | Deep diagnostic candidate only | Hardcoded and short-only; no safe generator |
| Session raid v1 | NY/session windows and narrative constants; minimum/preferred RR 2/3; USTECH max stop 120; displacement and structure thresholds hardcoded | None | Session-sensitive and blocked by historical time |
| Session raid v2 | Nine exposed floats: `minDisplacementBodySize=35.45`, `minFvgSize=9.48`, `maxFvgSize=92.2`, `maxRetraceDepthPercent=0.75`, `maxRaidDistanceAboveLondonHigh=81.3`, `maxStopDistance=60`, `minTargetFeasibilityScore=0.45`, `maxRrWithoutStrongFeasibility=4`, `strongFeasibilityScore=0.7` | Partial input override | No allowed-range sanitizer; unrestricted search is unsafe |
| Phase 2 Bread-and-Butter buy/sell | required order-block direction/context and fixed confidence formulas | None | Conditions are inseparable executable logic |
| Phase 2 One Shot One Kill | direction, order block, sweep, displacement, FVG, draw-on-liquidity, RR>=2 all required | None | Suitable for controlled ablation fork, not profile mutation |

Every future parameter must declare source, type, allowed distribution/resolution, default, frozen state, causal status, identity effect, and research-sweep authorization. `NOT_EXPOSED` and `INSEPARABLE` are valid outcomes.

## Sequential Validation Funnel Audit

Auto Research and IFVG variant scripts contain fragments of a funnel: candidate generation, backtest, minimum samples, positive/stability gates, walk-forward, cost stress, and approval-gated proposals. They do not preserve one immutable family-wide count/rejection ledger. The ICT optimizer primarily ranks candidates and stores top subsets. Current support is partial.

The future funnel must report all counts and rejection reasons at population, sample sufficiency, positive net performance, risk-adjusted performance, multiple-testing correction, OOS/era stability, cold instrument, and sealed holdout stages. A versioned sample policy should combine trades, independent dates, effective sample size, concentration, and windows; no universal `100 trades` threshold is adopted in BT0.

## Statistical Correction And Null Audit

No formal raw p-value contract, BH-FDR, Bonferroni, Holm, White's Reality Check, Deflated Sharpe Ratio, or Probability of Backtest Overfitting implementation was found. No random-entry, direction-shuffle, return-permutation, block-bootstrap null, session-matched null, or strategy-label permutation engine exists. Existing Monte Carlo resamples observed outcomes and is not a null-hypothesis test.

BH-FDR is required but not sufficient. Configurations are correlated; the future artifact must retain the dependency assumption, raw p-value, rank, critical threshold, adjusted q-value, FDR target, and decision. Holm/Bonferroni provide family-wise controls; Deflated Sharpe/PBO and bootstrap reality-check methods address selection and dependent returns.

A null policy must freeze the eligible population, statistic, constraints, run count, seed, and costs before execution. Random-entry nulls should preserve trade count, eligible sessions, direction/risk/holding distributions where appropriate. Null results report percentile, p-value, effect size, and full family identity.

## Sharpe Contract

Current UI `sharpeLike` values are simulation scores, not canonical backtest Sharpe. The future canonical Sharpe should use net daily equity returns under an identified fixed risk policy, include eligible zero-return days, state annualization/trading calendar and risk-free assumption, and define zero-variance behavior. Trade-level mean-R divided by trade-level R standard deviation must use a separate name and cannot be compared to daily Sharpe.

## Ablation, Complexity, And Neighborhoods

IFVG's named variants provide limited post-filter comparisons; Session Raid v2 exposes thresholds; registry notes request some ablations. There is no canonical feature dependency graph, base-plus-feature ladder, paired experiment identity, complexity score, or local neighborhood analysis.

Future ablations use research overlays or new profile versions, never mutate frozen profiles. Each adapter declares base, optional, dependent, and inseparable conditions. Reports show deltas in trades, net expectancy, canonical Sharpe, PF, drawdown, and OOS stability. Complexity records active filters and tuned dimensions. Neighborhood tests use predeclared deltas/distributions and flag isolated peaks.

## Cold Instrument, Era, And CFD Events

Multiple CFD mappings exist, but no governance prevents a validation instrument from influencing discovery. A future experiment freezes discovery instruments and all selection decisions before cold-instrument unlock. Results must state the generalization claim; a Nasdaq-specific strategy may legitimately be instrument-specific.

Chronological windows exist, so era analysis is partially possible, but median/worst/best/dispersion and decay are not canonical. CFD event treatment must use broker-observed holidays, early closes, maintenance, abnormal spreads, and news shocks. Do not add exchange futures roll logic unless an actual broker CFD anomaly requires a versioned equivalent policy.

## Execution Gauntlet

Current generic passive entries count an OHLC touch as a fill; IFVG/CMD/ICT paths may assume an entry at the decision/reference without a touch. Same-bar stop/target is generally conservative stop-first. Cost stress exists in selected scripts (including additional 0.5R and IFVG 0.5R/1R scenarios) but is not broker-normalized.

Future passive-limit policies may require trade-through; stop and market orders need distinct rules. A doji is not automatically ambiguous. Ambiguity exists when OHLC cannot establish entry/stop/target ordering. `CONSERVATIVE_LOSS` is a defensible acceptance default, with ambiguity rate and lower-timeframe/exclusion sensitivity reported.

## Holdout Governance

The detector-profile cutoff/frozen profile is useful but no one-way sealed/unlocked/consumed dataset state exists. Retuning after viewing results is discouraged but not technically prevented.

Required state includes `holdoutStatus`, `holdoutDatasetId`, `configurationFreezeId`, `sealedAt`, `unlockedAt`, `holdoutConsumedAt`, unlock authorization, result seal, and parent experiment family. Transitions are one-way. A failed holdout remains immutable; further research creates a new family and a genuinely untouched holdout.

## Reporting And Selection

Current UI/reporting emphasizes recommended/top candidates and often compacts away the population. It cannot report the full funnel or survivor distributions. Trades/year, profitable day/week/month percentages, monthly median/dispersion, time in market, and holding time are not canonical.

Future selection should favor predeclared robust policies such as lowest-complexity Pareto representatives, cluster medoids, median robust survivors, lowest drawdown, or cross-instrument stability. Selecting the absolute historical maximum is not the default.

## Experiment Hierarchy

```text
Research Program
  -> Strategy Family
    -> Experiment Family
      -> Configuration
        -> Instrument Run
          -> Era / Walk-Forward Run
            -> Null and Ablation Runs
              -> Cold Instrument
                -> Frozen Holdout
```

Every level is immutable and identified. Removing a weak trial after observing it is forbidden. The canonical statistical artifact includes configuration/family IDs, trade count, gross/net R, expectancy, canonical Sharpe definition, PF, drawdown, raw/adjusted p-values, correction method/FDR target, null identity/runs/percentile, OOS/cold/holdout states, and authority.

## Scale Consequence

A naive 25,000-configuration scan over approximately 927,000 bars is more than 23 billion configuration-bar evaluations per symbol. The canonical engine must distinguish cheap post-detection filtering from parameters that require detector reruns. Use cached causal facts/opportunities, deterministic bounded random or low-discrepancy sampling, predeclared seeds/distributions, staged elimination with all trials retained, and bounded headless workers. Adaptive search remains part of the same experiment family and receives no statistical exemption.

## Roadmap Impact

The top-level BT0-BT9 sequence remains useful but is insufficiently explicit for governed discovery. BT0 proposes BT3A parameter schemas, BT4A canonical metrics/experiment hierarchy, BT4B statistical correction/nulls/ablation, BT5A era/cold-instrument validation, BT5B sealed holdout governance, and BT8A large-scale search operations. These are recommendations, not adopted Architecture Index phases. Exact proposed governance and frozen-roadmap wording are in `bt0-draft-change-control-record.md`; no frozen runtime architecture file is changed by BT0.

## Non-Negotiable Rule

`Testing more configurations requires stronger validation, not greater confidence in the top historical result.`

Authority remains `none/none/none`; no search, result, or holdout may apply calibration, mutate a frozen profile, approve readiness, create evidence/trade intent, or enable production/execution.
