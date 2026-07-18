# Positive Results Pipeline Audit

Date: 2026-07-18

## Decision

GoTrader did not have a universal strategy-edge failure. It had a production routing and observation failure around its strongest frozen research profile, `ifvg_fresh_retest_v3_research`.

The default operator cycle ran the generic strategy path on a 500-candle sample. It did not select the frozen IFVG v3 profile, even though the profile already had causal replay, rolling-window, chronological OOS, cost-sensitivity, and Monte Carlo evidence. Separately, the MT5 read-only refresh path updated canonical storage without publishing closed-candle events, so forward evidence could not accumulate.

## Evidence Already Available

The frozen 180-day IFVG v3 validation remains research-only and reports:

- 34,989 MT5 candles
- 172 completed outcomes
- 55.23% target-first
- 2.805R average outcome
- 5.979 profit factor
- 95 independent dates
- 11 of 11 positive rolling windows
- 2 of 2 frozen chronological OOS windows passed
- 64 OOS outcomes at 3.458R average and 8.081 profit factor
- 2.958R average after an additional 0.5R modeled cost
- strong Monte Carlo classification

These metrics are historical validation evidence. They are not an active market signal and do not approve Paper-Demo or execution readiness.

## Production Corrections

1. The operator research cycle now explicitly evaluates the frozen IFVG v3 profile on up to 1,000 current MT5 candles.
2. The frozen profile parameters are passed to the deterministic backtest instead of being evaluated through unrelated generic/Grinch metrics.
3. MT5 read-only activation and refresh snapshots now publish only confirmed closed candles to the canonical event bus.
4. App mount publishes at most the latest closed candle; it never replays historical bars as new forward evidence.
5. New closed candles resolve pending IFVG v3 observations and may create a new observation only when a fresh, clean, eligible retest is present on that close.
6. Forward evidence stores compact scenario metadata and outcomes only. Raw candles remain internal.

## End-To-End Result

The actual Dashboard operator cycle completed against the active MT5 read-only source with:

- 1,000 USTECH/MNQ-style 5-minute candles
- 3 completed IFVG v3 research outcomes
- 100% target-first on this small current window
- 7.91R average
- 99 profit factor
- 0R drawdown

This corrects the false zero-results presentation. It is a three-outcome sample and remains insufficient by itself for readiness.

The Results workspace continues to show the frozen 172-trade historical evidence and 64-trade chronological OOS evidence separately from the `0/40` forward ledger. It intentionally does not create dated calendar records from aggregate statistics.

## Current Market State

The latest closed MT5 candle does not currently complete an eligible fresh IFVG v3 setup. The live Current Market Brief therefore remains no-trade/watch-only. GoTrader must not turn a profitable historical profile into a present-tense signal when the current setup conditions are absent.

## Remaining Requirements

The strongest remaining weakness is untouched forward evidence, not historical analysis depth:

- collect at least 40 resolved forward outcomes
- cover at least 20 independent trading dates
- cover multiple forward windows
- preserve the frozen profile identity and source fingerprint
- keep replay, chronological OOS, and forward results separate
- rerun cost sensitivity and Monte Carlo on forward outcomes
- require the existing evidence, maturity, walk-forward, and Paper-Demo checklists

Broad strategy families with weak replay expectancy should remain rejected or research-only. Thresholds should not be lowered to manufacture activity.

## Safety

- executionAuthority: none
- brokerAuthority: none
- readinessOverrideAuthority: none
- MT5 remains read-only
- no readiness promotion from a backtest or forward observation
- no order, account, or position mutation
