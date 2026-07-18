# IFVG Filter Variant Audit

Generated from `npm.cmd run test:ifvg-filter-variants` on explicit MT5 read-only history.

## Scope

- Base strategy: `ifvg_v1`
- Source: MT5 read-only CFD/proxy candles
- Requested symbol: `MNQ`
- Broker symbol: `USTECH`
- Authority: `executionAuthority none`, `brokerAuthority none`, `readinessOverrideAuthority none`
- Data policy: raw candles stayed internal to the CLI diagnostic; this report stores compact metrics only.

## Gate Summary

| Gate | Required |
|---|---|
| Candidates | >= 20 |
| Unique dates | >= 3 |
| Active rolling windows | >= 2 |
| Weak rolling windows | 0 |
| Target-first | >= 55.00% |
| Invalidation-first | <= 35.00% |
| OOS | cannot degrade/fail |
| Cost sensitivity | average R positive after 0.5R and 1.0R cost |
| Source | no mock/sample source |
| Authority | none/none/none |

## Variant Results

| Variant | Candidates | Dates | Windows | Weak Windows | Target-first | Invalidation-first | Avg R | Avg R @ 0.5R | Avg R @ 1R | Profit Factor | Max DD R | OOS | Classification | Failed Gates |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| clean_retest_displacement | 16 | 15 | 5 | 1 | 68.75% | 31.25% | 5.606 | 5.106 | 4.606 | 18.9392 | 2 | insufficient_data | insufficient_data | candidate_count, rolling_window_stability |
| clean_retest_only | 76 | 46 | 5 | 1 | 59.21% | 40.79% | 3.7379 | 3.2379 | 2.7379 | 10.1638 | 4 | passed | needs_filtering | rolling_window_stability, invalidation_first_rate |
| rr_2_to_3 | 31 | 25 | 5 | 2 | 58.06% | 41.94% | 1.0507 | 0.5507 | 0.0507 | 3.5056 | 6 | passed | needs_filtering | rolling_window_stability, invalidation_first_rate |
| rr_3_to_5 | 112 | 56 | 5 | 3 | 55.36% | 44.64% | 1.7767 | 1.2767 | 0.7767 | 4.9797 | 5 | passed | needs_filtering | rolling_window_stability, invalidation_first_rate |
| short_htf_aligned | 140 | 52 | 5 | 3 | 55.00% | 45.00% | 4.0659 | 3.5659 | 3.0659 | 10.0354 | 5 | passed | needs_filtering | rolling_window_stability, invalidation_first_rate |
| london_open_longs | 22 | 17 | 5 | 2 | 54.55% | 45.45% | 3.2024 | 2.7024 | 2.2024 | 8.0453 | 3 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| premium_discount_aligned | 166 | 58 | 5 | 3 | 53.01% | 46.99% | 3.6331 | 3.1331 | 2.6331 | 8.7321 | 5 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| ny_open_shorts | 29 | 21 | 5 | 4 | 51.72% | 48.28% | 4.2802 | 3.7802 | 3.2802 | 9.8661 | 5 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| fifteen_minute_only | 123 | 50 | 5 | 4 | 50.41% | 49.59% | 3.8825 | 3.3825 | 2.8825 | 8.8287 | 7 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| htf_aligned_only | 312 | 70 | 5 | 4 | 49.68% | 50.32% | 3.5288 | 3.0288 | 2.5288 | 8.0126 | 8.1352 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| displacement_confirmation | 69 | 46 | 5 | 4 | 49.28% | 50.72% | 3.7191 | 3.2191 | 2.7191 | 8.332 | 6 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| short_only | 247 | 63 | 5 | 5 | 48.58% | 51.42% | 3.4117 | 2.9117 | 2.4117 | 7.6354 | 6 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| ny_open_only | 44 | 28 | 5 | 5 | 47.73% | 52.27% | 3.6915 | 3.1915 | 2.6915 | 8.062 | 6 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| small_ifvg | 485 | 71 | 5 | 5 | 46.39% | 53.61% | 3.339 | 2.839 | 2.339 | 7.2285 | 9 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| first_ifvg_use_only | 518 | 71 | 5 | 5 | 46.33% | 53.67% | 3.1964 | 2.6964 | 2.1964 | 6.9559 | 9 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| external_liquidity_target_present | 518 | 71 | 5 | 5 | 46.33% | 53.67% | 3.1964 | 2.6964 | 2.1964 | 6.9559 | 9 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| medium_ifvg | 33 | 22 | 5 | 5 | 45.45% | 54.55% | 1.1013 | 0.6013 | 0.1013 | 3.0191 | 4 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| five_minute_only | 395 | 69 | 5 | 5 | 45.06% | 54.94% | 2.9828 | 2.4828 | 1.9828 | 6.4294 | 9 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| medium_ifvg_htf_aligned | 20 | 16 | 5 | 4 | 45.00% | 55.00% | 1.0081 | 0.5081 | 0.0081 | 2.8329 | 3 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| ny_open_htf_aligned | 27 | 19 | 5 | 5 | 44.44% | 55.56% | 3.2777 | 2.7777 | 2.2777 | 6.8999 | 4 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| long_only | 271 | 69 | 5 | 5 | 44.28% | 55.72% | 3.0002 | 2.5002 | 2.0002 | 6.3844 | 7 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| medium_ifvg_clean_retest | 7 | 7 | 5 | 5 | 42.86% | 57.14% | 1.2889 | 0.7889 | 0.2889 | 3.2556 | 2 | insufficient_data | insufficient_data | candidate_count, rolling_window_stability, target_first_rate, invalidation_first_rate |
| rr_5_plus | 375 | 71 | 5 | 5 | 42.67% | 57.33% | 3.7978 | 3.2978 | 2.7978 | 7.6241 | 8 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| ny_open_longs | 15 | 11 | 5 | 4 | 40.00% | 60.00% | 2.5534 | 2.0534 | 1.5534 | 5.2557 | 3 | insufficient_data | insufficient_data | candidate_count, rolling_window_stability, target_first_rate, invalidation_first_rate |
| london_open_shorts | 23 | 19 | 5 | 5 | 39.13% | 60.87% | 2.1956 | 1.6956 | 1.1956 | 4.607 | 4 | passed | needs_filtering | rolling_window_stability, target_first_rate, invalidation_first_rate |
| large_ifvg | 0 | 0 | 0 | 0 | 0.00% | 0.00% | 0 | 0 | 0 | 0 | 0 | insufficient_data | too_strict | candidate_count, unique_trading_dates, active_rolling_windows, target_first_rate, half_r_cost_expectancy, one_r_cost_expectancy |

## Passing Variants

- None.

## Best Blocked Variants

- `clean_retest_displacement`: 68.75% target-first, 31.25% invalidation-first, 16 candidates, failed gates: candidate_count, rolling_window_stability
- `clean_retest_only`: 59.21% target-first, 40.79% invalidation-first, 76 candidates, failed gates: rolling_window_stability, invalidation_first_rate

## Promotion Decision

No IFVG v2 filter passes all gates. Keep IFVG v1 as needs_filtering and do not register a filtered v2 paper-watchlist strategy yet.

## Advisor / OpenClaw Status

Advisor should say: positive expectancy but invalidation-first too high; filtering required. OpenClaw intents should reference ifvg_v1 with needs_filtering status.

## Recommendation

Best blocked variant is `clean_retest_displacement`; fix candidate_count, rolling_window_stability before considering a filtered executable variant.

## Safety Result

- no raw candles
- no raw snapshots
- no secrets
- no account/order/position data
- no broker mutation
- no order placement
- no readiness override
- authority `none/none/none`
