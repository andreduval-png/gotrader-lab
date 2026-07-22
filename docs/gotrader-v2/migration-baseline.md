# GoTrader V2 Migration Baseline

## Baseline identity

```text
branch: gotrader-v2/phase-0-baseline
contentBaselineCommit: 15e55d439b1394b6be2d8271aff32f9b7a70bedf
sourceBranch: local-restart-safety-check-2
sourceBaseCommit: f6dbe33489a122d36995c5eb260d763917d186b3
architectureRevision: gotrader-v2-architecture-rev1
snapshotSchemaVersion: gotrader-v2-normalized-snapshot-v1
strategyManifestVersion: gotrader-v2-strategy-manifest-v1
testManifestVersion: gotrader-v2-test-manifest-v1
```

The content baseline commit is the immutable reference for Phase 1 parity. The
report-only Phase 0.5 handoff commit follows it and does not alter strategy code,
fixtures, manifests, test behavior, or the architecture specification.

## Fixture hashes

| Fixture | SHA-256 |
|---|---|
| IFVG v3 positive canary | `1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a` |
| IFVG v2 negative control | `3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224` |
| Strategy catalog behavior | `43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de` |

Snapshot comparisons normalize CRLF to LF before canonical comparison. This
preserves identical hashes across Windows and Unix checkouts without changing
the serialized fixture payloads.

## Acceptance reproduction

From `C:/Users/andre/OneDrive/Documents/gotrader-v2-phase0-baseline`:

```powershell
npm.cmd install
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
git diff --check
```

The repaired deterministic harnesses can be checked independently with:

```powershell
npm.cmd run test:gotrader-system-coordination
npm.cmd run test:ict-phase2-models
npm.cmd run test:regime-classifier
npm.cmd run test:ict-out-of-sample-validation
```

The OOS command uses explicit MT5 read-only history when it is available. A
fail-closed source-unavailable result is acceptable when the local wrapper is
offline; it must never substitute mock/sample evidence.

## Preserved work

- Active source worktree: `C:/Users/andre/OneDrive/Documents/gotrader`
- Clean migration worktree: `C:/Users/andre/OneDrive/Documents/gotrader-v2-phase0-baseline`
- Preservation stash: `ac572c4a7d69095db06918b2bd5f445ff3714241`
- Stash message: `preserve pre-v2-phase-0-5 dirty worktree 2026-07-22`
- Detailed inventory: `docs/gotrader-v2/phase-0-5-preservation-manifest.md`

The stash was applied back to the active source worktree after capture. The
source files therefore remain in place, and the stash provides a second recovery
copy. Secrets, local environment files, caches, logs, build output, and runtime
state were not copied into the migration baseline.

## Authority clarification

The governing V2 authority contract is:

```ts
authority: {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}
marketDataAccess: "read_only";
transportCapability: "market_data_read_only";
```

The legacy MT5 push-feed contract still reports `brokerAuthority: read_only` as
a market-data transport label. Phase 0.5 keeps this compatibility surface because
renaming it would affect existing normalizer, store, test, and forward-evidence
consumers. Safety assertions prove that the legacy value exposes no account,
order, position, mutation, or execution capability. A future V2 adapter must map
it to `marketDataAccess` and emit strict `brokerAuthority: none`.

## Known pre-existing warnings

- Rollup reports circular chunk relationships in existing barrel imports.
- The main bundle exceeds the configured 500 kB warning threshold.
- The baseline has no lint command/configuration and no CI workflow.
- Some deterministic strategy families do not yet have reviewed serialized
  golden fixtures.
- Generic rolling OOS can report `insufficient_data`; this does not replace the
  frozen detector-specific IFVG v3 evidence.
- The legacy push-feed market-data capability label remains pending adapter-based
  deprecation.

## Migration rule

Every V2 migration slice must preserve these hashes and acceptance suites unless
a fixture change is separately reviewed and explained. Phase 1 must begin in a
new namespace with a read-only candle facade and shadow-only outputs. It may not
change production detection, evidence, readiness, UI decisions, broker behavior,
or authority.
