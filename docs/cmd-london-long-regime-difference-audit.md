# CMD London-Long Causal Regime-Difference Audit

## Purpose

This audit compares the older pre-selection challenge with the recent discovery era using only information available when each CMD London-long opportunity was detected. It does not loosen thresholds, create execution authority, or promote readiness.

## Data

- Source: MT5 read-only USTECH CFD/proxy data for MNQ-style research
- Timeframe: 5m
- Candles: 35,541
- Lookback: 179.95 days
- Chunks: 18
- Causal CMD London-long candidates: 185
- Completed outcomes: 124

## Period result

| Period | Candidates | Completed | Target-first | Average R | PF | 0.25R cost average | 0.25R cost PF |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Older pre-selection | 125 | 92 | 32.61% | -0.0717R | 0.8936 | -0.3217R | 0.6181 |
| Recent discovery | 60 | 32 | 40.63% | +0.0942R | 1.1586 | -0.1558R | 0.7900 |

The broad v1 lane is unstable and fails costs in both periods.

## Regime differences

The recent period did not have stronger displacement, tighter consolidation, more FVG context, or higher average RR. The clearest causal difference was target construction:

- external-liquidity target rate increased from 15.20% to 36.67%
- bullish CISD context increased from 86.40% to 93.33%
- sweep quality increased slightly from 0.5979 to 0.6256
- displacement quality decreased from 0.7387 to 0.6659
- average RR decreased slightly from 1.9315 to 1.8668

Displacement, FVG, CISD, sweep-quality, and early-session filters did not independently pass both cost-gated periods.

## Candidate v2 hypothesis

`cmd_london_long_external_target_v2_research` retains only opportunities whose external-liquidity target was known at detection.

| Period | Completed | Target-first | Average R | PF | 0.25R cost average | 0.25R cost PF | Dates | Windows |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Older pre-selection | 19 | 52.63% | +0.3372R | 1.7118 | +0.0872R | 1.1472 | 17 | 3 |
| Recent discovery | 19 | 57.89% | +0.5270R | 2.2516 | +0.2770R | 1.5263 | 18 | 3 |
| Pooled | 38 | 55.26% | +0.4321R | 1.9658 | +0.1821R | 1.3256 | 35 | 6 |

The pooled lower 95% expectancy bound is +0.0157R, but each period's lower bound remains below zero. The filter was also selected after this audit. It is therefore a promising research hypothesis, not a validated executable profile.

## Decision

- Retire v1: yes
- Freeze external-target v2 hypothesis: yes
- Make v2 executable: no
- Issue generic scenario-map observations: no
- Issue detector-specific closed-candle observations: yes, for a fresh post-freeze cohort only
- Inherit v1 or retrospective outcomes: no
- Paper-Demo promotion: no
- Readiness promotion: no

The prediction ledger now connects a closed-candle CMD detector result directly to a compact forward observation only when `targetBasis` is `external_liquidity`, the exact London-long 5m selector matches, the MT5 fingerprint is trusted, and the signal timestamp is later than the frozen v2 creation time. The cohort starts with zero inherited outcomes. Generic scenario-map observations remain ineligible for this profile, and no observation creates evidence, Paper-Demo eligibility, or execution authority by itself.

## Safety

- executionAuthority: none
- brokerAuthority: none
- readinessOverrideAuthority: none
- raw candles and snapshots remain internal
- executable profile not created
- auto-promotion disabled
