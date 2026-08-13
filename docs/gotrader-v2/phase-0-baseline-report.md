# GoTrader V2 Phase 0 Baseline Report

## Status

**PHASE 0 PASSED WITH DOCUMENTED PREEXISTING FAILURES**

Phase 0 established compatibility manifests, compact normalized snapshots, safety assertions, source/time checks, suite orchestration, and migration policy. It did not implement any Phase 1 runtime architecture.

## 1. Repository and worktree

- Repository: `C:/Users/andre/OneDrive/Documents/gotrader`
- Branch: `local-restart-safety-check-2`
- Baseline HEAD: `f6dbe33489a122d36995c5eb260d763917d186b3`
- Package manager: npm with `package-lock.json`
- Node: `v24.15.0`
- npm: `11.13.0`
- TypeScript: `5.9.3`
- Playwright: `1.60.0`
- Test model: custom deterministic Node scripts plus Playwright browser smoke
- CI: no `.github` workflow present
- Lint: no lint command or configuration present

The worktree was already substantially dirty and contained mixed account-risk, paper-gateway, MT5/local-stack, autonomous research, research-quality, UI, operator-console, and forward-evidence work. Phase 0 did not stash, reset, delete, stage, or commit that work. At final reporting, `git status --porcelain` contains 69 modified paths and 24 untracked path groups, including the additive Phase 0 files. The index remains clean.

Ignored local/runtime material includes `.env.local`, `.gotrader/`, `dist/`, logs/artifacts, and Python cache output. `scripts/__pycache__/` remains an untracked local artifact and is not part of Phase 0.

## 2. Governing documents

Read completely:

- `docs/gotrader-v2-audit.md`
- `docs/gotrader-v2-verification-report.md`
- supplied `gotrader-v2-architecture-specification-rev1.md`

Repository-safe copies now live under `docs/architecture/`. Revision 1 confirms Detection Flow versus Research Lifecycle, instrument-neutral risk with an MT5 adapter, Hybrid Migration, profile-scoped adapter-first migration, separation of live confluence from historical evidence, and stronger identity/lineage.

The supplied Revision 1 file is only a short governing summary, not a complete standalone specification. Phase 0 therefore does not infer missing requirements; the verification report retains amendment rationale and the audit retains the verified repository baseline.

## 3. Files created and modified

Created:

- `docs/architecture/gotrader-v2-audit.md`
- `docs/architecture/gotrader-v2-verification-report.md`
- `docs/architecture/gotrader-v2-architecture-specification-rev1.md`
- `docs/gotrader-v2/strategy-manifest.md`
- `docs/gotrader-v2/test-manifest.md`
- `docs/gotrader-v2/golden-fixture-policy.md`
- `docs/gotrader-v2/migration-parity-policy.md`
- `docs/gotrader-v2/phase-0-baseline-report.md`
- `src/lib/v2Baseline/baselineTypes.ts`
- `src/lib/v2Baseline/baselineSafetyAssertions.ts`
- `src/lib/v2Baseline/normalizeBaselineSnapshot.ts`
- `src/lib/v2Baseline/strategyBaselineManifest.ts`
- `src/lib/v2Baseline/index.ts`
- `scripts/v2-baseline/compile-typescript-modules.mjs`
- `scripts/v2-baseline/generate-baseline-snapshots.mjs`
- `scripts/v2-baseline/test-strategy-baseline-manifest.mjs`
- `scripts/v2-baseline/test-baseline-authority.mjs`
- `scripts/v2-baseline/test-source-timing-baseline.mjs`
- `scripts/v2-baseline/test-manifest.json`
- `scripts/v2-baseline/run-baseline-suite.mjs`
- four files under `tests/fixtures/v2-baseline/`

Modified only for Phase 0 infrastructure:

- `package.json` - additive scripts only; no dependency change
- `scripts/test-gotrader-system-coordination.mjs`
- `scripts/test-ict-out-of-sample-validation.mjs`
- `scripts/test-ict-phase2-models.mjs`
- `scripts/test-regime-classifier.mjs`

No detector, threshold, strategy qualification, stop/target, evidence promotion, readiness threshold, production route, or storage implementation was modified.

## 4. Strategy manifest

The manifest contains 27 entries: 22 first-class Strategy Library definitions and five supplemental legacy engines.

- Positive canary: `ifvg_fresh_retest_v3_research`
- Negative control: `ifvg_filtered_v2_research`
- Experimental: `ifvg_fresh_retest_v4_candidate`, `cmd_high_displacement_v2_research`
- Diagnostic: `market_map_only_diagnostic_v1`, `ict-order-block-taxonomy`, `universal_recognition_service`
- Placeholders: `camerons_model_research_v1`, `crt_research_v1`, `ote_research_v1`, `amd_power_of_three_research_v1`, `pd_array_setup_research_v1`, `scalp_setup_research_v1`
- Behavioral parity: Silver Bullet v1/v2, IFVG v1, Turtle Soup, CISD, CMD paper-watchlist definition, all three Grinch entries, session raid v1/v2, Bread & Butter buy/sell, and One Shot One Kill

