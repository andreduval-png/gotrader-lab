# IFVG Fresh Retest v3 Validation Audit

Generated: 2026-07-13

## Decision

`ifvg_fresh_retest_v3_research` is the first GoTrader detector profile in the current audit sequence to show a positive, causal research edge across the available MT5 read-only USTECH history. It remains research-only and is not a Paper-Demo or execution candidate.

## Source

- Provider: MT5 read-only
- Requested symbol: MNQ
- Broker symbol: USTECH
- Timeframe: 5m
- Explicit lookback: 180 days
- Normalized candles: 34,989
- Range: 2026-01-15 through 2026-07-14
- Source warning: USTECH is CFD/proxy data for MNQ-style research, not CME MNQ futures truth.

## Causal profile

The profile requires:

- a validation-eligible base IFVG;
- an unused zone before inversion;
- a clean return into the inverted FVG;
- the retest on the latest closed evaluation candle;
- no post-entry confirmation lookahead;
- complete entry, invalidation, target, and realistic RR;
- research-only authority.

## Full-history result

| Metric | Result |
|---|---:|
| Completed research trades | 172 |
| Target-first | 55.23% |
| Average R | 2.805R |
| Median R | 2.763R |
| Profit factor | 5.979 |
| Max drawdown | 8.966R |
| Unique trading dates | 95 |
| Positive overlapping 30-day windows | 11 / 11 |

The first half produced 86 trades at 2.252R average and PF 4.567. The second half produced 86 trades at 3.357R average and PF 7.781. This is not a one-date cluster.

## Frozen chronological holdout

GoTrader now reserves the trailing one-third of the source as a chronological holdout and evaluates it in non-overlapping 30-day windows. The profile is frozen; the holdout does not tune parameters.

| Metric | Result |
|---|---:|
| OOS windows passed | 2 / 2 |
| OOS trades | 64 |
| Unique OOS dates | 34 |
| Pooled OOS average R | 3.458R |
| Pooled OOS profit factor | 8.081 |
| OOS expectancy verdict | positive_edge |
| Additional 0.5R cost average | 2.958R |
| Additional 0.5R cost verdict | positive_edge |

Verdict: `passed` for frozen-profile chronological holdout validation.

This is stronger than a random train/test split, but it is still development-era historical evidence. It is not untouched future-market proof.

## Monte Carlo

The deterministic bootstrap used 2,000 paths of 100 trades:

- robustness: strong;
- median ending result: 278.269R;
- fifth-percentile ending result: 208.197R;
- median max drawdown: 6.395R;
- 95th-percentile max drawdown: 10.454R;
- worst simulated max drawdown: 20.921R;
- research risk of ruin at -20R: 0%;
- maximum research risk suggestion: 0.5% per idea.

Monte Carlo is a distribution test of historical R outcomes. It is not a promise of future returns.

## Auto Research correction

The previous full Auto Research path incorrectly judged detector profiles through the generic agent/Grinch validation suite. That path produced a different 1,270-trade population, treated detector blockers as skipped generic signals, did not run walk-forward, and rejected the profile for an invalid comparison.

Detector profiles now use their own causal backtest outcomes and a compact frozen-profile chronological holdout validator. The result remains:

- recommendation: `keep_testing`;
- promotion verdict: `needs_follow_up`;
- readiness: `Not Ready`;
- auto-apply: blocked;
- authority: none / none / none.

## Live identification

The Advisor/current-opportunity path now consumes a compact IFVG v3 assessment. Raw candles remain internal. A live candidate is exposed only when the latest closed candle is the clean retest and all trade-construction fields are complete. Historical strength does not force a current signal.

The latest 1,000-candle tactical window contained four completed historical profile outcomes. This sample is informative but too small to replace the 180-day validation result or to imply that a candidate is active now.

## Next step

Freeze IFVG v3 and collect an untouched forward sample. Do not tune the profile against that sample. After enough new outcomes accumulate, rerun:

1. chronological OOS validation;
2. cost sensitivity;
3. evidence quality review;
4. maturity review;
5. Paper-Demo checklist.

No threshold loosening or additional strategy discovery is recommended before forward evidence tests whether this edge persists.

## Safety

- `executionAuthority: none`
- `brokerAuthority: none`
- `readinessOverrideAuthority: none`
- no broker execution
- no order/account/position mutation
- no automatic readiness or Paper-Demo promotion
