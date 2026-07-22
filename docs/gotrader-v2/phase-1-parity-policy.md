# GoTrader V2 Phase 1 Parity Policy

## Governing rule

Phase 1 is additive and shadow-only. Existing strategy, source-selection,
fingerprint, replay, evidence, readiness, UI, and safety behavior remains the
compatibility authority.

## Frozen Phase 0 controls

| Control | Required SHA-256 |
|---|---|
| IFVG v3 positive canary | `1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a` |
| IFVG v2 negative control | `3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224` |
| Strategy catalog behavior | `43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de` |

Any change requires a separate reviewed fixture correction. Phase 1 must not
update these files merely to make a new adapter pass.

## Compatibility fingerprint

The legacy fingerprint is copied verbatim into `V2SourceIdentity`. Phase 1 never
recomputes, reformats, or replaces it. The richer V2 identity hash is additional,
versioned, and computed only from compact identity metadata.

## Equivalence rules

- Exact timing, OHLC, volume, and compatibility fingerprint produce
  `exact_match`.
- Exact timing and OHLC with volume or transport-fingerprint variance produce
  `equivalent_with_documented_variance`.
- Missing candles or OHLC/close-time differences produce `mismatch`.
- An empty side produces `insufficient_comparison_data`.
- A mismatch is diagnostic. Production data must not be rewritten to satisfy V2.

## Source substitution

No V2 query may silently change source kind, provider, source ID, requested
symbol, broker symbol, source fingerprint, or timeframe. Missing adapters and
sources fail with typed errors. Mock/sample data is never a fallback.

## Closed-candle parity

Only closed candles are returned. Polling uses open time plus normalized timeframe
duration. Push uses explicit close events. Frozen historical and replay data use
dataset closure. Unknown closure proof blocks. Open/partial candles are excluded
and reported.

## Deep-history boundary

Only a query with `purpose: deep_research` may request up to 50,000 candles.
Current read remains capped at 1,000 and context shadow at 5,000. Phase 1 exposes
no UI loader and schedules no automatic history request.

## Acceptance

Phase 1 must pass:

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
git diff --check
```

The Phase 1 suite is deterministic and is included in `test:core` and
`test:source-integrity`. A live MT5 diagnostic is optional and must fail closed
when local services are unavailable.

## Rollback

The entire facade is isolated under `src/lib/v2`, with one test script, test
manifest additions, package script, and Phase 1 documents. No production consumer
depends on it. Reverting the Phase 1 commits therefore restores the exact Phase
0.5 runtime without data migration or storage rollback.
