# GoTrader V2 Phase 1.6 Time Verification Policy

## Statuses

| Status | Meaning | Phase 2 eligible |
| --- | --- | --- |
| `verified` | Basis and offset/DST behavior satisfy deterministic evidence rules | Yes, subject to all remaining candle checks |
| `configured_unverified` | Operator configured a timezone, fixed offset, or basis without sufficient proof | No |
| `observed_candidate` | Live tick/candle values suggest an offset but no provider policy is established | No |
| `unknown` | No usable declaration exists or the declaration is invalid | No |

The upstream declares facts and observations. The V2 validator independently checks structure, evidence, authority, and sensitive-field exclusions. A timezone name cannot grant verification by itself.

## Verified UTC Epoch

`epoch_utc` requires:

1. the official MetaTrader5 UTC-time documentation source;
2. live raw tick time close to system UTC;
3. tick/candle numeric basis agreement;
4. strict read-only authority.

The current USTECH runtime fails item 2 and is not verified as UTC epoch.

## Verified IANA Wall Clock

`mt5_server_wall_clock` with `iana_timezone_rules` requires:

1. a valid configured IANA timezone;
2. tick/candle basis agreement; and
3. either explicit provider documentation or verified terminal metadata, or at least one accepted winter and one accepted summer observation consistent with the IANA rules.

Each observation is compact and contains only timestamps, offset, DST state, tolerance result, and source. Historical captures must be real captures and must be labeled `historical_capture`; test fixtures are not provider evidence.

## Verified Fixed Offset

`mt5_server_wall_clock` with `fixed_offset` requires:

1. an integer offset from `-840` through `840` minutes;
2. explicit provider documentation or verified terminal metadata;
3. at least two accepted observations using the same offset;
4. tick/candle basis agreement.

A fixed offset must not be used for a provider that observes DST.

## Contract Rejection

The V2 validator blocks:

- wrong contract ID or missing version;
- invalid basis, timezone, offset, DST policy, or status;
- simultaneous IANA timezone and fixed offset;
- unsafe authority;
- non-read-only capability;
- account, balance, equity, margin, position, order, deal, credential, password, secret, token, API-key, or login fields;
- verified claims without their required evidence;
- tick/candle basis mismatch.

## Current Decision

The July live observation supports an `observed_candidate` offset of approximately `+180` minutes. Explicit `Europe/Helsinki` configuration converts the current value plausibly but remains `configured_unverified`. No genuine winter observation or provider declaration is available in this repository.

```text
PHASE 1.6 BLOCKED - PROVIDER TIME CONTRACT NOT VERIFIED
```
