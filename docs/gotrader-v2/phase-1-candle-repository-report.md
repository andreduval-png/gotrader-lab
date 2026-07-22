# GoTrader V2 Phase 1 Candle Repository Report

## Final status

```text
PHASE 1 PASSED WITH DOCUMENTED SOURCE LIMITATIONS
```

The V2 read-only candle facade is established, deterministic, fail-closed, and
isolated from every production consumer. A bounded live diagnostic identified an
existing MT5 server-time normalization mismatch; the facade blocked that window
instead of treating future timestamps as eligible closed candles.

## 1. Starting branch and commit

- Clean worktree: `C:/Users/andre/OneDrive/Documents/gotrader-v2-phase0-baseline`
- Starting branch lineage: `gotrader-v2/phase-0-baseline`
- Phase 1 branch: `gotrader-v2/phase-1-candle-facade`
- Starting documentation handoff: `247b59c483bdf5a182319a8277741639de41a0a1`
- Source base: `f6dbe33489a122d36995c5eb260d763917d186b3`
- Original dirty worktree: not read, modified, or used as a dependency

## 2. Final branch and commit

- Final branch: `gotrader-v2/phase-1-candle-facade`
- Phase 1 implementation commit: `76b68ef` (`Add V2 read-only candle repository facade`)
- This report is a documentation-only handoff committed after the implementation.

## 3. Files created and modified

Created:

- `src/lib/v2/authority/*`
- `src/lib/v2/serialization/*`
- `src/lib/v2/identity/*`
- `src/lib/v2/candles/*`
- `src/lib/v2/index.ts`
- `scripts/test-v2-candle-repository.mjs`
- `scripts/diagnose-v2-candle-repository.mjs`
- `docs/gotrader-v2/phase-1-candle-repository-design.md`
- `docs/gotrader-v2/phase-1-adapter-matrix.md`
- `docs/gotrader-v2/phase-1-parity-policy.md`
- `docs/gotrader-v2/phase-1-candle-repository-report.md`

Modified:

- `package.json`
- `scripts/v2-baseline/test-manifest.json`

No production feature, route, detector, evidence, readiness, UI, gateway, or
broker file was modified.

## 4. Existing candle architecture discovered

The current application has separate candle responsibilities rather than one
physical store:

- Candle Source Manager selects canonical chart/research/walk-forward sources.
- Canonical source storage persists source objects in memory and IndexedDB.
- MT5 latest and range clients normalize wrapper market data.
- Imported historical data uses a separate IndexedDB path.
- Replay stores compact snapshot metadata while replay runtime owns its candles.
- MT5 push feed uses an in-memory rolling store and event bus.
- The market-data resolver applies current source-selection and fallback rules.

The full input/output, identity, timing, storage, fallback, and consumer map is in
`phase-1-candle-repository-design.md`.

## 5. V2 contracts added

Phase 1 adds isolated, versioned contracts for:

- immutable authority and market-data capability;
- source and market-data identity;
- canonical serialization and hashing;
- explicit open/close-time candles;
- bounded read-only queries and windows;
- deterministic data-quality diagnostics;
- evidence eligibility policy without evidence creation;
- typed repository errors;
- source descriptions and adapter versions.

## 6. Serialization and hash version

```text
gotrader-v2-sha256-v1
```

Serialization recursively sorts plain-object keys, retains semantic array order,
normalizes line endings and path-like fields, and rejects unsupported or cyclic
values. Web Crypto SHA-256 is used in both the browser and current Node runtime.

Deterministic test hash:

```text
sha256:7e753e7c9e73ce91032b389e0240245ac23d18168383e74539a24d70ab6d4169
```

## 7. Identity schema version

```text
gotrader-v2-market-data-identity-v1
```

The identity keeps requested and broker symbols distinct, stores sorted timeframe
fingerprints and counts, and includes data-window, calendar, timezone, schema,
and hash versions. Deterministic test identity hash:

