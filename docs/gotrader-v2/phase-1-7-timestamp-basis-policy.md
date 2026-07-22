# Phase 1.7 Timestamp Basis Policy

## Classifications

- `verified_utc_epoch`: terminal quote, Python tick, terminal GMT, and trusted system UTC agree without an unexplained offset.
- `verified_trade_server_wall_clock`: Python and terminal quote/server values agree, while both have the same measured nonzero offset from GMT/system UTC.
- `verified_symbol_quote_time_basis`: Python matches the terminal symbol quote, but normalization semantics remain unverified.
- `verified_terminal_calculated_server_time`: reserved for deterministic terminal-calculated server-time parity.
- `current_offset_verified_only`: the current offset is measured but the complete server-time relationship is not proven.
- `conflicting_terminal_evidence`: valid terminal and Python observations materially disagree.
- `insufficient_evidence`: the capture is stale, unsynchronized, partial, missing, or outside correlation limits.
- `unknown`: schema or authority validation failed.

## Correlation Rules

- observation age: at most 120 seconds;
- system capture window: at most 30 seconds;
- selected quote versus `TimeCurrent`: at most 30 seconds;
- Python and terminal observed offset agreement: observation age plus 5 seconds;
- Python and terminal M5 bar-open parity: exact within 1 second;
- differences over one M5 interval are hard blockers;
- `SYMBOL_TIME_MSC` and Python `time_msc` are preferred when available.

Raw integer values and exact millisecond deltas are retained in diagnostic output. No delta is rounded before classification.

## Verification Scopes

```text
none
current_live
historical
```

`current_live` never unlocks historical Phase 2 processing. A contract at version `1.1.0` may be globally `verified` only when `historicalDstPolicyVerified` is true and the scope is `historical`.

Current-live wall-clock verification remains `observed_candidate` in the Phase 1.6 status vocabulary. This prevents the legacy `verified` word from overstating a single seasonal observation.

## Identity

Stable identity includes the time-contract version, verification status, terminal-clock classification version, and verification scope. Volatile observation IDs, capture times, raw clocks, and measured deltas are excluded from identity.

The legacy candle fingerprint remains unchanged.
