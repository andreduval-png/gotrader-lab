# GoTrader V2 Phase 3F IFVG Canary Evidence Report

Generated: 2026-07-23
Branch: `codex/gotrader-v2-phase-3f-ifvg-evidence`
Starting commit: `1e553d6 Add Phase 3E continuation handoff`

## Final Status

**PHASE 3F BLOCKED - SOURCE IDENTITY INCOMPLETE**

The Phase 3F contracts, regeneration path, regression reporting, gate integration, and
tests are implemented. Real historical artifacts were not generated because the active
MT5 time contract is not historically verified. The live operational ledger is also
still below its required sample. Phase 4 and production adoption remain unauthorized.

## Dataset Manifest

`V2HistoricalDatasetManifest` provides one immutable identity for the process-local
historical candle set used by both IFVG profiles. It records:

- dataset ID and deterministic dataset checksum;
- canonical source fingerprint;
- requested symbol, broker symbol, provider, and timeframe;
- first and last candle times in UTC;
- candle count;
- time-normalization policy and version;
- MT5 time-contract version and verification status;
- offset-regime version;
- research/shadow scope and authority `none / none / none`.

The builder sorts closed candles, validates UTC timestamps and OHLCV geometry, rejects
duplicates and conflicting duplicates, and hashes a versioned canonical representation.
It returns only the compact manifest. Raw candles are never written to the manifest,
evidence file, review output, UI, or logs.

Strategy parameters and cost assumptions are intentionally not part of dataset identity.
They belong to each replay/OOS artifact. This allows IFVG v2 and v3 to reference the same
market dataset while retaining independent frozen strategy identities.

## Replay Identity

The evidence bundle contains two replay artifacts:

- positive canary: `ifvg_fresh_retest_v3_research`;
- negative control: `ifvg_filtered_v2_research`.

Each replay artifact references the same dataset ID, checksum, source fingerprint, time
normalization policy, time-contract version, and offset-regime version. Each separately
records its frozen profile/version, parameter fingerprint, cost model, replay boundaries,
metrics hash, baseline snapshot hash, and immutable regression status.

## OOS Identity

Each profile has an OOS artifact that:

- references the identical dataset manifest used by replay;
- references its parent replay artifact ID;
- preserves its own UTC OOS boundaries;
- preserves profile, parameter, and cost-model identity;
- records a compact metrics hash and comparison result.

Mixed datasets, normalization drift, missing boundaries, wrong parent replay IDs,
parameter drift, and replay/OOS cost-model drift are rejected.

## Source Identity

The CLI command:

```powershell
npm.cmd run regenerate:v2-ifvg-phase3-evidence
```

checks `/time-contract` before requesting deep history. It requires:

- `verificationStatus: verified`;
- a known provider time basis;
- `historicalDstPolicyVerified: true`;
- `timeVerificationScope: historical`;
- `phase2Eligible: true`;
- a terminal clock classification version.

Current observed result:

```text
verificationStatus: observed_candidate
providerTimeBasis: unknown
timeVerificationScope: none
currentLiveTimeBasisVerified: false
historicalDstPolicyVerified: false
phase2Eligible: false
```

The CLI therefore stopped before deep-history fetch and wrote no evidence file. The
required operator action is to run a fresh terminal-side `GoTraderClockProbe`, verify the
historical DST/time-basis contract, and rerun the regeneration command.

## Live Ledger

Phase 3F reuses the Phase 3D `V2 IFVG Live Shadow Ledger`; it does not create a competing
ledger. The ledger persists compact candidate identity, closed-window timestamps, parity,
source identity, blockers, and authority only.

Acceptance remains independent of historical replay/OOS evidence:

- fresh terminal contract;
- current-live time basis verified;
- closed, non-stale windows;
- exact source/context identity;
- no context blockers;
- at least three accepted exact-parity closed windows;
- at least two distinct market dates.

