# CMD Deep Telemetry Audit

Generated: 2026-07-13T19:37:24.966Z

Scope: research telemetry and variant discovery only. No broker execution, live trading, order placement, MT5 mutation, readiness override, OpenClaw auto-apply, calibration apply, or Paper-Demo promotion was added.

Authority remains:

- `executionAuthority: none`
- `brokerAuthority: none`
- `readinessOverrideAuthority: none`

Raw candles remain internal to the replay harness and are not written to this report.

## Data Depth

- Provider: `mt5_read_only`
- Requested symbol: `MNQ`
- Broker symbol: `USTECH`
- Timeframe: `5m`
- Compact candles evaluated internally: 17521
- Available lookback: 90 days
- Completed chunks: 9
- Replay windows evaluated: 2500
- Replay budget note: The diagnostic fetches explicit 90-day MT5 range history, then evaluates a deterministic stratified replay-window budget across the full period. Increase ICT_CMD_TELEMETRY_MAX_WINDOWS for a slower denser sweep.

## Winning CMD Cluster Summary

- Paper-watchlist candidates: 6
- Winners: 6
- Target-first: 100.00%
- Invalidation-first: 0.00%
- Unique dates: 6
- Active rolling windows: 5
- Repeatability classification: `insufficient_independent_dates`
- Top sessions: `{"new_york_pm":5,"new_york_lunch":1}`
- HTF alignment: `{"missing":6}`
- FVG respected: `{"false":5,"true":1}`
- Sweep quality: `{"strong":6}`
- Manipulation depth: `{"low":4,"medium":2}`

## Losing CMD Comparison

- Losing/filtered CMD telemetry rows: 1474
- Loser target-first: 10.65%
- Loser invalidation-first: 2.65%

| Feature | Winners | Losers | Note |
| --- | ---: | ---: | --- |
| fvg_present_at_signal | 1 | 1 | Compares signal-time FVG presence only; post-entry FVG respect is excluded from variant selection. |
| external_liquidity_target_present | 1 | 1 | CMD paper-watchlist already requires this context; telemetry checks whether losers lacked the same quality. |
| average_displacement_score | 5.1349 | 1.1787 | Displacement is normalized by compact risk distance, not by raw candle arrays. |
| htf_aligned_share | 0 | 0 | Shows whether the winning CMD cluster needed HTF support or worked as a lower-timeframe paper idea. |
| smt_confirmed_share | 0 | 0 | SMT is optional; this highlights whether it is worth making a separate candidate family. |

## Variant Discovery

| Variant | Candidates | Target-first | Invalidation-first | Avg RR | Median RR | Dates | Windows | Classification | Next action |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `cmd_short_clean_expansion` | 24 | 83.33% | 16.67% | 4.0072 | 3.0514 | 10 | 5 | repeatable_variant_candidate | Run a dedicated executable-variant diagnostic with replay and walk-forward gates. |
| `cmd_short_high_displacement_fvg_present` | 86 | 82.56% | 17.44% | 4.7757 | 3.1815 | 20 | 6 | repeatable_variant_candidate | Run a dedicated executable-variant diagnostic with replay and walk-forward gates. |
| `cmd_short_ny_session_only` | 104 | 79.81% | 20.19% | 4.0346 | 2.3027 | 20 | 6 | repeatable_variant_candidate | Run a dedicated executable-variant diagnostic with replay and walk-forward gates. |
| `cmd_short_strong_sweep_quality` | 34 | 79.41% | 20.59% | 3.0295 | 2.3027 | 10 | 5 | repeatable_variant_candidate | Run a dedicated executable-variant diagnostic with replay and walk-forward gates. |
| `cmd_short_external_liquidity_target` | 109 | 78.90% | 21.10% | 4.0347 | 2.3865 | 20 | 6 | repeatable_variant_candidate | Run a dedicated executable-variant diagnostic with replay and walk-forward gates. |
| `cmd_short_high_displacement_fvg_valid_rr` | 60 | 76.67% | 23.33% | 6.3701 | 4.1055 | 19 | 6 | repeatable_variant_candidate | Run a dedicated executable-variant diagnostic with replay and walk-forward gates. |
| `cmd_short_smt_confirmed` | 0 | 0.00% | 0.00% | 0.0000 | 0.0000 | 0 | 0 | insufficient_independent_dates | Run a dedicated executable-variant diagnostic with replay and walk-forward gates. |
| `cmd_short_htf_aligned` | 0 | 0.00% | 0.00% | 0.0000 | 0.0000 | 0 | 0 | insufficient_independent_dates | Run a dedicated executable-variant diagnostic with replay and walk-forward gates. |

## Independent-Date Availability

Similar-feature candidates found on 5 trading date(s).

The signature appears on enough dates for a future executable variant test, but it still needs normal replay/OOS gates.

## Recommendation

Best next variant candidate: `cmd_short_clean_expansion`. Keep it research-only and run a dedicated executable-variant diagnostic with independent-date gates.

Do not promote CMD to Paper-Demo or approved status from this audit.

## Next Standalone Detector Recommendation: IFVG

CMD remains date-concentrated, so the next standalone detector should be IFVG v1 rather than another CMD promotion attempt.

IFVG v1 plan:

- Timeframe: `5m` or `15m`.
- Identify a fair value gap that is fully traded through.
- Former bearish FVG becomes bullish support for a long candidate.
- Former bullish FVG becomes bearish resistance for a short candidate.
- Entry: 50% of the inverted FVG zone.
- Stop: beyond the IFVG boundary.
- Target: next draw on liquidity.
- Minimum RR: `2R`.
- Block reused IFVG zones.
- Block against HTF trend.
- Block low-volume sessions.
- Block mock/sample sources.
- Require replay, walk-forward, independent-date, and OOS validation before any Paper-Demo progression.
