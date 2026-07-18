# Asia Displacement/FVG Stability Audit

## Purpose

This audit evaluates the exact research cohort discovered by the causal market-episode scan:

- family: `displacement_fvg_continuation`
- session: `asia`
- side: `short`
- source: MT5 read-only USTECH for MNQ-style research
- timeframe: 5m

The profile is research-only. It cannot create evidence, Paper-Demo eligibility, readiness, or execution authority.

## Selection disclosure

The cohort was selected after recent historical outcomes were inspected. A chronological split of the same 180-day history is therefore a stability stress test, not untouched OOS proof. Historical results from this audit must never be inserted into a future forward-observation cohort.

## Gates

Both earlier and recent periods must provide at least 20 completed outcomes, at least 10 independent dates, and at least two active 30-day windows. Both periods must remain positive after a 0.25R cost. The pooled cohort must remain positive after a 0.5R cost.

Passing those gates permits only a separately named frozen forward-research hypothesis. It does not make the current candidate executable or Paper-Demo eligible.

## Result

The broad Asia-short cohort failed the stability gate. Its earlier period averaged `-0.1846R` after 0.25R cost, and its pooled sample averaged `-0.2714R` after 0.5R cost.

The causal external-target subgroup was materially different:

| Period | Completed | Average R | 0.25R cost | 0.5R cost | PF at 0.5R | Dates | Windows |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Earlier | 23 | 0.6017R | 0.3517R | 0.1017R | 1.1733 | 14 | 3 |
| Recent | 37 | 0.5312R | 0.2812R | 0.0312R | 1.0453 | 24 | 3 |
| Pooled | 60 | 0.5583R | 0.3082R | 0.0582R | 1.0896 | 38 | 6 |

The projected-target control was negative after cost. This supports freezing `asia_displacement_fvg_short_external_target_v2_research` as a new forward-research hypothesis only. The filter was discovered during this audit, so all 60 historical outcomes remain selection-contaminated and are excluded from its forward cohort.

The frozen v2 profile accepts only exact post-freeze, closed-candle MT5 matches. It begins with zero outcomes, an uncalibrated probability, no Paper-Demo eligibility, and no inherited evidence.

## Safety

- Raw candles stay internal to the explicit CLI diagnostic.
- Compact results contain only metrics, source provenance, blockers, and authority.
- `executionAuthority`, `brokerAuthority`, and `readinessOverrideAuthority` remain `none`.
- Auto-promotion and execution intent creation remain disabled.