The existing test confirms idempotent repeats, duplicate-window conflict rejection,
stale-context blocking, file tamper detection, and no raw-candle serialization. The real
ledger is currently missing.

## Frozen Replay Comparison

The positive canary remains frozen at:

| Metric | Frozen value |
|---|---:|
| Completed research trades | 172 |
| Target-first rate | 55.23% |
| Average R | 2.805R |
| Profit factor | 5.979 |
| Maximum drawdown | 8.966R |
| Unique trading dates | 95 |
| Positive rolling windows | 11 / 11 |

No baseline metric was rewritten.

## Frozen OOS Comparison

The positive canary OOS reference remains:

| Metric | Frozen value |
|---|---:|
| OOS windows passed | 2 / 2 |
| OOS trades | 64 |
| Unique OOS dates | 34 |
| Average R | 3.458R |
| Profit factor | 8.081 |
| Additional 0.5R cost average | 2.958R |

The IFVG v2 negative control remains `insufficient_data`, independently degraded, and
ineligible for promotion.

## Regression Reporting

Regeneration compares calculated replay and OOS metrics to the committed frozen values.
Any drift produces a separate compact regression artifact containing:

- source and identity differences;
- parameter and cost-model differences;
- replay and OOS metric differences;
- `baselineModified: false`.

The normal evidence file is written only when manifest validation and every metric
comparison pass. Regression never updates frozen snapshots.

## Gate Result

Current deterministic review:

```text
detection parity: exact_parity
geometry parity: exact_parity
selection parity: exact_parity
research lifecycle parity: insufficient_comparison_data
live shadow parity: insufficient_comparison_data
phase3CompletionReviewReady: false
phase4ImplementationAuthorized: false
productionAdoptionAllowed: false
```

Current blockers:

```text
ifvg_v3_replay_oos_source_identity_missing
ifvg_v2_replay_oos_source_identity_missing
ifvg_v3_live_shadow_ledger_missing
```

The Phase 3F test proves a validated historical evidence bundle can clear the lifecycle
branch. A synthetic live summary can then reach `ready_for_completion_review`, but still
cannot authorize Phase 4, production behavior, evidence creation, readiness, or execution.

## Verification

Passed:

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run test:v2-ifvg-phase3-evidence`
- `npm.cmd run test:v2-ifvg-live-shadow`
- `npm.cmd run test:v2-ifvg-phase3-canary-gate`
- `npm.cmd run review:v2-ifvg-phase3-canary`
- `npm.cmd run test:core`
- `npm.cmd run test:strategy-baselines`
- `npm.cmd run test:source-integrity`
- `npm.cmd run test:provenance`
- `npm.cmd run test:safety`
- `npm.cmd run test:browser-smoke` - 44/44 browser checks
- `git diff --check`

The build retains pre-existing Rollup circular-chunk and large-chunk warnings. Phase 3F
does not modify those application modules.

Frozen hashes remained identical:

```text
ifvg-v3-positive-canary.snapshot.json
1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a

ifvg-v2-negative-control.snapshot.json
3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224
```

## Rollback

1. Set `V2_IFVG_LIVE_SHADOW_MODE=disabled`.
2. Stop the live shadow collector.
3. Remove the compact `.gotrader/v2/ifvg-phase3-evidence-USTECH-5m.json` file if one
   is later generated.
4. Revert the isolated Phase 3F commit.

Legacy IFVG v3 remains authoritative throughout rollback. No production consumer changes
are required.

## Completion Recommendation

Do not declare Phase 3 complete and do not authorize Phase 4.

Next:

1. capture a fresh terminal clock probe;
2. verify historical MT5 time basis and DST policy;
3. regenerate the shared-dataset replay/OOS evidence;
4. collect at least three accepted closed-window parity observations across two dates;
5. rerun `review:v2-ifvg-phase3-canary`;
6. request a human Phase 3 completion review only if the gate reports
   `ready_for_completion_review`.
