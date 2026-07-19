# IFVG v4 Forward Collector Audit

Date: 2026-07-19

## Decision

GoTrader already had a causal browser-side forward collector connected to canonical MT5 closed-candle events. The remaining operational gap was fail-closed identity enforcement and observability, not another replay or a looser IFVG profile.

## Corrections

- Forward collection now requires the exact frozen identity: MT5 source, MNQ requested symbol, USTECH broker symbol, 5-minute timeframe, non-empty source fingerprint, closed candle, and read-only source authority.
- The collection boundary is the later of `validationCutoff` and `frozenAt`. A v4 setup from before the v4 profile existed cannot be counted as v4 forward evidence.
- An observation must be issued at or after its setup candle and must refer to the latest closed candle being processed.
- Other symbols and timeframes cannot be relabeled as frozen-profile evidence.
- Compact collector status records whether the listener is active, the latest decision, processed close count, observation count, outcome-update count, and blocker reason.
- Raw candles remain internal and are not stored in the ledger or collector diagnostics.

## Current Market State

The local MT5 stack is healthy, but the latest USTECH 5-minute candle is from the prior market session. The v4 profile was frozen after that candle. Therefore the correct v4 state is to wait for a genuinely new post-freeze close; historical bars must not be backfilled as untouched evidence.

## Progression Rule

The collector may record and resolve qualifying observations. It cannot promote readiness. Deterministic reassessment still requires 40 completed outcomes across 20 independent dates and 2 forward windows.

## Safety

- executionAuthority: none
- brokerAuthority: none
- readinessOverrideAuthority: none
- MT5 market-data access remains read-only
- no order, account, or position mutation
- no automatic Paper-Demo promotion
