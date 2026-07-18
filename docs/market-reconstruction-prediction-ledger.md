# Market Reconstruction and Prediction Ledger

## Purpose

GoTrader now separates two jobs that are easy to blur together:

1. **Historical market reconstruction** explains what actually happened after a trading day is complete.
2. **Forward prediction tracking** records what GoTrader expected before later candles revealed the outcome.

This separation is required for honest research. Historical labels may discover model families, but they cannot be counted as live forecasts. A forecast becomes measurable evidence only from closed candles whose timestamps are later than its `asOfTimestamp`.

## Historical Market Episodes

`src/lib/marketEpisodes` converts internal canonical candles into compact causal episodes. It detects deterministic event sequences such as:

- session reference opens;
- range consolidation;
- liquidity sweep and rejection;
- displacement and expansion;
- fair value gaps;
- change in state of delivery.

The first opportunity families are deliberately narrow:

- consolidation, manipulation, distribution;
- session raid reversal;
- displacement plus FVG continuation.

Each reconstructed opportunity records the information that was available at detection, then resolves target or invalidation using only subsequent candles. It stores compact features and outcomes, never candle arrays.

Reconstruction is a discovery and audit tool. It does not create evidence, readiness, paper-demo eligibility, or execution authority by itself.

## Universal Prediction Ledger

`src/lib/predictionLedger` converts the existing Forward Scenario Map into a compact timestamped prediction. It records:

- source provider and fingerprint;
- requested and broker symbols;
- timeframe and model version;
- scenario family and direction;
- conditional entry, invalidation, and target references;
- probability estimate and its source;
- lifecycle and eventual outcome;
- independent date and calibration metadata.

The lifecycle is:

`observed_context -> anticipated -> forming -> armed -> triggered -> resolved|invalidated|expired`

A prediction without a complete direction, entry zone, invalidation, and target is stored as context-only and cannot become actionable research evidence.

## Event-Driven Outcome Updates

The research cycle issues one prediction from the same compact Forward Scenario Map supplied to Auto Research. Mock/sample sources and sources without a fingerprint are excluded.

The MT5 push-feed event bus updates the ledger only on canonical `candle_closed` events. It does not rerun the research cycle, write candle arrays, call a broker, or create an execution intent.

The frozen `cmd_london_long_external_target_v2_research` hypothesis has a separate detector-specific subscription. A new ledger entry is allowed only when the just-closed 5m MT5 candle causally produces a London-long CMD opportunity with an external-liquidity target, complete entry/invalidation/target references, at least 1.5R, and a post-freeze timestamp. The v2 cohort never imports the retired v1 outcomes. Generic scenario-map output cannot enter this cohort.

The same shared closed-candle reconstruction pass also evaluates `asia_displacement_fvg_short_external_target_v2_research`. It requires an Asia-session bearish displacement/FVG continuation with an external-liquidity target known at detection. Its 60 historical discovery outcomes are explicitly excluded; only post-freeze matches can enter its compact forward cohort.

## Probability Honesty

Initial scenario probabilities are labeled `heuristic_uncalibrated`. They are explanatory scores, not measured win probabilities.

Measured calibration requires causal completed forecasts and checks:

- at least 20 completed forecasts;
- at least 3 independent trading dates;
- at least 2 active 30-day windows;
- positive realized R expectancy;
- Brier score at or below 0.25.

A high target-first rate is not enough. The classifier keeps a high-hit-rate family blocked when realized R expectancy is negative. Calibration never promotes readiness automatically.

## Learning Loop

The intended research loop is:

1. reconstruct historical episodes;
2. compare winning and losing feature sequences;
3. draft a new candidate family or profile version;
4. replay and walk-forward test it chronologically;
5. issue timestamped forward predictions;
6. resolve them from later MT5 closed candles;
7. calibrate probability and expectancy across independent dates and windows;
8. send only compact summaries into Self-Improvement and the Research Committee.

An LLM may explain results or draft a proposal intent. It cannot label outcomes, alter stored candles, approve readiness, apply calibration, call MT5, or execute a trade.

## Initial 90-Day Baseline

The explicit MT5 reconstruction command processed 17,796 USTECH 5m candles covering 88.95 days and 78 independent trading dates. The first broad event rules reconstructed 1,436 opportunities:

- consolidation/manipulation/distribution: 430 candidates, 32.68% target-first, -0.0782R average;
- session raid reversal: 437 candidates, 32.70% target-first, -0.0783R average;
- displacement plus FVG continuation: 569 candidates, 38.46% target-first, +0.0985R average.

This is a discovery baseline, not a profitable model. It shows why GoTrader must compare narrower session/side variants and validate them chronologically instead of promoting broad pattern recognition. The variant-discovery layer may recommend a new draft profile only when it has enough completed outcomes, independent dates, active windows, positive expectancy, and profit factor. Every recommendation remains draft-only and must pass replay, cost, walk-forward, and forward-prediction checks.

The initial variant scan found in-sample combinations worth testing, led by a London-long sweep/displacement cohort with 23 completed outcomes across 23 dates. It also found that the CMD and session-raid labels overlap on that exact cohort. Variant discovery fingerprints cohorts and marks repeated labels as `duplicate_cohort`, so the same historical events cannot be presented as independent model confirmation.

## Safety Boundary

- `executionAuthority: none`
- `brokerAuthority: none`
- `readinessOverrideAuthority: none`
- raw candles remain internal
- raw snapshots remain internal
- `autoPromotionAllowed: false`
- `executionIntentCreated: false`

This layer improves anticipation and measurement. It does not claim profitability and it does not add an execution path.
