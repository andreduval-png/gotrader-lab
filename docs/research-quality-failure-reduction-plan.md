# Research Quality Failure Reduction Plan

## Objective

Preserve the positive IFVG v3 out-of-sample expectancy while determining why current quality gates report excessive false positives, red session consistency, and 8.97R validation drawdown. This is model research, not account-risk sizing. The simulation account risk governor can cap exposure, but it cannot turn a weak model into a valid one.

## Frozen Baseline

Keep `ifvg_fresh_retest_v3_research` immutable while experiments run.

Current reference evidence:

- 64 OOS trades
- 2/2 OOS windows passed
- 3.46R OOS mean
- 95% confidence interval approximately 2.33R to 4.79R
- low reported overfit risk
- 171 conservative-validation trades
- 2.83R conservative average
- 8.97R maximum drawdown
- 10 red drawdown clusters
- 76 estimated false positives
- NY AM and London session consistency red

No experiment may overwrite this profile or lower readiness thresholds. Every accepted change creates a new candidate profile version.

## Phase 1: Make False Positives Auditable

1. Define one deterministic false-positive contract. Separate invalidation-first outcomes from malformed setup detections and rejected/no-trade context.
2. Emit compact reason codes per completed replay outcome:
   - stale or reused FVG
   - weak displacement
   - no liquidity sweep
   - counter-HTF delivery
   - premium/discount mismatch
   - late retest or overextended entry
   - session-window mismatch
   - target/invalidation geometry failure
   - high spread or low-liquidity proxy
3. Rank reason clusters by frequency, total lost R, session, side, date, and rolling window.
4. Verify the current count of 76 is produced from completed candidate outcomes, not diagnostic/context rows.

Exit criterion: at least 90% of false positives have one primary causal reason and the count is reproducible from the frozen replay artifact.

## Phase 2: Session Isolation

Run the frozen profile independently for:

- NY AM only
- London only
- all other eligible sessions
- short and long within each session

For each lane record trades, independent dates, active windows, average/median R, profit factor, target-first, invalidation-first, drawdown, and cost sensitivity. Do not combine a strong session with a weak session in the headline result.

Exit criterion: at least one session has adequate samples on multiple dates/windows with non-red average R and stable cost-adjusted expectancy. A weak session is disabled only in a new candidate version after frozen OOS comparison.

## Phase 3: Drawdown Cluster Attribution

For each of the 10 red clusters, record compact telemetry:

- start/end date and session
- consecutive losses and cumulative R
- side and HTF alignment
- volatility/regime bucket
- FVG freshness, size, displacement, and retest age
- stop model and target type
- overlap with other active signals

Test whether drawdown is caused by one recurring setup condition, correlated same-session signals, a stop model, or a regime transition. Account-risk caps should be evaluated separately after model quality is measured.

Exit criterion: every red cluster has a reproducible causal label, and one-variable experiments identify whether model filtering or portfolio exposure control is the appropriate response.

## Phase 4: One-Variable Candidate Experiments

Create candidate versions one change at a time, in this order:

1. Exclude the largest verified false-positive reason.
2. Isolate the strongest session.
3. Require the strongest HTF alignment state if it improves independent OOS evidence.
4. Tighten FVG freshness/retest age only if the telemetry supports it.
5. Test one stop-model adjustment against unchanged entries and targets.

For every experiment compare against the frozen baseline using the same chronological train/OOS split, transaction-cost assumptions, and Monte Carlo seed policy.

Reject an experiment if it merely removes losses by collapsing the sample or concentrating outcomes on a few dates.

## Phase 5: Acceptance Gates

A candidate may advance only when all existing deterministic gates pass, including:

- sufficient completed trade sample
- at least two active independent rolling windows
- multiple independent trading dates
- positive untouched OOS expectancy and non-degrading OOS verdict
- strong or accepted Monte Carlo robustness
- conservative maximum drawdown at or below 4.00R
- zero red drawdown clusters under the current quality contract
- session consistency has at least one sufficiently sampled non-red lane
- false-positive pattern count meets the existing quality threshold
- source, profile, timeframe, and fingerprint match the active research identity

