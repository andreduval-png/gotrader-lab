# GoTrader V2 Phase 0 Test Manifest

The machine-readable manifest is `scripts/v2-baseline/test-manifest.json`; `scripts/v2-baseline/run-baseline-suite.mjs` executes named suites and stops on the first failure.

## Commands

| Command | Purpose |
|---|---|
| `npm.cmd run test:core` | Fast deterministic type, catalog, snapshot, source, time-contract, context, session/opening-fact, regime, provenance, push-feed, and authority checks. |
| `npm.cmd run test:strategy-baselines` | Representative detector and legacy-engine parity checks. |
| `npm.cmd run test:source-integrity` | Source identity, timing, offset-regime continuity, shadow context, session/opening-fact, push-feed, and multi-timeframe checks. |
| `npm.cmd run test:provenance` | Committed source and validation-chain lineage checks. |
| `npm.cmd run test:safety` | Authority, MT5 read-only, OpenClaw draft, and auto-apply safety checks. |
| `npm.cmd run test:browser-smoke` | Existing Playwright route and console smoke. |
| `npm.cmd run test:deep-research` | Service-dependent performance, detector walk-forward, OOS, replay, and research-quality checks. |

The manifest groups existing commands under source integrity, strategy detection, trade geometry, replay, walk-forward/OOS, research quality, evidence/provenance, readiness, storage, safety/authority, browser smoke, and build/typecheck. Existing scripts remain available; Phase 0 does not delete or rename them.

There is no lint command or lint configuration in the current repository. TypeScript project compilation is exposed separately as `npm.cmd run typecheck`.

Deep-history work is excluded from `test:core` because it depends on live local MT5 services and can exceed normal fast-suite time limits.

The isolated Phase 0.5 branch deliberately excludes the uncommitted
`research-cycle-validation-linkage` and research-quality attribution feature
streams. They remain preserved in the original worktree and preservation stash.
The baseline manifest therefore uses only provenance and research-quality commands
that exist at the recorded base commit.
