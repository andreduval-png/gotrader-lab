# CMD London-Long Frozen Validation Audit

## Corrected decision

`cmd_london_long_episode_v1` is retired. It cannot issue forward observations, create calibrated probabilities, or progress to Paper-Demo.

The original discovery result used each completed trading day's median body and range to recognize earlier events in that day. Later candles therefore influenced historical signal thresholds. The reconstruction now uses only the prior 48 candles at each event timestamp. A regression test verifies that appending extreme future volatility does not change earlier event recognition.

This was a research-validity defect, not an execution defect. Authority remains none / none / none.

## Causally corrected evidence

The explicit 180-day MT5 scan returned 35,541 compact 5m candles across 179.95 days.

| Period | Candidates | Completed | Target-first | Average R | Profit factor | Independent dates |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Recent 90-day discovery era | 60 | 32 | 40.63% | +0.0942R | 1.1586 | 35 |
| Older pre-selection challenge | 125 | 92 | 32.61% | -0.0717R | 0.8936 | 53 |
| Pooled 180-day history | 185 | 124 | 34.68% | -0.0289R | 0.9558 | 88 |

The 0.25R cost challenge is negative in both periods. Only one of three older chronological windows is positive before costs. V1 therefore fails the retrospective robustness gate.

## Profile state

- Status: `retired_causal_reconstruction_leakage`
- Source: MT5 read-only USTECH CFD/proxy data for MNQ-style research
- Timeframe: 5m
- Family: consolidation/manipulation/distribution
- Session: London
- Side: long
- Mutation: prohibited
- Forward observation: disabled
- Paper-Demo: disabled
- Auto-promotion: disabled

Existing v1 prediction-ledger records remain historical audit records. No new v1 record can be issued.

## Next action

Use only causal features known at signal time to compare the older and recent periods. A separately named v2 may be frozen as a research hypothesis only if it is positive in both periods after costs. It must not inherit v1 evidence or permissions.

## Safety

- executionAuthority: none
- brokerAuthority: none
- readinessOverrideAuthority: none
- raw candles excluded from reports and ledgers
- account, order, and position data excluded
- execution intent not created
- auto-promotion disabled
