# GoTrader V2 Phase 0.5 Isolation Report

## 1. Initial repository status

The source repository was on `local-restart-safety-check-2` at
`f6dbe33489a122d36995c5eb260d763917d186b3`. It contained 58 tracked modified
paths and 24 untracked path groups. The index was not used as a migration source.
The configured remotes were `origin` (`fxgotrader-lab/gotrader-lab`) and
`andreduval` (`andreduval-png/gotrader-lab`). The existing `main` branch was one
commit ahead of `origin/main`; Phase 0.5 did not modify or push either remote.

## 2. Dirty-worktree classification

Every changed path was classified before isolation. The Phase 0 set contained
architecture documents, V2 baseline contracts, normalized fixtures, baseline
suite scripts, and four neutral deterministic harness repairs. Excluded work was
classified as account-risk experiments, paper-gateway work, MT5 local-stack work,
autonomous research, research-quality attribution, operator UI, forward evidence,
unrelated feature work, generated runtime artifacts, or local cache output.

The exact path-by-path preservation boundary is recorded in
`docs/gotrader-v2/phase-0-5-preservation-manifest.md`.

## 3. Preservation method

Tracked and untracked source work was captured in a named stash while excluding
Python cache output. The resulting stash object is
`ac572c4a7d69095db06918b2bd5f445ff3714241`. It was immediately applied back to
the source worktree, preserving the user's active files. A tracked binary diff
hash was checked before and after the round trip and remained
`a4dae5df0eb15ca26f9bc0c8461c978f4cc1195e`.

## 4. Preservation locations

```text
active source worktree: C:/Users/andre/OneDrive/Documents/gotrader
clean migration worktree: C:/Users/andre/OneDrive/Documents/gotrader-v2-phase0-baseline
preservation stash: ac572c4a7d69095db06918b2bd5f445ff3714241
preservation message: preserve pre-v2-phase-0-5 dirty worktree 2026-07-22
```

Earlier dirty-inventory and quarantine stashes remain present and were not
altered. No experimental or sensitive work was pushed.

## 5. Phase 0 branch

`gotrader-v2/phase-0-baseline`

## 6. Phase 0 base commit

`f6dbe33489a122d36995c5eb260d763917d186b3`

## 7. Phase 0 commit list

| Commit | Subject |
|---|---|
| `a432d9e74c331045fef0cc7c0c8779fd24be8c0c` | `docs(v2): establish governing architecture and baseline policies` |
| `96de5a1cd69bbf0a7503e3bf0477bb263808af81` | `test(v2): add strategy manifest and normalized baseline fixtures` |
| `593fc7dbb5cebbd3771d6d815c8832fe67c77cfd` | `test(v2): add baseline suites and safety assertions` |
| `7dfa4b228380c9a4b3ff3c6ce7ccd59e40c9bf69` | `test: repair stale deterministic harness infrastructure` |
| `15e55d439b1394b6be2d8271aff32f9b7a70bedf` | `docs(v2): finalize standalone architecture specification` |

The final report/metadata commit follows these content commits. The migration
baseline SHA remains `15e55d439b1394b6be2d8271aff32f9b7a70bedf`.

## 8. Exact files committed

```text
docs/architecture/gotrader-v2-architecture-specification-rev1.md
docs/architecture/gotrader-v2-audit.md
docs/architecture/gotrader-v2-verification-report.md
docs/gotrader-v2/golden-fixture-policy.md
docs/gotrader-v2/migration-parity-policy.md
docs/gotrader-v2/strategy-manifest.md
docs/gotrader-v2/test-manifest.md
package.json
scripts/test-gotrader-system-coordination.mjs
scripts/test-ict-out-of-sample-validation.mjs
scripts/test-ict-phase2-models.mjs
scripts/test-regime-classifier.mjs
scripts/v2-baseline/compile-typescript-modules.mjs
scripts/v2-baseline/generate-baseline-snapshots.mjs
scripts/v2-baseline/run-baseline-suite.mjs
scripts/v2-baseline/test-baseline-authority.mjs
scripts/v2-baseline/test-manifest.json
scripts/v2-baseline/test-source-timing-baseline.mjs
scripts/v2-baseline/test-strategy-baseline-manifest.mjs
src/lib/v2Baseline/baselineSafetyAssertions.ts
src/lib/v2Baseline/baselineTypes.ts
src/lib/v2Baseline/index.ts
src/lib/v2Baseline/normalizeBaselineSnapshot.ts
src/lib/v2Baseline/strategyBaselineManifest.ts
tests/fixtures/v2-baseline/baseline-snapshot-hashes.json
tests/fixtures/v2-baseline/ifvg-v2-negative-control.snapshot.json
tests/fixtures/v2-baseline/ifvg-v3-positive-canary.snapshot.json
tests/fixtures/v2-baseline/strategy-catalog-behavior.snapshot.json
```

The report-only handoff commit additionally contains the preservation manifest,
Phase 0 baseline report, migration baseline, and this isolation report.

## 9. Exact unrelated files excluded

