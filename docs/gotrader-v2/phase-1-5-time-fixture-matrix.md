# GoTrader V2 Phase 1.5 Time Fixture Matrix

All fixtures run through `npm.cmd run test:v2-mt5-time-normalization` and use the pure Phase 1.5 adapter.

| Fixture | Raw value | Policy | Expected result |
| --- | --- | --- | --- |
| UTC epoch | `1704067200` | `epoch_utc` | `2024-01-01T00:00:00Z` |
| UTC ISO | `2026-01-15T14:30:00Z` | `utc_iso` | unchanged UTC instant |
| Explicit offset | `2026-07-15T16:30:00+03:00` | `iso_with_offset` | `2026-07-15T13:30:00Z` |
| Helsinki winter | `2026-01-15 16:30` | IANA `Europe/Helsinki` | `14:30Z`, standard UTC+2 |
| Helsinki summer | `2026-07-15 16:30` | IANA `Europe/Helsinki` | `13:30Z`, daylight UTC+3 |
| Fixed UTC+2 | `2026-01-15 16:30` | explicit +120 minutes | `14:30Z` |
| Fixed UTC+3 | `2026-07-15 16:30` | explicit +180 minutes | `13:30Z` |
| Unknown basis | zone-less value | `unknown` | blocked |
| Missing wall-clock zone | zone-less value | no zone/offset | blocked |
| Strict UTC | zone-less value | `utc_iso` | blocked |

## America/New_York Session Fixtures

| Local wall clock | Expected UTC | Purpose |
| --- | --- | --- |
| 2026-01-15 03:00 | 08:00Z | Silver Bullet winter |
| 2026-01-15 09:30 | 14:30Z | New York open winter |
| 2026-01-15 10:00 | 15:00Z | Silver Bullet winter |
| 2026-01-15 14:00 | 19:00Z | Silver Bullet winter |
| 2026-07-15 03:00 | 07:00Z | Silver Bullet summer |
| 2026-07-15 09:30 | 13:30Z | New York open summer |
| 2026-07-15 10:00 | 14:00Z | Silver Bullet summer |
| 2026-07-15 14:00 | 18:00Z | Silver Bullet summer |
| 2026-07-15 00:00 | 04:00Z | New York midnight |
| 2026-07-19 00:00 | 04:00Z | Sunday boundary |
| 2026-03-08 02:30 | no valid instant | Spring-forward gap blocks |
| 2026-11-01 01:30 | two valid instants | Fall-back ambiguity blocks |

## Closure and Identity Fixtures

| Fixture | Expected result |
| --- | --- |
| Elapsed normalized close | closed |
| Current partial candle | excluded as partial |
| Future normalized close with explicit provider close | blocked as future |
| Receive/system clock within tolerance | trusted |
| Receive/system clock outside tolerance | blocked for skew |
| Same candles, policy version 1 vs 2 | different V2 identity hashes |
| Same Phase 1.5 policy through polling and push fixtures | exact match |
| Unknown policy through repository | blocked window, no evidence eligibility |
| Raw provider time audit | preserved and immutable |
| Authority | none / none / none |