```text
sha256:a66f495e12a233a2b8348863ee5b5bf92787a22ce2506702f207475f231c1520
```

## 8. Repository interface

`V2CandleRepository` exposes only:

```text
getWindow
getAvailableTimeframes
describeSource
```

It has no account, order, position, execution, mutation, strategy, evidence, or
readiness method. Results are runtime-frozen and always `shadowOnly: true`.

## 9. Adapter matrix

Implemented compatibility adapters cover:

- current Canonical Source Manager snapshots;
- injected MT5 read-only snapshots;
- imported historical snapshots through the static/source-manager path;
- injected replay snapshots;
- explicit mock/sample snapshots;
- injected MT5 push rolling-store state;
- an immutable source-kind registry with no default provider.

The detailed provider, source-kind, closure, fingerprint, fallback, and limitation
matrix is in `phase-1-adapter-matrix.md`.

## 10. Legacy fingerprint preservation

Adapters copy the current compatibility fingerprint verbatim into
`V2SourceIdentity.sourceFingerprint`. Phase 1 does not recalculate or replace the
legacy algorithm. The V2 identity hash is additional and independently versioned.

## 11. Timing and closed-candle semantics

V2 candles use explicit `openTime` and `closeTime` fields. Legacy `timestamp` is
treated as open time.

- Push requires an explicit closed-candle event.
- Polling requires one normalized timeframe to have elapsed.
- Imported history uses frozen historical-dataset closure.
- Replay uses frozen replay-snapshot closure.
- Explicit mock/sample uses sample-dataset closure.
- Unknown closure proof blocks the window.

Provider and receive timestamps are retained separately when supplied.

## 12. Data-quality diagnostics

Diagnostics compactly count invalid OHLC, invalid volume, invalid/future times,
identical and conflicting duplicates, ordering repairs, partial candles, unknown
closure, gaps, staleness, rejected values, and missing timeframes.

The declared repair policy is:

```text
reject_invalid_sort_ascending_deduplicate_identical
```

Invalid or conflicting values are never silently accepted. Every repair is
reported and all returned arrays and values are frozen.

## 13. Push-feed authority mapping

Legacy push `brokerAuthority: read_only` is interpreted only as a market-data
transport label. Every V2 result uses:

```json
{
  "marketDataAccess": "read_only",
  "transportCapability": "market_data_read_only",
  "authority": {
    "executionAuthority": "none",
    "brokerAuthority": "none",
    "readinessOverrideAuthority": "none"
  }
}
```

Runtime assertions reject any deviation.

## 14. Push and polling comparison behavior

The compact comparator aligns closed candles by open time and compares timing,
OHLC, optional volume, source identity, and fingerprints. Results are:

```text
exact_match
equivalent_with_documented_variance
mismatch
insufficient_comparison_data
```

The deterministic fixture classified matching OHLC with documented transport
fingerprint/volume variance as `equivalent_with_documented_variance`. Comparison
never publishes an event or invokes a strategy.

## 15. Mock/sample fail-closed behavior

Mock/sample data must be named explicitly. It can be read only for non-evidence
current/context diagnostics. Replay, walk-forward, and deep-research evidence
queries reject it with `mock_evidence_forbidden`. The repository creates no
evidence under any source kind.

## 16. Deep-history boundary

Purpose-specific maxima are:

| Purpose | Maximum candles |
|---|---:|
| Current read | 1,000 |
| Context shadow | 5,000 |
| Replay | 10,000 |
| Walk-forward | 10,000 |
| Deep research | 50,000 |

No UI or ordinary runtime path imports the facade, and no deep request is
scheduled automatically.

## 17. Tests added

`test:v2-candle-repository` covers serialization, identity sensitivity, source
identity mismatches, valid and invalid OHLCV, duplicate handling, ordering,
partial and unknown closure, future time, stale state, bounded queries, deep
history, imported/replay/mock/MT5/push behavior, registry failures, immutable
outputs, strict authority, comparator states, compact safety, and zero production
consumers.