The machine validator detects duplicate IDs, missing versions/classifications/detectors/tests/fixture references, placeholders marked executable, and authority deviation. It validates all 27 entries. Full paths and per-profile test references are in `strategyBaselineManifest.ts` and `strategy-manifest.md`.

## 5. Test manifest and commands

Added:

- `npm.cmd run typecheck`
- `npm.cmd run test:core`
- `npm.cmd run test:strategy-baselines`
- `npm.cmd run test:source-integrity`
- `npm.cmd run test:provenance`
- `npm.cmd run test:safety`
- `npm.cmd run test:browser-smoke`
- `npm.cmd run test:deep-research`

Deep-history jobs are intentionally outside the fast core suite. The runner reads `scripts/v2-baseline/test-manifest.json`, rejects missing commands, stops at the first failed command, and returns nonzero.

## 6. Infrastructure repairs and decisions

1. `test:gotrader-system-coordination` used a stale partial-compile list. IFVG and session-raid dependencies plus current-opportunity/forward-scenario test adapters were added. Its expected Current Read note was updated to the current intentional compact-evidence identity wording.
2. `test:ict-out-of-sample-validation` compiled the production barrel while omitting newer modules. The harness now emits a barrel only for its selected modules and supplies explicit test adapters. Detector logic is unchanged.
3. `test:ict-phase2-models` had the same partial-compile defect. The harness now includes its actual advisor dependencies. A stale expectation that every missing-HTF fixture must say “higher-timeframe” was corrected: the present fixture is flat, and current intentional behavior blocks it as non-directional because HTF alignment is not required for a flat/no-trade state.
4. `test:regime-classifier` asserted a live event regime while marking macro context as planned/mock. The fixture now marks macro status `available_live`; the classifier remains unchanged and continues to ignore planned context.
5. The manifest initially referenced a nonexistent CMD audit filename. It now references the actual `docs/cmd-deep-telemetry-audit.md`.

## 7. Golden fixtures

Created compact snapshots:

- `ifvg-v3-positive-canary.snapshot.json`: valid, forming, and rejected IFVG v3 states; exact candidate geometry; bounded detector identity; historical replay and frozen OOS summaries; authority.
- `ifvg-v2-negative-control.snapshot.json`: valid local detector geometry alongside known degraded independent-window behavior; it remains a negative control.
- `strategy-catalog-behavior.snapshot.json`: all 27 manifest entries, classifications, profile identities, test references, and authority.
- `baseline-snapshot-hashes.json`: SHA-256 hashes.

IFVG v3’s historical summary records 172 completed research trades, 55.23% target-first, 2.805R average, 5.979 profit factor, 95 unique dates, 11/11 positive rolling windows, 64 frozen OOS trades, 2/2 OOS windows, 3.458R OOS average, 8.081 OOS profit factor, and 2.958R average after an additional 0.5R cost. These values are transcribed with their audit provenance, not presented as a new Phase 0 performance run.

Other strategy families are identified by manifest fixture IDs and protected by their existing deterministic commands. Where no compact trustworthy serialized result exists, serialized baseline status remains blocked rather than fabricated.

## 8. Snapshot normalization

Snapshots use `gotrader-v2-normalized-snapshot-v1`. Normalization removes run-local timestamps and IDs, normalizes machine paths, sorts keys recursively, and emits canonical JSON. It preserves market timestamps, source/profile/parameter identity, blockers, prices, RR, replay/OOS metrics, provenance, and authority. Generation ran twice per check and produced byte-stable output.

Current hashes:

- IFVG v3: `1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a`
- IFVG v2: `3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224`
- Catalog: `43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de`

## 9. Authority and safety

Passed checks establish:

- strategy and research artifacts use `none/none/none`;
- snapshots contain no raw candles, secrets, account/order/position data, or screenshots/base64;
- `/execute` is not routed;
- MT5 mutation/account/order/position endpoints return 403;
- OpenClaw drafts cannot grant authority or auto-apply;
- autonomous calibration defaults off and cannot mutate frozen IFVG profiles;
- mock source cannot create evidence through the validation chain.

Preexisting terminology mismatch: the MT5 push-feed transport reports `brokerAuthority: read_only` to describe market-data access, while strategy/research artifacts and the MT5 wrapper’s blocked mutation responses report broker authority `none`. The transport has `executionAuthority: none`, stale events do not trigger trading, and no mutation path exists. Revision 1 must clarify whether transport capability should be renamed before Phase 1; Phase 0 did not change production semantics.