Research Ready, Paper-Demo Candidate, simulation-account risk approval, and MT5 demo submission remain separate gates.

## Autonomous Research Integration

After a cycle produces new completed outcomes, GoTrader should automatically run compact, bounded jobs in this order:

1. Replay outcome update
2. Frozen chronological walk-forward/OOS update
3. False-positive reason aggregation
4. Session consistency report
5. Drawdown-cluster report
6. Monte Carlo refresh
7. Evidence/maturity/readiness review

The loop may generate a draft experiment intent, but it must not mutate the frozen profile, lower a threshold, auto-promote readiness, or apply calibration without explicit operator opt-in.

## Recommended First Implementation

Build a deterministic `ResearchQualityFailureAttribution` artifact from existing replay outcomes. It should be compact, source/profile keyed, and contain the false-positive taxonomy, session matrix, and drawdown clusters. This gives Self-Improvement and the Research Committee a factual target for the next one-variable candidate instead of broadly tightening filters.

## Phase 1 Implementation Status

Implemented in the validation and Research Quality pipeline:

- validation now summarizes completed outcomes before discarding raw replay arrays;
- stop hits, expired outcomes, and rejected diagnostic context are distinct;
- IFVG replay outcomes carry compact pre-entry context without candles or broker data;
- source/profile/fingerprint identity is retained;
- session outcomes come from the canonical completed sample;
- drawdown clusters are chronological peak-to-recovery sequences;
- Self-Improvement receives the highest-priority factual experiment, but cannot apply it automatically;
- the false-positive gate uses attributable rate, causal-family count, and at least 90% attribution coverage instead of an absolute losing-trade limit.

The next empirical step is to rerun the frozen IFVG v3 validation so the current 171-trade sample is regenerated with compact setup-state telemetry. If attribution coverage remains below 90%, enrich only the missing pre-entry context before attempting Phase 2 session isolation.

## Phase 2 Implementation Status

Implemented for untouched forward evidence without changing either frozen IFVG profile:

- closed-candle observations retain allowlisted session, HTF alignment, retest freshness, displacement, and liquidity-target context;
- invalidation-first outcomes are attributed only from information recorded when the setup was issued;
- session and session/side lanes report completed outcomes, independent dates, active windows, target-first rate, expectancy, profit factor, chronological drawdown, and +0.25R/+0.50R cost stress;
- a lane cannot be classified `stable_research` without 20 outcomes, 10 dates, 2 windows, positive +0.50R expectancy, and drawdown at or below 4R;
- the existing forward collector and gateway export carry the compact quality summary without candle arrays or full trade records;
- profile mutation and readiness promotion remain disabled.

Historical validation trades and post-freeze forward observations remain separate populations. The next empirical task is collection: allow the MT5 closed-candle collector to accumulate enough v3/v4 outcomes for real session comparisons, then use the largest directly attributed invalidation family as the sole variable in a separately versioned candidate experiment.

## IFVG v4 Attribution Correction

The 180-day v4 replay exposed a correlation-only labeling defect. HTF context was unavailable on all 71 completed trades, including all 43 targets and all 28 stops, so it had no independent comparator. The old stop-only classifier nevertheless labeled every stop as caused by missing HTF context. Preferred-session status was also non-discriminating: the stop rate was 39.7% outside the preferred flag versus 37.5% inside it.

Research Quality now compares every candidate cause with an independently sampled complement before calling it causal. The same v4 sample therefore reports:

- 28 completed stop hits;
- 28 ordinary/unexplained model losses;
- zero causally qualified false positives;
- 100% compact context evaluated;
- missing HTF retained as an evidence gap, not a fabricated loss cause.

No strategy threshold or frozen profile changed. The next valid model experiment requires either a genuine HTF-aligned comparator or untouched forward evidence showing that a pre-entry flag materially separates losses from wins.
