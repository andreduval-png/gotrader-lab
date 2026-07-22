# GoTrader V2 Phase 1.7 Terminal Clock Probe

## Purpose

Phase 1.7 compares terminal-native MT5 clocks with the Python API, read-only wrapper, and synchronized system UTC. It is diagnostic-only and does not change production strategy, research, evidence, readiness, UI, Paper-Demo, broker, or execution behavior.

## Probe

`mt5/GoTraderClockProbe.mq5` is a manually run MQL5 script. It performs one capture and exits. It contains no `CTrade`, account, order, position, deal, history-deal, mutation, DLL, socket, or HTTP capability.

The script captures:

- `TimeCurrent()` and `TimeTradeServer()`;
- `TimeGMT()`, `TimeLocal()`, local-computer GMT offset, and local-computer DST correction;
- `SYMBOL_TIME`, `SYMBOL_TIME_MSC`, and one M5 bar-open scalar;
- symbol synchronization and read-success flags;
- terminal build and `none/none/none` authority.

`TimeGMTOffset()` and `TimeDaylightSavings()` describe the local computer, not the broker timezone. `TimeTradeServer()` is terminal-calculated and therefore supporting evidence. `TimeCurrent()` and the selected-symbol quote are the primary server/quote observations.

## Transport

The script writes one UTF-8 JSON object under the MT5 `FILE_COMMON` sandbox. It writes a temporary file, flushes and closes it, and then replaces the latest file with `FileMove`.

The terminal data-path value is never exported. A deterministic eight-character instance hash prevents different terminal installations from sharing the same filename.

```text
<TERMINAL_COMMONDATA_PATH>/Files/GoTrader/gotrader-mt5-clock-probe-<instance>.json
```

The Python reader computes the exact path from safe terminal metadata. It does not enumerate or read unrelated files. It rejects files over 64 KiB, malformed JSON, unknown fields, sensitive fields, stale captures, mismatched terminal instances, and duplicate IDs when ingestion tracking is enabled.

## Scope Separation

The classifier records four independent facts:

1. whether Python values match terminal quote/server transport;
2. whether the current live offset can be measured;
3. whether historical DST behavior is proven;
4. whether Phase 2 is eligible.

A current terminal capture cannot prove year-round DST behavior. Phase 2 requires both current-live verification and independently verified historical DST policy.

New York strategy sessions remain separate:

```text
MT5 provider/server time
  -> verified UTC normalization
UTC canonical candle time
  -> America/New_York strategy session projection
```

## Security

Authority remains:

```json
{
  "executionAuthority": "none",
  "brokerAuthority": "none",
  "readinessOverrideAuthority": "none"
}
```

No account identifiers, balances, margin, positions, orders, deals, credentials, paths, secrets, candle arrays, or mutable commands are present.
