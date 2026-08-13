# IFVG Performance Audit

Generated from `npm.cmd run test:ifvg-performance` on explicit MT5 read-only history.

## Scope

- Strategy: `ifvg_v1`
- Source: MT5 read-only CFD/proxy candles
- Requested symbol: `MNQ`
- Broker symbol: `USTECH`
- Authority: `executionAuthority none`, `brokerAuthority none`, `readinessOverrideAuthority none`
- Data policy: raw candles stayed internal to the CLI diagnostic; the report uses compact counts only.

## Data Depth

| Timeframe | Candles | Chunks | Lookback | Status |
|---|---:|---:|---:|---|
| 5m | 17,521 | 7 | 90 days | sufficient |
| 15m | 5,841 | 7 | 90 days | sufficient |
| 1h | 1,461 | 7 | 90 days | sufficient |

USTECH is MT5 read-only CFD/proxy data for requested MNQ, not CME futures truth.

## Detector Funnel

| Metric | Count |
|---|---:|
| Evaluated windows | 4,802 |
| Setup-condition hits | 4,802 |
| Blocked candidates | 512 |
| No-trade windows | 0 |
| Insufficient-data windows | 0 |
| Valid replay candidates | 650 |

Top blockers:

| Blocker | Count |
|---|---:|
| IFVG zone was already used before inversion. | 332 |
| IFVG direction is against available HTF context. | 155 |
| unrealistic_rr | 25 |

## Performance Summary

| Segment | Candidates | Target-first | Invalidation-first | Stalled | Avg RR | Median RR |
|---|---:|---:|---:|---:|---:|---:|
| All IFVG | 650 | 57.85% | 42.15% | 0 | 8.4566 | 7.6867 |
| 5m | 484 | 58.68% | 41.32% | 0 | 8.4005 | 7.6436 |
| 15m | 166 | 55.42% | 44.58% | 0 | 8.6202 | 7.8764 |
| long | 326 | 59.51% | 40.49% | 0 | 8.2526 | 7.5962 |
| short | 324 | 56.17% | 43.83% | 0 | 8.6618 | 7.7457 |
| london_open | 59 | 71.19% | 28.81% | 0 | 7.943 | 6.1932 |
| new_york_open | 47 | 48.94% | 51.06% | 0 | 9.5551 | 8.0778 |
| other_rth | 161 | 58.39% | 41.61% | 0 | 8.6586 | 8.0101 |
| outside_rth | 383 | 56.66% | 43.34% | 0 | 8.316 | 7.5866 |

## Rolling / OOS

| Window | Dates | Candidates | Target-first | Invalidation-first |
|---|---|---:|---:|---:|
| 1 | 2026-04-23 to 2026-05-23 | 209 | 56.46% | 43.54% |
| 2 | 2026-05-08 to 2026-06-07 | 216 | 60.19% | 39.81% |
| 3 | 2026-05-23 to 2026-06-22 | 216 | 59.26% | 40.74% |
| 4 | 2026-06-07 to 2026-07-07 | 233 | 58.37% | 41.63% |
| 5 | 2026-06-22 to 2026-07-22 | 225 | 57.78% | 42.22% |

First half:
- Candidates: 325
- Target-first: 58.15%
- Invalidation-first: 41.85%

Second half:
- Candidates: 325
- Target-first: 57.54%
- Invalidation-first: 42.46%

OOS verdict: `passed`.

## Robustness Classification

`needs_filtering`

## Promotion Decision

Do not promote IFVG; keep replay-required/research-only until replay, OOS, evidence, maturity, and checklist gates improve.

## Recommendation

IFVG v1 is now measurable as an executable research detector. Treat strategy rejection as a valid outcome. Only consider a narrower variant if this audit shows an independent-date, OOS-stable paper-watchlist signal. Recognition alone is not evidence.

## Safety Result

- no raw candles
- no raw snapshots
- no secrets
- no account/order/position data
- no broker mutation
- no order placement
- no readiness override
- authority `none/none/none`
