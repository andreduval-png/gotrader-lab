# GoTrader V2 Phase 0 Baseline Report

## Status

**PHASE 0 PASSED**

Phase 0 established compatibility manifests, normalized fixtures, source/timing
checks, safety assertions, suite orchestration, and migration policy. Phase 0.5
subsequently isolated that work on a clean branch and removed accidental
dependencies on unrelated uncommitted features.

## Metadata

```text
phase0Branch: gotrader-v2/phase-0-baseline
phase0BaseCommit: f6dbe33489a122d36995c5eb260d763917d186b3
phase0FinalCommit: 15e55d439b1394b6be2d8271aff32f9b7a70bedf
architectureRevision: gotrader-v2-architecture-rev1
snapshotSchemaVersion: gotrader-v2-normalized-snapshot-v1
strategyManifestVersion: gotrader-v2-strategy-manifest-v1
testManifestVersion: gotrader-v2-test-manifest-v1
```

`phase0FinalCommit` identifies the reviewed content baseline. Later report-only
metadata commits do not change its strategy, fixture, suite, or architecture
content.

## Repository baseline

- Source branch: `local-restart-safety-check-2`
- Source base: `f6dbe33489a122d36995c5eb260d763917d186b3`
- Isolated worktree: `C:/Users/andre/OneDrive/Documents/gotrader-v2-phase0-baseline`
- Package manager: npm with committed `package-lock.json`
- Node: `v24.15.0`
- npm: `11.13.0`
- TypeScript: `5.9.3`
- Playwright: `1.60.0`
- CI: no workflow present at the baseline
- Lint: no command or configuration present at the baseline

## Governing documents

- `docs/architecture/gotrader-v2-audit.md`
- `docs/architecture/gotrader-v2-verification-report.md`
- `docs/architecture/gotrader-v2-architecture-specification-rev1.md`

Revision 1 is now a complete standalone specification. It governs incremental
compatibility migration, separate detection/research state machines, identity and
lineage, instrument-neutral risk, MT5 read-only market-data capability, evidence
artifacts, orchestration, migration modes, governance, and rollback.

## Strategy manifest

The manifest contains 27 entries:

- one positive canary: `ifvg_fresh_retest_v3_research`;
- one negative control: `ifvg_filtered_v2_research`;
- 14 behavioral fixtures;
- two experimental profiles;
- three diagnostics;
- six placeholders.

All entries retain:

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

Placeholders remain non-executable. Diagnostics remain context-only and
geometry-free.

## Golden fixtures

```text
ifvg-v3-positive-canary.snapshot.json
  1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a

ifvg-v2-negative-control.snapshot.json
  3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224

strategy-catalog-behavior.snapshot.json
  43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de
```

Generation runs twice in memory and compares canonical payloads. The comparison
normalizes checkout CRLF to LF so Windows and Unix worktrees preserve the same
canonical hashes.

## Harness repairs

Four neutral harness repairs are included:

1. `test-gotrader-system-coordination.mjs` compiles current IFVG dependencies,
   stubs the forward scenario boundary, and expects the current compact identity
   note.
2. `test-ict-out-of-sample-validation.mjs` compiles an explicit local barrel and
   neutral current-opportunity/forward-scenario adapters.
3. `test-ict-phase2-models.mjs` compiles its actual dependencies and accepts the
   current fail-closed non-directional blocker for its flat fixture.
4. `test-regime-classifier.mjs` marks the event fixture's macro context as
   available live; planned/mock macro context remains ignored.

No detector, threshold, target/stop rule, readiness rule, or source algorithm was
changed.

## Isolation correction

The original dirty Phase 0 manifest referenced two uncommitted feature streams:

- `test:research-cycle-validation-linkage`;
- `test:research-quality-failure-attribution`.

Those files and their production helpers are unrelated to the baseline and were
not imported. The clean manifest uses committed source-status, validation-chain,
and regime coverage instead. The excluded work remains recoverable through the
preservation manifest and stash.

## Authority terminology

Strict research, strategy, fixture, evidence, and readiness artifacts use
`none/none/none`.

The legacy MT5 push-feed type uses `brokerAuthority: read_only` to describe
market-data transport. This is not broker mutation authority. Phase 0.5 did not
make a breaking rename because its consumers include the push-feed normalizer,
store/tests, and forward-evidence candle identity validator.

The V2 target contract uses:

```ts
marketDataAccess: "read_only";
transportCapability: "market_data_read_only";
authority: {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}
```

The safety suite asserts that the legacy label cannot expose broker mutation
functions or be interpreted as broker authority.

## Verification

| Command | Result |
|---|---|
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed with pre-existing Rollup warnings |
| `npm.cmd run test` | Passed |
| `npm.cmd run test:core` | Passed, 9 commands |
| `npm.cmd run test:strategy-baselines` | Passed, 9 commands |
| `npm.cmd run test:source-integrity` | Passed, 4 commands |
| `npm.cmd run test:provenance` | Passed, 2 committed commands |
| `npm.cmd run test:safety` | Passed, 4 commands |
| `npm.cmd run test:browser-smoke` | Passed, 44 Playwright tests |
| `npm.cmd run test:v2-baseline-snapshots` | Passed, hashes unchanged |
| `npm.cmd run test:ict-out-of-sample-validation` | Passed, explicit 90-day source |
| `git diff --check` | Passed |

The 90-day generic OOS harness completed over 17,521 candles and five rolling
windows. It correctly reported zero approved outcomes and `insufficient_data`;
this is a research result, not a migration failure and not a replacement for the
detector-specific IFVG v3 frozen evidence.

## Safety result

- No `/execute` route exists.
- MT5 account/order/position/mutation paths return 403.
- Mock/sample sources cannot create validation evidence.
- OpenClaw drafts cannot grant authority or auto-apply.
- Autonomous calibration remains explicit opt-in and frozen profiles cannot be
  mutated in place.
- Fixtures contain no candles, raw snapshots, secrets, account/order/position
  data, or screenshots/base64.
- Phase 0.5 introduced no broker path or production route.

## Pre-existing warnings

- Rollup reports circular chunk relationships in existing barrel imports.
- The main bundle exceeds the configured 500 kB warning threshold.
- No lint configuration or CI workflow exists.
- Several strategy families have deterministic tests but no reviewed serialized
  output fixture yet.
- Generic rolling OOS remains `insufficient_data` for its current approval path.
- The legacy push-feed market-data label awaits adapter-based deprecation.

## Phase 1 prerequisites

1. Accept the isolated content baseline and preservation record.
2. Keep all Phase 1 contracts in a new V2 namespace.
3. Implement only a read-only candle facade first.
4. Preserve current fingerprints behind a compatibility adapter.
5. Route no V2 output into detection, evidence, readiness, UI decisions, or broker
   code during the initial shadow slice.
6. Require the complete baseline acceptance matrix before every migration commit.

## Final statement

Phase 0 and Phase 0.5 changed test and documentation infrastructure only. They did
not intentionally change detector behavior, thresholds, trade geometry, evidence
promotion, readiness, source activation, storage authority, broker authority, or
execution capability.

Phase 1 is not implemented or authorized by this report.
