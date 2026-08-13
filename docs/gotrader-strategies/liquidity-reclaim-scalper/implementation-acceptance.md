# Liquidity Reclaim Scalper v1 Implementation Acceptance

Status: `LIQUIDITY RECLAIM SCALPER V1 IMPLEMENTED WITH DOCUMENTED STRATEGY-SEMANTIC LIMITATIONS`

## Identity

- Concurrency decision: `LRS_SAFE_WITH_RESTRICTIONS`; isolated implementation only, no historical operator started.
- Worktree: `C:\Users\andre\OneDrive\Documents\gotrader-liquidity-reclaim-scalper-v1`
- Branch: `codex/gotrader-strategy-liquidity-reclaim-scalper-v1`
- Accepted implementation parent: `37eab541e211ab45bf7e83e0c46c1a7477d61ee5`
- Strategy ID: `liquidity_reclaim_scalper_v1`
- Profile ID: `liquidity_reclaim_scalper_v1_base_research`
- Classification: experimental, executable research adapter, research-only
- Parameter count: 25
- Parameter hash: `sha256:c58d3a0aaff9ba61ece6ea0df2d76145059be36cab9f2347a66a0e6da642f748`
- Context / structure / execution timeframes: 15m / 5m / 1m

## Implementation

- Detector: `src/lib/v2/strategyAdapters/liquidityReclaimScalper/liquidityReclaimScalperDetector.ts`
- Contracts and parameter schema: `src/lib/strategyLibrary/liquidityReclaimScalper/`
- BT2 adapter: `src/lib/backtestStrategyAdapters/liquidityReclaimScalperCanonicalAdapter.ts`
- Canonical components reused: Phase 2A liquidity pools, liquidity sweeps, displacement facts, IFVG facts, dealing-range facts, canonical value hashing, simulation authority, canonical opportunity contract, and BT2 simulator.
- New components: typed LRS profile, deterministic state machine, causal detector, candidate identity, BT2 adapter, feature-dependency record, safety scan, causal fixtures, and additive catalog snapshot.
- State path: SEARCHING -> LIQUIDITY_OBJECTIVE_IDENTIFIED -> WAITING_FOR_RAID -> RAID_CONFIRMED -> DISPLACEMENT_CONFIRMED -> IFVG_RECLAIMED -> WAITING_FOR_ENTRY -> ENTRY_ELIGIBLE.
- Entry models: IFVG_PROXIMAL_EDGE, IFVG_MIDPOINT, DISPLACEMENT_RETRACE, CONFIRMATION_CLOSE.
- Stop models: RAID_EXTREME, RAID_EXTREME_BUFFER, IFVG_INVALIDATION, DISPLACEMENT_ORIGIN.
- Target models: EXTERNAL_LIQUIDITY, STANDARDIZED_R.
- Feature dependency graph: `feature-dependency-and-ablation.md`.

## Simulation And Data

- BT2 integration: blocker-free ENTRY_ELIGIBLE candidates only; BT2 owns fills, costs, expiry, and intrabar ambiguity.
- Intrabar ambiguity policy: `conservative_stop_first_v1`.
- Cost model exercised by focused fixtures: zero-spread, zero-slippage, zero-commission, zero-swap contract fixture only.
- Dataset certificate ID: `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`.
- Dataset ID: `sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d`.
- Two-year descriptive baseline: deferred after the clean resource preflight found low memory headroom and shared runtime services. No historical operator was started.
- Setup count: not measured.
- Trade count: not measured.
- Baseline metrics: not measured; no win-rate, expectancy, profit-factor, drawdown, frequency, session, month, or year claim exists.
- Parameter search: not run and not authorized.

## Verification

- Causality: passed; facts after the context as-of time cannot advance the state machine.
- Lookahead: passed; future IFVG and liquidity-target facts are rejected.
- Geometry: exact long and short entry/stop/target ordering passed.
- Source safety: blocked context and invalid certificate fail closed.
- Intrabar ambiguity: one focused same-bar stop/target collision exercised; conservative stop exit passed.
- Full fail-fast validation duration: 280.1 seconds.
- Passed: focused LRS parameter/state/causal/BT2/safety tests, core ICT suite, strategy baselines, source integrity, provenance, safety, MT5 read-only safety, B1 fixtures, BT1.6, BT2, both authoritative ledgers, strict typecheck, production build, and sequential browser smoke.
- Existing frozen catalog hash remains `sha256:43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de`.
- Additive catalog v2 hash is `sha256:a1b364ff81c9a983b677c9c7cb5827e7374ef2e3395ae21ac9c8b506899b0d0b`.
- Existing build warnings preserved: circular Rollup chunk re-exports and chunks larger than 500 kB. No LRS validation failure resulted.
- Honest earlier failures preserved: the initial non-fail-fast wrapper exposed frozen-catalog drift and an invalid production/V2 import boundary; both were corrected without changing strategy semantics.

## Authority

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
researchValidated: false
productionAdoptionAllowed: false
pushStatus: not pushed
```

The implementation is eligible for a separately authorized, resource-safe two-year descriptive baseline. Liquidity Reclaim Scalper Research Track R1 parameter-space discovery is recommended only after that baseline and must not begin implicitly.
