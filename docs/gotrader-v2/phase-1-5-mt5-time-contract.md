# GoTrader V2 Phase 1.5 MT5 Time Contract

## Boundary

This contract applies only to the shadow V2 read-only candle repository. It does not change the production MT5 client, canonical source manager, research cycle, detectors, session logic, evidence, readiness, UI, Paper-Demo, OpenClaw, or broker code.

Authority remains:

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

## Discovery Result

The local MT5 upstream currently receives `tick.time` and `copy_rates_*().time` as numeric values. `scripts/mt5-readonly-upstream.py` passes those values directly to `datetime.fromtimestamp(value, timezone.utc)`. The wrapper then parses that ISO value without any additional timezone correction.

A bounded live capture on 2026-07-22 found:

| Reference | Observed value |
| --- | --- |
| Desktop UTC | approximately `2026-07-22T18:01Z` |
| Latest tick labeled UTC | approximately `2026-07-22T21:01Z` |
| Latest 5m candle labeled UTC | `2026-07-22T21:00:00Z` |
| Apparent difference | approximately +3 hours |
| Payload offset | none |
| Broker timezone declaration | none |

The raw value behaves like broker wall-clock time encoded in an epoch-shaped number, not a proven UTC epoch. The observation is consistent with a UTC+3 server in July, but one summer sample cannot prove an IANA timezone or its DST rules. The default Phase 1.5 policy therefore remains `unknown` and blocks the V2 MT5 window.

## Timestamp Path Map

| Path | Source field and conversion | Current assumption | Phase 1.5 disposition |
| --- | --- | --- | --- |
| MT5 upstream tick | `tick.time` -> `datetime.fromtimestamp(..., UTC)` | Numeric value is UTC epoch | Observed assumption is unproven; raw value must be retained |
| MT5 upstream latest candles | `copy_rates_from_pos().time` -> same conversion | Numeric value is UTC epoch/open time | Treat as provider open time until policy is declared |
| MT5 upstream range/history | `copy_rates_range().time` -> same conversion | Numeric value is UTC epoch/open time | Same policy as latest; no path-specific offset |
| Read-only wrapper | `timestamp/time/datetime` -> JavaScript `Date` -> epoch seconds | Input already represents an instant | No correction; legacy behavior unchanged |
| MT5 client normalizer | numeric/string -> ISO UTC | Input already represents an instant | Legacy behavior unchanged |
| Candle source manager | stores normalized candle timestamp and fingerprint | Timestamp is canonical UTC | Production behavior unchanged |
| Browser push adapter | republishes read-only polling candles as events | Polling timestamp already canonical | Not an independent live transport |
| Push rolling store | deduplicates by source/symbol/timeframe/time | Event timestamp is canonical | Production behavior unchanged |
| V2 Phase 1 adapter | accepts legacy timestamp as UTC | Compatibility-only | Retained for baseline compatibility |
| V2 Phase 1.5 adapter | raw provider time -> explicit policy -> UTC | No implicit timezone | New shadow-only normalization boundary |
| Forward evidence | compares ISO issue/setup times | Input is UTC instant | Inspected only; unchanged |
| Session consumers | use UTC or `America/New_York` conversion | Input is UTC instant | Inspected only; unchanged |

The source time is a candle open time. The canonical close time is calculated as normalized open time plus the normalized timeframe duration. A provider close field, when present, is audited against that result.

## Policy Contract

Policy ID:

```text
gotrader-v2-mt5-server-time
```

Initial version:

```text
1
```

Supported bases:

- `epoch_utc`: finite numeric epoch seconds or milliseconds.
- `utc_iso`: strict ISO timestamp ending in `Z`.
- `iso_with_offset`: strict ISO timestamp carrying `Z` or an explicit numeric offset.
- `mt5_server_wall_clock`: numeric or zone-less provider wall clock interpreted only through a configured IANA zone or explicit fixed offset.
- `unknown`: always blocked.

No zone-less value is passed to JavaScript `Date` parsing. No system-local timezone is used. No fixed `-3h` correction exists.

## DST Ownership

An IANA policy owns seasonal offset resolution. Wall-clock-to-UTC conversion searches valid instants that reproduce the supplied wall-clock fields in the configured zone:

- zero matches: `nonexistent_local_time` and blocked;
- more than one match: `ambiguous_local_time` and blocked;
- exactly one match: normalized UTC with the applied offset recorded.

A fixed-offset policy is supported only when explicitly configured. It does not claim DST support.

## Trusted Clock

System UTC is the primary trusted reference. Receive time must agree with system UTC within `maximumClockSkewMs`. A provider clock can participate only when it is already an independently normalized UTC instant. Wrapper timestamps derived from the same unverified MT5 value are not independent proof.

Clock disagreement produces `reference_clock_skew` and blocks closure eligibility. The implementation never chooses whichever clock makes a candle pass.

## Closure Proof

A candle is closed only when:

```text
normalizedCloseTimeUtc <= trustedReferenceUtc - closureToleranceMs
```

The close is calculated from normalized open time plus timeframe duration. `candle_closed` or another explicit provider flag cannot override a future or invalid normalized close. Partial, future, and unprovable candles are rejected from the closed V2 window.

## Raw and Normalized Audit

Each accepted Phase 1.5 V2 candle carries immutable compact `timeAudit` metadata:

- raw provider open and optional close value;
- normalized UTC open and close;
- provider basis;
- policy ID and version;
- configured source timezone;
- applied offset and raw-to-UTC delta;
- DST state;
- receive time;
- closure status;
- compact warnings and blockers.

Raw candle arrays are not logged, persisted, or exposed to production consumers.

## Identity

The V2 identity schema is `gotrader-v2-market-data-identity-v2`. It includes the time policy ID and version, so a policy change changes the V2 identity hash. The legacy source fingerprint is retained byte-for-byte and is not recomputed.

## Capability

The source description remains:

```text
marketDataAccess: read_only
transportCapability: market_data_read_only
authority: none / none / none
```

Provider time basis and time-policy ID/version are additive shadow metadata. They do not grant broker authority.

## Fail-Closed Requirements

Phase 1.5 blocks the V2 MT5 window for unknown basis, missing zone/offset, invalid policy, ambiguous or nonexistent local time, clock skew, policy mismatch, future close, or unavailable close proof. Phase 2 is not eligible until the upstream or operator configuration explicitly identifies and verifies the broker time contract.
