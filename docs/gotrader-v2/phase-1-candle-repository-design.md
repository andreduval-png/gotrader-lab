# GoTrader V2 Phase 1 Candle Repository Design

## Status and boundary

Phase 1 adds a read-only, shadow-only facade over existing candle snapshots. It
does not replace a physical store, select the active source, call MT5, or feed any
production detector, research cycle, evidence, readiness, UI, OpenClaw, gateway,
or broker path.

The V2 namespace is isolated under `src/lib/v2`. Production code has no import of
that namespace. Phase 1 tests assert this boundary.

## Existing architecture discovered

| System | Responsibility | Input and output | Identity and timing | Storage/fallback | Current consumers |
|---|---|---|---|---|---|
| `candleSources/candleSourceManager.ts` | Selects chart, research, and walk-forward summaries | Prepared/imported, MT5, and chart feeds to `CanonicalCandleSource` | Existing compatibility fingerprint includes provider, source ID, symbol, timeframe, count, first/last timestamp and close | Sources may use IndexedDB, session, memory, local file, or mock | Market-data resolver, Backtest, Replay, Dashboard, research paths |
| `candleSources/candleSourceStorage.ts` | Stores canonical source objects | Full source objects including candle arrays | Preserves existing fingerprint and provenance | Memory plus IndexedDB | Source activation and summaries |
| `integrations/mt5/*` | Fetches and normalizes MT5 latest/range/history data | Wrapper payloads to read-only feeds and candles | Requested and broker symbols are distinct; timestamps are candle-open timestamps; fingerprints use count and first/last timestamp/close | Session/IndexedDB metadata and explicit chunked CLI history | Current read, MTF context, research, diagnostics |
| `marketData/historicalCandleImport.ts` | Parses and stores imported historical OHLCV | CSV/XLSX/normalized JSON to legacy candles | Import ID and metadata; duplicate and interval diagnostics | IndexedDB; inactive import can fall back to explicitly labeled mock data | Research, Backtest, Replay, Walk-Forward |
| `backtesting/replaySourceSession.ts` | Stores compact replay source metadata | Resolved source to metadata only | Frozen source fingerprint and snapshot ID | Session storage; candles remain in the replay runtime | Replay UI and diagnostics |
| `mt5PushFeed/*` | Normalizes pushed events and maintains rolling closed-candle series | MT5 events to a rolling store | Push fingerprints include transport receive time; explicit `closed` state | In-memory rolling store; compact status only in localStorage | Event-driven current-read/advisor triggers |
| `marketData/marketDataSourceResolver.ts` | Resolves active chart and research arrays | Prepared source plus optional MT5/chart feed | Uses both canonical and display fingerprints | Can visibly fall back according to legacy source rules | Dashboard and research workspaces |

The facade reports these differences. It does not change them.

## Refined Phase 1 contracts

### Authority and transport

All V2 results use:

```ts
authority: {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}
marketDataAccess: "read_only";
transportCapability: "market_data_read_only";
```

Legacy push-feed `brokerAuthority: read_only` is consumed only as a transport
capability. It is never copied into a V2 authority object.

### Candle time

The V2 candle uses explicit times:

```ts
interface V2CanonicalCandle {
  openTime: string;
  closeTime: string;
  providerTime?: string;
  receivedAt?: string;
  isClosed: true;
  closureSource:
    | "provider_event"
    | "timeframe_elapsed"
    | "historical_dataset"
    | "replay_snapshot"
    | "mock_sample";
}
```

Legacy `timestamp` is treated as candle open time. Polling closure is proven only
after one normalized timeframe has elapsed. Push closure requires an explicit
closed event. Imported, replay, and explicitly selected mock datasets have frozen
dataset closure policies. Unknown closure proof blocks the window.

### Identity

`V2SourceIdentity` carries the existing fingerprint unchanged. A separately
versioned V2 identity hash covers source kind, requested and broker symbols,
sorted timeframe fingerprints, sorted counts, data-window boundaries, calendar
version, timezone version, identity schema version, and hash version.

```text
identity schema: gotrader-v2-market-data-identity-v1
hash: gotrader-v2-sha256-v1
```

The identity contains no candle arrays, secrets, account data, order data,
position data, screenshots, or raw runtime snapshots.

### Canonical serialization

Serialization recursively sorts object keys, preserves semantic array order,
normalizes line endings, and normalizes separators only for path-like fields. It
rejects undefined, functions, symbols, bigint, non-finite numbers, Date objects,
non-plain objects, symbol keys, and cycles. Hashing uses Web Crypto SHA-256 and is
available in the browser and current Node runtime.

### Query identity

A query contains one source identity. Requested and broker symbols are not
duplicated as independent query fields. Adapters reject any source-ID,
fingerprint, provider, symbol, or source-kind mismatch.

### Window limits

| Purpose | Maximum candles |
|---|---:|
| `current_read` | 1,000 |
| `context_shadow` | 5,000 |
| `replay` | 10,000 |
| `walk_forward` | 10,000 |
| `deep_research` | 50,000 |

Deep history is therefore explicit. No browser component or ordinary current-read
query can accidentally request the 90-day research path.

## Data-quality policy

The facade returns only finite, positive, closed candles with valid OHLC ordering,
valid times, nonnegative optional volume, unique open timestamps, and ascending
order. Runtime values and arrays are frozen.

The repair policy is explicit:

```text
reject_invalid_sort_ascending_deduplicate_identical
```

- Invalid OHLC, invalid volume, invalid time, future closed candles, conflicting
  duplicates, unknown closure, stale push state, and an empty valid result block.
- Identical duplicates, out-of-order input, excluded partial candles, computed
  staleness, and missing timeframes degrade.
- Time gaps are counted and reported. They do not block in Phase 1 because
  exchange-calendar and DST classification belongs to the Phase 2 context layer.
- Source warnings are retained without automatically converting informational
  CFD/proxy warnings into data corruption.

## Typed failures

The repository fails closed with typed errors including:

```text
source_unavailable
source_identity_mismatch
source_kind_unsupported
timeframe_unavailable
query_invalid
query_limit_exceeded
deep_history_not_explicit
mock_evidence_forbidden
closed_state_unknown
data_quality_blocked
adapter_unavailable
```

No failure selects another source, symbol, timeframe, or provider.

## Mock/sample policy

Mock/sample data is available only when the query explicitly identifies a
`mock_sample` source. It may be read for `current_read` or `context_shadow`
diagnostics but is rejected for replay, walk-forward, and deep-research evidence.
The repository itself never creates evidence.

## Runtime immutability

`readonly` types are reinforced with frozen source identities, records, candles,
arrays, diagnostics, evidence policy, source descriptions, capabilities, and
windows. Adapters copy legacy values into these structures; they do not return a
mutable production array.

## Push and polling comparison

The comparison utility aligns closed candles by open time and compares OHLC,
close time, optional volume, symbol identity, and compatibility fingerprints. It
emits only compact counts and one first mismatch time:

```text
exact_match
equivalent_with_documented_variance
mismatch
insufficient_comparison_data
```

Different transport fingerprints or volume fields may be documented variance
when timing and OHLC match. No comparison triggers a strategy or event bus.

## Isolation assertion

The deterministic Phase 1 suite scans all TypeScript production files outside
`src/lib/v2` and fails if one imports the V2 namespace. The V2 barrel is not added
to an existing production barrel. Phase 2 must receive separate authorization
before a shadow context builder may consume the repository.
