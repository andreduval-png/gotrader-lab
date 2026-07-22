# GoTrader V2 Phase 1 Adapter Matrix

## Matrix

| Source | V2 source kind | Adapter | Closure proof | Legacy identity | Storage effect | Fallback | Phase 1 limitation |
|---|---|---|---|---|---|---|---|
| Canonical Source Manager source | Provider-dependent | `legacy-canonical-source-manager` | Provider-dependent | Existing `source.fingerprint` is preserved | Read-only load from existing source storage | None | Chart/Tradovate providers remain unsupported until explicitly mapped |
| MT5 latest/history feed snapshot | `mt5_read_only` | `mt5-read-only-snapshot` | Normalized timeframe elapsed | Existing MT5 candle fingerprint is required | None; caller supplies a feed snapshot | None | Adapter does not call the wrapper or auto-fetch history |
| Imported historical source | `imported_historical` | Source-manager/static adapter | Frozen historical dataset | Existing import/canonical fingerprint | Existing IndexedDB remains authoritative | None | V2 does not create or activate imports |
| Replay snapshot | `replay_snapshot` | `replay-snapshot` | Frozen replay snapshot | Replay source fingerprint | None; caller supplies candles plus compact metadata | None | Existing replay metadata alone does not contain candles |
| Explicit mock/sample | `mock_sample` | Source-manager/static adapter | Explicit sample dataset | Explicit mock fingerprint | None | Never selected implicitly | Evidence-purpose queries are rejected |
| MT5 push rolling store | `mt5_read_only` | `mt5-push-feed-rolling-store` | Explicit `mt5.candle_closed` state | Captured push snapshot fingerprint | Reads in-memory rolling state only | None | Stale state blocks; a changed snapshot fingerprint requires recapture |

## Canonical Source Manager mapping

| Legacy provider | V2 source kind | Closure policy |
|---|---|---|
| `mt5_read_only` | `mt5_read_only` | `elapsed_time` |
| `imported_historical` | `imported_historical` | `historical_dataset` |
| `replay` | `replay_snapshot` | `replay_snapshot` |
| `mock` | `mock_sample` | `mock_sample` |
| `tradingview_mcp` | Unsupported in Phase 1 | Fail closed |
| `tradovate_read_only` | Unsupported in Phase 1 | Fail closed |

Unsupported mappings do not fall back to MT5, imported, replay, or mock data.

## Registry behavior

The optional registry is constructed once from an explicit map of source kind to
repository. It has no implicit defaults and no mutable public registration API.
An unavailable source kind throws `adapter_unavailable`. Source IDs, providers,
symbols, and fingerprints are then verified again by the selected adapter.

## Transport authority mapping

The legacy push store currently carries:

```text
executionAuthority: none
brokerAuthority: read_only
readinessOverrideAuthority: none
```

The adapter deliberately does not copy that object. Every returned window uses:

```text
marketDataAccess: read_only
transportCapability: market_data_read_only
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

This preserves the feed's read-only capability while removing ambiguity about
broker mutation authority.

## Physical stores remain separate

Phase 1 does not merge or migrate IndexedDB imports, canonical source storage,
session replay metadata, MT5 feed state, or push rolling series. Adapters read
snapshots from those systems and create immutable V2 windows in memory.