The preservation manifest lists all 58 tracked modified paths and all unrelated
untracked source paths excluded from the branch. The principal excluded groups
are the paper gateway, MT5 local upstream, autonomous calibration, forward
evidence, operator console, account risk, research-quality attribution,
validation-linkage experiments, and unrelated UI changes. Generated and local
material excluded includes `scripts/__pycache__/`, `dist/`, `.gotrader/`,
`state/regime_history.jsonl`, local logs, environment files, and the clean
worktree's `node_modules` junction.

No excluded file is required to build or test this migration branch. Two original
manifest commands that depended on uncommitted validation-linkage and quality-
attribution work were replaced with committed neutral provenance coverage.

## 10. Revision 1 completeness

Revision 1 is now a standalone governing specification. It covers compatibility
migration, the candle facade, canonical context/state, strategy adapters,
separate detection and research state machines, identity and lineage, typed facts
and timing, confluence/conflict separation, trade geometry, instrument-neutral
risk with an MT5 CFD adapter, evidence artifacts, narrative/operator projections,
orchestration, Hybrid Migration modes, trust boundaries, governance, testing,
experiments, performance budgets, rollback, and the verified Phase 0-10 roadmap.

The audit and verification report remain supporting evidence rather than required
missing context.

## 11. Authority terminology decision

Phase 0.5 did not make a breaking production rename. The legacy MT5 push-feed
`brokerAuthority: read_only` value is treated solely as a market-data transport
capability. Tests assert that it cannot grant account, order, position, mutation,
or execution access.

The V2 contract separates this concern as `marketDataAccess: read_only` or
`transportCapability: market_data_read_only`, while retaining strict authority:

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

## 12. Migration-baseline SHA

`15e55d439b1394b6be2d8271aff32f9b7a70bedf`

This SHA identifies the reviewed architecture, fixtures, manifests, suites, and
harness content. The subsequent documentation-only handoff commit does not alter
that baseline.

## 13. Snapshot hashes

```text
IFVG v3 positive canary:
1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a

IFVG v2 negative control:
3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224

Strategy catalog behavior:
43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de
```

## 14. Tests and commands run

```text
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
npm.cmd run test:gotrader-system-coordination
npm.cmd run test:ict-phase2-models
npm.cmd run test:regime-classifier
npm.cmd run test:ict-out-of-sample-validation
git diff --check
```

## 15. Results

All required suites passed. Browser smoke passed 44/44 routes. All 27 manifest
entries validated. Fixture hashes remained unchanged. IFVG v3 remained the
positive canary, IFVG v2 remained the negative control, placeholders stayed
non-executable, diagnostics stayed geometry-free, and mock/sample sources could
not create evidence.

The explicit 90-day generic OOS harness evaluated 17,521 candles over five
windows and correctly returned zero approved outcomes with `insufficient_data`.
This result is not a Phase 0 failure and does not replace frozen detector-specific
IFVG v3 evidence.

## 16. Remaining pre-existing warnings

- Rollup circular chunk warnings remain in existing barrel imports.
- The main bundle remains above the 500 kB warning threshold.
- No lint configuration or CI workflow exists at this baseline.
- Several strategy families lack reviewed serialized golden fixtures.
- Generic rolling OOS may remain `insufficient_data` for its current path.
- The legacy push-feed transport label still needs a compatibility adapter before
  deprecation.

## 17. Repository cleanliness

The Phase 0 branch is clean after the report-only handoff commit, apart from
ignored local dependencies/build/runtime material. The original source worktree
intentionally remains dirty with its preserved unrelated work. No Phase 0 file is
left unstaged or untracked on the migration branch.

## 18. Rollback procedure

Delete only the clean worktree/branch if the migration baseline is rejected; the
source worktree is independent. To reconstruct the preserved dirty state in a
new location:

```powershell
git worktree add C:\Users\andre\OneDrive\Documents\gotrader-dirty-recovery f6dbe33489a122d36995c5eb260d763917d186b3
git -C C:\Users\andre\OneDrive\Documents\gotrader-dirty-recovery stash apply ac572c4a7d69095db06918b2bd5f445ff3714241
```

Do not drop the preservation stash until all excluded feature streams are
independently resolved.

## 19. Phase 1 prerequisites

1. Review and accept the migration baseline SHA and fixture hashes.
2. Preserve the existing strategy library behind compatibility adapters.
3. Begin in a V2 namespace with a read-only candle facade only.
4. Preserve source fingerprints and authority through explicit adapters.
5. Keep the first context builder shadow-only and non-authoritative.
6. Require the complete Phase 0 acceptance matrix for every migration slice.
7. Define an adapter plan for the legacy push-feed capability label before using
   it in V2 contracts.

## 20. Phase boundary

Phase 1 was not implemented. No candle repository facade, canonical market
context engine, strategy flow engine, risk engine, conflict resolver, artifact
migration, UI migration, broker gateway, or execution path was added.

## Final status

**PHASE 0.5 PASSED WITH DOCUMENTED PRESERVED WORK**
