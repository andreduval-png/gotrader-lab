# GoTrader V2 Phase 3E IFVG Canary Gate Runbook

## Purpose

Phase 3E determines whether the IFVG v3 Phase 3 canary has enough compatible
research-lifecycle and live shadow data for a human completion review.

It does not replace legacy IFVG v3, promote IFVG v2, create evidence, alter
readiness, or enable execution.

## Run Focused Validation

From the isolated V2 worktree:

```powershell
cd C:\Users\andre\OneDrive\Documents\gotrader-v2-phase0-baseline
npm.cmd run typecheck
npm.cmd run test:v2-ifvg-phase3-canary-gate
npm.cmd run review:v2-ifvg-phase3-canary
```

The current expected review status is:

```text
blocked_insufficient_comparison_data
```

The expected blockers are missing historical source identity and a missing or
insufficient live shadow ledger.

## Disable Live Shadow Collection

Use the rollback switch before invoking the collector:

```powershell
$env:V2_IFVG_LIVE_SHADOW_MODE = "disabled"
npm.cmd run collect:v2-ifvg-live-shadow
```

Expected compact result:

```text
status: disabled
migrationMode: legacy_authoritative
networkRequestsMade: 0
observationPersisted: false
productionAdoptionAllowed: false
```

Remove the environment value before an approved shadow-only collection:

```powershell
Remove-Item Env:V2_IFVG_LIVE_SHADOW_MODE -ErrorAction SilentlyContinue
```

## Collect Live Shadow Observations

Only proceed after the MT5 terminal clock and current provider time basis are
fresh and explicitly verified:

```powershell
npm.cmd run diagnose:v2-mt5-terminal-clock
npm.cmd run collect:v2-mt5-offset-regime -- --once
npm.cmd run collect:v2-ifvg-live-shadow
```

The default compact ledger is:

```text
.gotrader\v2\ifvg-v3-live-shadow-USTECH-5m.json
```

Phase 3E requires:

- no live parity regressions;
- no insufficient live comparisons;
- at least three exact-parity closed windows;
- at least three distinct closed windows;
- at least two market dates.

These thresholds are an operational canary sample, not a statistical
independence claim.

## Regenerate Identity-Matched Research Artifacts

The existing frozen audits lack a historical source fingerprint. Before Phase
3 completion review, regenerate the IFVG v3 positive-canary and IFVG v2
negative-control replay/OOS artifacts with the same:

- historical source fingerprint;
- profile identity and version;
- parameter fingerprint;
- cost model;
- requested and broker symbol mapping;
- timeframe and date boundaries.

Do not copy a source fingerprint into an old artifact. The fingerprint must
come from the exact candle dataset used for the regenerated replay and OOS
results.

## Review The Gate

```powershell
npm.cmd run review:v2-ifvg-phase3-canary
```

Possible statuses:

| Status | Meaning |
|---|---|
| `disabled` | Shadow collection is disabled; legacy remains authoritative. |
| `blocked_regression` | A frozen metric, deterministic parity result, live result, or safety field regressed. |
| `blocked_insufficient_comparison_data` | No regression is proven, but identity or live depth is insufficient. |
| `ready_for_completion_review` | Bounded checks passed; human review is required. |

No status authorizes production adoption or Phase 4 automatically.

## Full Validation

```powershell
npm.cmd run build
npm.cmd run test:core
npm.cmd run test:strategy-baselines
npm.cmd run test:source-integrity
npm.cmd run test:provenance
npm.cmd run test:safety
npm.cmd run test:browser-smoke
git diff --check
```

Run `build` before `test:browser-smoke`; do not run them concurrently because
the build may replace the `dist` files used by browser smoke.

## Safety

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
phase4ImplementationAuthorized: false
canCreateValidationChainEntry: false
canCreateEvidence: false
```

Raw candles remain internal to approved diagnostics. Phase 3E artifacts contain
only compact metrics, fingerprints, blockers, warnings, checksums, and
fail-closed authority fields.
