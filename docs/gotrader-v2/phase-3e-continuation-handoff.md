# GoTrader V2 Phase 3E Continuation Handoff

## Handoff Status

```text
Worktree: C:\Users\andre\OneDrive\Documents\gotrader-v2-phase0-baseline
Branch: codex/gotrader-v2-phase-3e-ifvg-canary-gate
HEAD: a62d7a52055be9fe94da4355b3cac9823be33d6e
Commit: Add IFVG Phase 3 canary gate
Worktree status before this handoff: clean
Push status: not pushed
```

Phase 3E implementation is complete. Phase 3 itself is not ready for completion
review, and Phase 4 is not authorized.

## Commit Lineage

The relevant additive V2 sequence is:

| Commit | Phase | Result |
|---|---|---|
| `e2b0609` | Phase 2A | Shadow context compatibility review completed |
| `5e0c280` | Phase 2A | Context engine report added |
| `4650331` | Phase 3A | IFVG v3 shadow detection canary added |
| `8811d0b` | Phase 3A | Detection parity completed |
| `6e21360` | Phase 3B | Shadow geometry canary added |
| `6eb199d` | Phase 3C | Selection parity completed |
| `a9e5def` | Phase 3D | Live shadow collector added |
| `a62d7a5` | Phase 3E | Research-lifecycle and completion gate added |

Each phase is additive. Legacy IFVG v3 remains authoritative throughout.

## What Phase 3E Added

Phase 3E adds:

- compact frozen research-lifecycle artifact contracts;
- an IFVG v3 positive-canary adapter;
- an IFVG v2 negative-control adapter;
- artifact checksum verification;
- exact frozen replay and OOS metric verification;
- canonical historical source-fingerprint validation;
- a requirement that v3 and v2 use the same historical source identity;
- a bounded live shadow review threshold;
- a fail-closed Phase 3 completion gate;
- a live collector rollback switch;
- a review diagnostic;
- focused regression and safety tests;
- an operator report and runbook.

Important files:

- `src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3CanaryTypes.ts`
- `src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3BaselineAdapter.ts`
- `src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3CanaryGate.ts`
- `scripts/test-v2-ifvg-phase3-canary-gate.mjs`
- `scripts/review-v2-ifvg-phase3-canary.mjs`
- `scripts/collect-v2-ifvg-live-shadow.mjs`
- `docs/gotrader-v2/phase-3e-ifvg-canary-gate-report.md`
- `docs/gotrader-v2/phase-3e-ifvg-canary-gate-runbook.md`

## Authoritative Behavior

The following behavior remains authoritative and unchanged:

- legacy IFVG v3 detector and selection;
- existing replay and walk-forward behavior;
- existing evidence and readiness systems;
- existing MT5 read-only source restrictions;
- existing authority contracts.

V2 remains shadow-only. No V2 output is routed into production research,
validation-chain evidence, readiness, Paper-Demo, broker execution, or account
state.

## Frozen Positive Canary

The gate preserves these IFVG v3 values exactly:

| Metric | Frozen value |
|---|---:|
| Completed research trades | 172 |
| Target-first rate | 55.23% |
| Average R | 2.805R |
| Profit factor | 5.979 |
| Maximum drawdown | 8.966R |
| Unique trading dates | 95 |
| Positive rolling windows | 11/11 |
| OOS windows passed | 2/2 |
| OOS trades | 64 |
| OOS unique dates | 34 |
| OOS average R | 3.458R |
| OOS profit factor | 8.081 |
| OOS average after an additional 0.5R cost | 2.958R |

The maximum drawdown remains above the current conservative research benchmark.
Phase 3E preserves and reports that warning.

## Frozen Negative Control

IFVG v2 remains a required negative control:

| Metric | Frozen value |
|---|---:|
| Current-window candidates | 16 |
| Current-window target-first rate | 68.75% |
| Current-window unique dates | 15 |
| Independent-window candidates | 6 |
| Independent target-first rate | 33.33% |
| Independent invalidation-first rate | 66.67% |
| OOS verdict | insufficient_data |
| Independent behavior | degraded |
| Promotion allowed | false |

Any attempt to change `promotionAllowed` to true blocks the Phase 3 gate as a
regression.

## Current Gate Result

Run:

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-v2-phase0-baseline
npm.cmd run review:v2-ifvg-phase3-canary
```

Current expected result:

```text
status: blocked_insufficient_comparison_data
detection parity: exact_parity
geometry parity: exact_parity
selection parity: exact_parity
research-lifecycle parity: insufficient_comparison_data
live shadow parity: insufficient_comparison_data
phase3CompletionReviewReady: false
phase4ImplementationAuthorized: false
productionAdoptionAllowed: false
```

Current blockers:

- `ifvg_v3_replay_oos_source_identity_missing`
- `ifvg_v2_replay_oos_source_identity_missing`
- `ifvg_v3_live_shadow_ledger_missing`

The positive research metrics have not regressed. The missing facts are source
identity and accepted live comparisons.

## Current MT5 Live Result

The actual Phase 3D collector reached the MT5 read-only wrapper and returned:

```text
status: blocked_context
observationPersisted: false
statePreserved: true
rawCandlesPrinted: false
mutationEndpointsCalled: false
productionAdoptionAllowed: false
```

The principal time blockers were:

- provider time basis is not verified;
- normalized closed-candle proof is unavailable;
- 1,000 timestamps could not be normalized;
- the primary window is empty after fail-closed normalization;
- current-live context comparison is ineligible.

Do not bypass these checks or infer the MT5 time basis from current candle
appearance.

## Rollback

The immediate rollback switch is:

```powershell
$env:V2_IFVG_LIVE_SHADOW_MODE = "disabled"
npm.cmd run collect:v2-ifvg-live-shadow
```

Expected result:

```text
status: disabled
migrationMode: legacy_authoritative
networkRequestsMade: 0
observationPersisted: false
productionAdoptionAllowed: false
```

The collector exits before compilation, lock acquisition, network access, or
persistence.

## Validation Completed

The committed Phase 3E state passed:

- `npm.cmd run typecheck`
- `npm.cmd run build`
- `npm.cmd run test:v2-ifvg-phase3-canary-gate`
- `npm.cmd run review:v2-ifvg-phase3-canary`
- `npm.cmd run test:core`
- `npm.cmd run test:strategy-baselines`
- `npm.cmd run test:source-integrity`
- `npm.cmd run test:provenance`
- `npm.cmd run test:safety`
- `npm.cmd run test:browser-smoke`, 44/44 routes
- actual one-shot live collector fail-closed check
- `git diff --check`
- `git diff --cached --check`

Existing Rollup circular-chunk and large-chunk warnings remain. They predate
Phase 3E and did not fail the build or browser suite.

## Safety Invariants

Every continuation must preserve:

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
phase4ImplementationAuthorized: false
canCreateValidationChainEntry: false
canCreateEvidence: false
```

