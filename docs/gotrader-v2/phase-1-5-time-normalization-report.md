# GoTrader V2 Phase 1.5 Time Normalization Report

## Status

```text
PHASE 1.5 BLOCKED — MT5 TIME BASIS UNPROVEN
```

The deterministic time contract and shadow adapter are implemented and verified. The live upstream still does not declare its broker timezone or DST contract, so production adoption and Phase 2 remain blocked.

## 1. Starting Branch and Commit

- Branch: `gotrader-v2/phase-1-candle-facade`
- Commit: `5ed99fec3d6cefa0d335c1bb907e563b606d2eb9`
- Worktree: clean

## 2. Final Branch and Commit

- Branch: `gotrader-v2/phase-1-5-mt5-time-normalization`
- Commit: recorded after final validation

## 3. Files

Created:

- `src/lib/v2/time/v2TimeNormalizationTypes.ts`
- `src/lib/v2/time/v2TimeNormalization.ts`
- `src/lib/v2/time/index.ts`
- `src/lib/v2/candles/v2Mt5TimeNormalizedAdapter.ts`
- `scripts/test-v2-mt5-time-normalization.mjs`
- `scripts/diagnose-v2-mt5-time-normalization.mjs`
- the four Phase 1.5 documents in this directory

Modified:

- V2 candle metadata, validation, window builder, static repository, identity, and exports
- `package.json`
- `scripts/v2-baseline/test-manifest.json`

## 4. MT5 Timestamp Path Map

The full path map is in `phase-1-5-mt5-time-contract.md`. The upstream applies UTC conversion directly to raw `tick.time` and `copy_rates_*().time`; wrapper, client, source manager, and push paths then assume that conversion is correct. Session-sensitive consumers assume incoming timestamps are UTC instants.

## 5. Proven Raw Time Basis

The current upstream payload basis is not proven. Live values behave like broker wall-clock values encoded as epoch-shaped numbers and are approximately three hours ahead of trusted UTC in July. No payload offset, IANA timezone, or DST contract is present. Phase 1.5 therefore classifies the default basis as `unknown`.

## 6. Time Policy

- ID: `gotrader-v2-mt5-server-time`
- Version: `1`
- Output: UTC
- Default live basis: `unknown`, blocked
- Supported verified modes: explicit UTC epoch/ISO, explicit-offset ISO, configured IANA wall clock, explicit fixed-offset wall clock

## 7. Normalization Algorithm

The pure adapter strictly parses the declared basis. IANA wall-clock conversion finds UTC instants that reproduce the provider fields in the configured zone. No matches block nonexistent DST times; multiple matches block ambiguous DST times. There is no implicit local parsing and no hard-coded offset.

## 8. Trusted Reference Clock

System UTC is primary. Receive time and any optional independently normalized provider clock must fall within configured skew. Wrapper values derived from the same raw MT5 timestamp are not independent proof.

## 9. Closure Proof

Normalized close equals normalized open plus timeframe duration. Eligibility requires close at or before trusted reference minus tolerance. Explicit push close cannot override future, partial, invalid, or unproven time.

## 10. DST and Session Fixtures

The suite passes normal EST and EDT dates, New York midnight, Sunday boundary, 09:30 open, all three Silver Bullet hours, Helsinki winter/summer offset changes, spring-forward nonexistence, and fall-back ambiguity.

## 11. Identity Impact

V2 identity schema advanced to `gotrader-v2-market-data-identity-v2`. Time policy ID/version are hashed. A version change changes the V2 identity hash. The legacy source fingerprint remains unchanged.

## 12. Authority

Authority remains `none / none / none`. Market access remains read-only. No mutation or execution endpoint was called or added.

## 13. Deterministic Push/Polling Parity

Result: `exact_match` after both fixture transports use the same policy.

## 14. Live Push/Polling Parity

Result: `insufficient_comparison_data`. The current browser event adapter republishes polling candles; no independent network push publisher is available. No mock result was substituted.

## 15. Live Diagnostic

Default fail-closed run:

- input candles: 1,000
- apparent future candles under claimed UTC: 36
- retained candles: 0
- status: `blocked_time_basis_unverified`

Configured `Europe/Helsinki` candidate run:

- applied offset: +180 minutes, daylight state
- raw-to-UTC delta: -10,800,000 ms
- future candles after normalization: 0
- retained closed candles: 999
- excluded partial candles: 1
- status: degraded only by the current partial candle and documented market/session gaps

This candidate result removes the observed skew but does not prove that the broker contract is Helsinki.

## 16. Tests and Commands

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | passed |
| `npm.cmd run build` | passed; existing Rollup circular-chunk and large-chunk warnings only |
| `npm.cmd run test` | passed |
| `npm.cmd run test:core` | passed |
| `npm.cmd run test:strategy-baselines` | passed |
| `npm.cmd run test:source-integrity` | passed |
| `npm.cmd run test:provenance` | passed |
| `npm.cmd run test:safety` | passed |
| `npm.cmd run test:browser-smoke` | passed, 44/44 |
| `npm.cmd run test:v2-baseline-snapshots` | passed; byte-stable |
| `npm.cmd run test:v2-candle-repository` | passed |
| `npm.cmd run test:v2-mt5-time-normalization` | passed |
| `git diff --check` | passed |

## 17. Exact Results

The focused suite reports 12 DST/session fixtures, exact deterministic parity, unknown-basis blocking, immutable raw-time audit, unchanged legacy fingerprint, and authority `none / none / none`.

## 18. Baseline Hashes

Expected unchanged hashes:

- IFVG v3: `1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a`
- IFVG v2: `3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224`
- Strategy catalog: `43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de`

## 19. Known Limitations

- Upstream does not declare provider timezone, offset semantics, DST policy, or an independent UTC server clock.
- One summer offset sample cannot prove the year-round provider policy.
- No independent live push publisher exists.
- Phase 1 gap classification remains session-calendar agnostic.

## 20. Rollback

Revert the Phase 1.5 commit or stop constructing `createV2Mt5TimeNormalizedRepository`. The production path was not modified and requires no data migration.

## 21. Phase 2 Eligibility

Not eligible. First add or verify a versioned read-only upstream time contract, then rerun winter/summer live diagnostics and independent push/poll parity.

## 22. Production Adoption

No production strategy, detector, Current Read, Research Cycle, session calculation, replay/evidence system, readiness surface, UI, OpenClaw flow, Paper-Demo flow, or broker path adopted the Phase 1.5 V2 adapter.
