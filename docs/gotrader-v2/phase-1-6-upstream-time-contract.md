# GoTrader V2 Phase 1.6 Upstream Time Contract

## Boundary

Phase 1.6 adds a shadow-only, read-only timestamp declaration to the local MT5 market-data service. It does not alter production research, strategy, session, evidence, readiness, UI, Paper-Demo, OpenClaw, broker, account, order, position, or execution behavior.

Authority remains:

```json
{
  "executionAuthority": "none",
  "brokerAuthority": "none",
  "readinessOverrideAuthority": "none"
}
```

## Discovered Runtime

- Upstream: `scripts/mt5-readonly-upstream.py`, loopback port `8000`
- Wrapper: `scripts/start-mt5-readonly-bridge.mjs`, loopback port `7341`
- Python: `3.14.4`
- MetaTrader5 Python package: `5.0.5735`
- Connected terminal version: `500 / build 5836 / 28 Apr 2026`
- Terminal connection: connected during the bounded July 22, 2026 diagnostic
- Safe terminal metadata exposed no broker timezone, GMT offset, DST policy, or independent server UTC clock

The official MetaTrader5 Python documentation says tick and bar times are UTC. See [copy_ticks_range](https://www.mql5.com/en/docs/python_metatrader5/mt5copyticksrange_py), [Python integration](https://www.mql5.com/en/docs/python_metatrader5), and [terminal_info](https://www.mql5.com/en/docs/python_metatrader5/mt5terminalinfo_py). The connected USTECH runtime contradicted that claim: its tick and M5 bar values were approximately 180 minutes ahead of system UTC. GoTrader therefore does not treat the library documentation alone as proof of this provider's contract.

## Additive Endpoint

The upstream now exposes:

```text
GET /time-contract
GET /api/v1/market/time-contract
```

The wrapper exposes the same object through:

```text
GET /time-contract
GET /api/v1/market/time-contract
```

The wrapper adds only `receivedAtUtc`, `wrapperContractVersion`, `upstreamPath`, and `sourceMethod`. It does not reinterpret the provider timezone, offset, verification state, or raw timestamps.

## Contract Shape

The versioned contract includes:

- contract ID and version;
- provider time basis;
- optional IANA timezone or fixed offset;
- DST policy;
- configuration source;
- verification status and sources;
- raw tick time and millisecond tick time;
- latest raw candle time;
- legacy UTC interpretation for comparison;
- normalized provider time when a policy is configured;
- verified server UTC only after verification;
- system UTC and observed offset;
- tick/candle basis agreement;
- compact seasonal observation summary;
- terminal build/version and Python package version;
- read-only flags and strict authority.

It excludes credentials, login, account, balance, equity, margin, positions, orders, deals, tokens, and secrets.

## Legacy Compatibility

Existing `time` and `timestamp` fields are unchanged in Phase 1.6. The upstream now adds `rawTime` to candles and `rawTime` plus `rawTimeMsc` to quotes. The wrapper preserves these scalars. Production consumers continue receiving the legacy fields and legacy source fingerprint.

The exact current path is:

```text
MT5 raw numeric time
-> legacy Python datetime.fromtimestamp(raw, UTC)
-> legacy ISO string labeled Z
-> wrapper legacy timestamp parsing
-> production consumers unchanged
```

The V2 shadow path additionally retains the original scalar and validates the new contract before normalization.

## Operator Configuration

No timezone is assumed by default. Optional non-secret local settings are:

```text
MT5_PROVIDER_TIME_BASIS=mt5_server_wall_clock
MT5_PROVIDER_TIMEZONE=Europe/Helsinki
MT5_PROVIDER_UTC_OFFSET_MINUTES=180
MT5_PROVIDER_TIME_VERIFICATION_SOURCES=provider_documentation,verified_terminal_metadata
MT5_PROVIDER_TIME_DECLARATION_ID=provider-time-contract-v1
MT5_PROVIDER_TERMINAL_METADATA_VERIFICATION_ID=terminal-time-metadata-v1
MT5_PROVIDER_TIME_OBSERVATIONS_FILE=C:\path\to\compact-observations.json
```

Use either `MT5_PROVIDER_TIMEZONE` or `MT5_PROVIDER_UTC_OFFSET_MINUTES`, never both. IANA timezone configuration is preferred for DST-observing providers. Configuration alone is always `configured_unverified`.

`provider_documentation` and `verified_terminal_metadata` are ignored unless their matching non-secret verification ID is also supplied. A bare verification-source label cannot promote a contract.

## V2 Consumption

The Phase 1.5 adapter now derives its policy only from an accepted contract whose `verificationStatus` is `verified`. A missing, invalid, configured-unverified, observed-candidate, or unknown contract produces an unknown policy, blocks the candle window, creates no evidence eligibility, and adds the contract blocker to diagnostics.

V2 identity is sensitive to:

- time-contract ID;
- time-contract version;
- verification status;
- normalization policy ID and version.

Volatile server, system, receive, tick, and candle timestamps are excluded from identity configuration fields. The legacy source fingerprint is unchanged.

## Rollback

Revert the Phase 1.6 commit or stop calling `/time-contract`. The endpoint and raw scalar fields are additive. Legacy timestamp fields and production consumers are unchanged.