## 10. Source and timing integrity

Passed coverage includes duplicate and out-of-order rejection, invalid OHLC rejection, stable source fingerprinting, symbol normalization, New York EST/EDT open conversion, weekend classification, MT5 push duplicate suppression, closed-candle refresh behavior, stale-feed no-trading behavior, and M5/M15/H1/H4/D1/W1 context with D1-derived weekly fallback. Raw candles remain internal.

## 11. Browser smoke

Playwright Chromium was already available. `npm.cmd run test:browser-smoke` passed 44/44 tests in approximately two minutes, including shell, Overview, Advisor/Decisions, Performance/Results, Settings, Strategy Library, ICT Lab, lazy route navigation, canvas/fallback rendering, safe defaults, and paper-demo operations. No `/execute` route or Phase 0 lazy-import/console failure was observed.

## 12. Exact verification results

| Command | Result |
|---|---|
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed; preexisting Rollup circular-chunk and large-chunk warnings |
| `npm.cmd run test` | Passed |
| `npm.cmd run test:core` | Passed, 9 commands |
| `npm.cmd run test:strategy-baselines` | Passed, 9 commands |
| `npm.cmd run test:source-integrity` | Passed, 4 commands |
| `npm.cmd run test:provenance` | Passed, 3 commands |
| `npm.cmd run test:safety` | Passed, 4 commands |
| `npm.cmd run test:browser-smoke` | Passed, 44 Playwright tests |
| `npm.cmd run test:gotrader-system-coordination` | Passed after harness repair |
| `npm.cmd run test:ict-phase2-models` | Passed after harness repair |
| `npm.cmd run test:ict-out-of-sample-validation` | Passed after harness repair; 90 days, 17,521 candles, five windows, current generic approval robustness `insufficient_data` |
| `npm.cmd run test:detector-profile-walk-forward` | Passed; deterministic safe profile 2/2 and v4 2/2 |
| `npm.cmd run test:ifvg-performance` | Passed; live 90-day source sufficient, 650 valid candidates, current classification `needs_filtering`, no promotion |
| `npm.cmd run test:v2-baseline-snapshots` | Passed; two generations byte-stable |
| `git diff --check` | Passed; line-ending warnings only |

There is no lint command to run. The first bounded OOS attempt hit the external two-minute command bound after compilation was repaired; rerun with a six-minute bound passed in 113.9 seconds.

## 13. Preexisting failures and limitations

- Revision 1 is incomplete as a standalone specification.
- No repository lint or CI workflow exists.
- Build emits preexisting circular-chunk and large-chunk warnings.
- The working tree remains heavily dirty with unrelated development.
- Push-feed transport authority terminology differs from the strict research authority wording, while remaining read-only and non-executable.
- Most strategies have deterministic test protection but do not yet have reviewed compact serialized outputs.
- Current generic 90-day OOS validation has zero approved outcomes and reports insufficient data. This is a current research result, not a Phase 0 regression and not a replacement for detector-specific IFVG v3 frozen evidence.

## 14. Phase 0 regressions

None found. Positive canary and negative-control snapshots are stable; IFVG, Silver Bullet, Turtle Soup, CISD, Phase 2 models, Universal Recognition, and coordination tests pass. No production strategy behavior was intentionally changed.

## 15. Blocked serialized baselines

Compact serialized outputs remain to be reviewed for Silver Bullet v1/v2, Turtle Soup, CISD, CMD families, session raid v1/v2, Bread & Butter, One Shot One Kill, Grinch profiles, IFVG v1/v4, placeholders, and diagnostics. Existing deterministic tests are their current parity protection. Placeholders and diagnostics must remain blocked from active trade plans/evidence by policy.

## 16. Phase 1 prerequisites

Before a separate Phase 1 instruction:

1. Preserve or isolate the unrelated dirty worktree so migration changes can be reviewed independently.
2. Expand compact fixtures profile by profile only when trustworthy bounded inputs exist.
3. Resolve the `brokerAuthority: read_only` transport-label versus `none` research-authority terminology.
4. Treat the copied Revision 1 summary together with the verification report as governing context; do not infer omitted design detail.
5. Require `test:core`, `test:strategy-baselines`, `test:source-integrity`, `test:provenance`, `test:safety`, and browser smoke before migration parity is accepted.

## Final statement

Phase 0 introduced baseline and test infrastructure only. It did not intentionally change any production detector behavior, strategy threshold, candidate eligibility, trade geometry rule, evidence/readiness policy, route, storage authority, broker authority, or execution capability. Phase 1 is not implemented or authorized by this work.