The deterministic test is part of `test:core` and `test:source-integrity`.

## 18. Commands run

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test
npm.cmd run test:core
npm.cmd run test:strategy-baselines
npm.cmd run test:source-integrity
npm.cmd run test:provenance
npm.cmd run test:safety
npm.cmd run test:browser-smoke
npm.cmd run test:v2-baseline-snapshots
npm.cmd run test:v2-candle-repository
npm.cmd run diagnose:v2-candle-repository
git diff --check
git diff --cached --check
```

Environment versions:

```text
Node v24.15.0
npm 11.13.0
TypeScript 5.9.3
```

## 19. Exact results

| Check | Result |
|---|---|
| Typecheck | Passed |
| Production build | Passed in 16.90s; existing chunk-size warning only |
| Default test | Passed; 10 signals and 10 compact journal events |
| Core baseline | Passed |
| Strategy baselines | Passed |
| Source integrity | Passed |
| Provenance | Passed |
| Safety | Passed |
| Browser smoke | Passed, 44/44 |
| V2 baseline snapshots | Passed; byte-stable across two generations |
| V2 candle repository | Passed |
| Live V2 diagnostic | Ran against connected MT5 read-only wrapper; blocked timestamp-skewed window as designed |
| Diff checks | Passed after trailing-blank-line normalization |

V2 deterministic result: 3 eligible fixture candles, 1,200 explicit deep-history
candles, no mock evidence, no production consumers, and authority none/none/none.

## 20. Baseline fixture hashes

The Phase 0 fixtures remain unchanged:

```text
IFVG v3
1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a

IFVG v2
3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224

Strategy catalog
43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de
```

## 21. Known limitations

The bounded live diagnostic requested `MNQ -> USTECH`, `5m`, 1,000 candles.
The wrapper was connected and non-stale, but 36 candles were ahead of the desktop
UTC clock and one current candle was partial. The facade retained 963 candles and
classified the window `blocked` with:

```text
36 closed candle(s) exceeded the future-time tolerance.
```

This is classified as a legacy/provider timestamp-basis mismatch. The upstream
MT5 payload currently emits times approximately three hours ahead of desktop UTC.
Production behavior was not changed to make V2 pass. The correct future fix is
to establish and version the MT5 server-time-to-UTC contract at the source or an
approved adapter boundary, with DST/session fixtures.

No independent push snapshot was supplied during the live diagnostic, so live
push/polling status was `insufficient_comparison_data`. Deterministic comparison
coverage passed.

Phase 1 also intentionally does not merge physical stores, migrate active source
selection, classify exchange-calendar gaps, or consume windows in production.

## 22. Rollback procedure

Revert the Phase 1 implementation commit and this report commit. Because the V2
namespace has zero production consumers and no storage migration, no data or
runtime rollback is needed. The Phase 0.5 runtime remains intact.

## 23. Phase 2 prerequisites

Before a separately authorized Canonical Market Context Engine can be built:

1. Define and verify MT5 server-time conversion to UTC, including DST fixtures.
2. Freeze session-calendar and timezone-data version ownership.
3. Capture at least one bounded live push/polling comparison when push data is available.
4. Define Phase 2 shadow context fixtures without changing production detectors.
5. Preserve all Phase 0 strategy hashes and Phase 1 repository tests.
6. Keep deep history explicit and avoid UI-load fetches.
7. Approve a separate Phase 2 instruction and rollback boundary.

## 24. Explicit non-adoption statement

No production strategy, Current Opportunity, Research Cycle, evidence, maturity,
readiness, Paper-Demo, UI, OpenClaw, broker, account, order, position, gateway, or
execution path imports or consumes the Phase 1 facade. Phase 1 is read-only,
shadow-only, non-authoritative infrastructure. It grants no execution, broker, or
readiness-override authority and does not implement Phase 2.