Also preserve:

- no account, order, position, deal, or mutation API calls;
- no `/execute` route;
- no raw candle persistence;
- no raw runtime snapshot persistence;
- no secret or credential serialization;
- no readiness or Paper-Demo promotion;
- no automatic replacement of legacy IFVG v3;
- no detector threshold tuning during parity work.

## Recommended Next Implementation

Do not begin Phase 4.

The next bounded phase should be:

```text
Phase 3F - IFVG canary evidence completion
```

Implement it in this order:

1. close the MT5 terminal/provider time contract for both current-live and
   historical use;
2. regenerate IFVG v3 positive-canary and IFVG v2 negative-control replay/OOS
   artifacts from the same explicit historical candle dataset;
3. record the real canonical source fingerprint produced by that dataset;
4. preserve profile, parameter, cost-model, symbol, timeframe, and date-range
   identity;
5. compare regenerated metrics to the frozen summaries without rewriting the
   baseline automatically;
6. collect accepted live parity across at least three closed windows and two
   market dates;
7. rerun the Phase 3E gate;
8. request a human Phase 3 completion and rollback review only if the gate
   reaches `ready_for_completion_review`.

Attaching a new source fingerprint to the old audit is prohibited. The
fingerprint must be generated from the exact candles used in the regenerated
replay and OOS run.

## Exact Next Codex Prompt

```text
Working directory:
C:/Users/andre/OneDrive/Documents/gotrader-v2-phase0-baseline

Task:
Implement GoTrader V2 Phase 3F IFVG canary evidence completion.

Goal:
Close the remaining Phase 3 source-identity and live-parity gaps without
changing legacy IFVG behavior. Regenerate IFVG v3 positive-canary and IFVG v2
negative-control replay/OOS artifacts from one explicit, identity-matched MT5
read-only historical dataset, then feed compact artifacts into the existing
Phase 3E canary gate. Collect live shadow observations only when the MT5
terminal/provider time contract is explicitly verified.

Read first:
- docs/gotrader-v2/phase-3e-continuation-handoff.md
- docs/gotrader-v2/phase-3e-ifvg-canary-gate-report.md
- docs/gotrader-v2/phase-3e-ifvg-canary-gate-runbook.md
- src/lib/v2/strategyAdapters/ifvg/*
- src/lib/v2/candleRepository/*
- src/lib/v2/marketContext/*
- src/lib/v2/mt5Time/*
- scripts/review-v2-ifvg-phase3-canary.mjs
- scripts/collect-v2-ifvg-live-shadow.mjs

Requirements:
1. Verify the MT5 terminal clock and provider time basis. Fail closed if
   current-live or historical time normalization is not eligible.
2. Add an explicit CLI-only historical regeneration path. Do not fetch deep
   history on UI load.
3. Run frozen IFVG v3 and IFVG v2 profiles against the same canonical candle
   dataset.
4. Record compact identity:
   - canonical historical source fingerprint
   - requested and broker symbol
   - timeframe
   - first and last candle time
   - candle count
   - profile/version
   - parameter fingerprint
   - cost model
   - replay and OOS date boundaries
5. Keep raw candles process-local. Do not persist or print candle arrays.
6. Do not rewrite frozen baseline metrics automatically. Metric drift must
   produce a regression report.
7. Require IFVG v2 to remain non-promotable.
8. Reuse the Phase 3E checksum and source-identity gate.
9. Collect live shadow parity only after time eligibility passes.
10. Do not authorize Phase 4 automatically. A ready gate requests human review
    only.

Safety:
- no broker execution
- no account/order/position/deal APIs
- no readiness override
- no validation-chain or evidence creation
- no Paper-Demo promotion
- no production adoption
- no raw candle persistence
- authority none / none / none

Validation:
- npm.cmd run typecheck
- npm.cmd run build
- npm.cmd run test:v2-ifvg-phase3-canary-gate
- npm.cmd run test:strategy-baselines
- npm.cmd run test:source-integrity
- npm.cmd run test:provenance
- npm.cmd run test:safety
- npm.cmd run test:browser-smoke
- git diff --check

Commit only an isolated Phase 3F change. Do not push.
```

## Handoff Decision

The V2 architecture is behaving correctly: strong historical results are
preserved, but missing source identity and unverified live time prevent a false
parity claim. The safest continuation is to complete those measurements, not
to widen V2 production scope.
