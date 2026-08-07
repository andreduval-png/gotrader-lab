# BT0 Strategy Backtest Coverage Matrix

Source of truth: `src/lib/v2Baseline/strategyBaselineManifest.ts` at BT0 base `01c9221b`. `profileId` below is the manifest `strategyId`; version is separately shown. Codes: Y implemented, P partial/indirect, N absent. No entry satisfies the full two-year acceptance definition.

## All Manifest Entries

| Strategy / profile | Version | Baseline classification | Detector | BT0 class | Hist | Geometry | Outcome/replay | WF/OOS | MC | Cost |
|---|---:|---|---|---|---:|---:|---|---|---:|---:|
| `silver_bullet_v1` | v1 | behavioral_fixture | executable_research | REPLAY_ONLY | P | Y | Y/Y | P/P | P | P |
| `silver_bullet_v2_refined_research` | v2 | behavioral_fixture | executable_research | REPLAY_ONLY | P | Y | Y/Y | P/P | P | P |
| `camerons_model_research_v1` | v1 | placeholder | placeholder | PLACEHOLDER | N | N | N/N | N/N | N | N |
| `ifvg_v1` | v1 | behavioral_fixture | executable_research | REPLAY_ONLY | P | Y | Y/Y | P/P | P | P |
| `ifvg_filtered_v2_research` | v2 | negative_control | executable_research | PARTIALLY_BACKTESTABLE | P | Y | Y/Y | Y/Y | P | P |
| `ifvg_fresh_retest_v3_research` | v3 | positive_canary | executable_research | PARTIALLY_BACKTESTABLE | P | Y | Y/Y | Y/Y | P | P |
| `ifvg_fresh_retest_v4_candidate` | v4 | experimental | experimental | EXPERIMENTAL | P | Y | Y/Y | P/P | P | P |
| `turtle_soup_v1` | v1 | behavioral_fixture | executable_research | REPLAY_ONLY | P | Y | Y/Y | P/P | P | P |
| `crt_research_v1` | v1 | placeholder | placeholder | PLACEHOLDER | N | N | N/N | N/N | N | N |
| `ote_research_v1` | v1 | placeholder | placeholder | PLACEHOLDER | N | N | N/N | N/N | N | N |
| `cisd_v1` | v1 | behavioral_fixture | executable_research | REPLAY_ONLY | P | Y | Y/Y | P/P | P | P |
| `amd_power_of_three_research_v1` | v1 | placeholder | placeholder | PLACEHOLDER | N | N | N/N | N/N | N | N |
| `ict_cmd_short_paper_watchlist_v1` | v1 | behavioral_fixture | placeholder | FIXTURE_ONLY | P | P | P/P | P/P | N | P |
| `cmd_high_displacement_v2_research` | v2 | experimental | experimental | PARTIALLY_BACKTESTABLE | P | Y | Y/Y | P/P | P | P |
| `grinch_reversal_expansion_confirmation_v1` | v1 | behavioral_fixture | placeholder | FIXTURE_ONLY | P | P | P/P | P/P | P | N |
| `grinch_model_1_research_v1` | v1 | behavioral_fixture | placeholder | FIXTURE_ONLY | P | P | P/P | P/P | P | N |
| `grinch_consolidation_research_v1` | v1 | behavioral_fixture | placeholder | FIXTURE_ONLY | P | P | P/P | P/P | P | N |
| `pd_array_setup_research_v1` | v1 | placeholder | placeholder | PLACEHOLDER | N | N | N/N | N/N | N | N |
| `scalp_setup_research_v1` | v1 | placeholder | placeholder | PLACEHOLDER | N | N | N/N | N/N | N | N |
| `nasdaq_london_raid_ny_reversal_v1` | v1 | behavioral_fixture | executable_research | REPLAY_ONLY | P | Y | Y/Y | P/P | P | P |
| `nasdaq_london_raid_ny_reversal_v2_filtered_research` | v2 | behavioral_fixture | executable_research | REPLAY_ONLY | P | Y | Y/Y | P/P | P | P |
| `market_map_only_diagnostic_v1` | v1 | diagnostic | diagnostic | DIAGNOSTIC | N | N | N/N | N/N | N | N |
| `ict-bread-and-butter-buy` | phase2_v1 | behavioral_fixture | executable_research | REPLAY_ONLY | P | Y | Y/Y | N/N | P | N |
| `ict-bread-and-butter-sell` | phase2_v1 | behavioral_fixture | executable_research | REPLAY_ONLY | P | Y | Y/Y | N/N | P | N |
| `ict-one-shot-one-kill` | phase2_v1 | behavioral_fixture | executable_research | REPLAY_ONLY | P | Y | Y/Y | N/N | P | N |
| `ict-order-block-taxonomy` | phase2_v1 | diagnostic | diagnostic | DIAGNOSTIC | N | N | N/N | N/N | N | N |
| `universal_recognition_service` | v1 | diagnostic | diagnostic | DIAGNOSTIC | N | N | N/N | N/N | N | N |

All authority is `none/none/none`. Diagnostic recognition and context primitives cannot create trade geometry or evidence.

## Executable / Experimental Detail

| Family | Detector and context | Timeframes | Entry / stop / target / native R:R | Historical runner and artifact |
|---|---|---|---|---|
| Silver Bullet v1/v2 | `ictSilverBullet.ts`; session, liquidity, displacement/FVG, HTF context | Registry symbols; primary 5m-class context with supporting HTF | Strategy construction in `ictTradeConstruction.ts`; structure entry/invalidation/target; structure-defined R:R | Strategy performance scripts and Silver Bullet audits; incomplete dataset/cost identity |
| IFVG v1 | `ictIfvg.ts`; inversion, displacement, context | Registry-defined; principally 5m with HTF context | Shared trade construction; structure-defined | `test-ifvg-performance.mjs`; `ifvg-performance-audit.md` |
| IFVG v2 | `ictIfvg.ts` + `ictIfvgFilteredV2.ts` | Same family | Generic profile geometry; structure/profile filters; native geometry | Generic backtest + detector-profile holdout; negative-control audits |
| IFVG v3 | `ictIfvg.ts` + `ictIfvgFreshRetestV3.ts` | Same family | Fresh-retest geometry; structure-defined native R:R | Generic runner, frozen holdout, forward ledger; positive-canary audit |
| IFVG v4 | v3 base + `ictIfvgShallowRetestV4.ts` | Same family | Experimental shallow-retest geometry | Generic runner + forward evidence only; no accepted historical artifact |
| Turtle Soup | `ictTurtleSoup.ts`; prior liquidity and false-break context | Registry-defined multi-timeframe context | Shared structure entry/invalidation/target | Strategy script/audit; zero-candidate historical claim |
| CISD | `ictCisd.ts`; change-in-delivery context | Registry-defined | Shared structure geometry | Strategy script/audit; degraded OOS claim |
| CMD v2 | `ictCmdHighDisplacementV2.ts`; session narrative/displacement | Registry-defined, session-sensitive | Generic profile entry/stop/target; dynamic/structure R:R | CMD performance script and telemetry audit; retired/experimental evidence |
| Nasdaq raid v1/v2 | `ictSessionRaidReversal.ts` plus v2 filters; London/NY sessions, raid, reversal | Nasdaq proxy; session-primary + HTF | Shared structure geometry; dynamic target | Dedicated scripts and audits; historical time authority unresolved |
| Phase 2 buy/sell | `ictPhase2BreadAndButter.ts`; approved context/order blocks | MNQ, NQ, USTECH; primary 5m/15m; supporting 15m/1h | Phase 2 geometry; structure-defined | Fixture replay only; no OOS artifact in manifest |
| One Shot One Kill | `ictPhase2OneShotOneKill.ts`; approved Phase 2 context | MNQ, NQ, USTECH; 5m/15m + 15m/1h | Phase 2 structure geometry | Fixture replay only; no OOS artifact |

## Causality Classification

- Generic `runBacktest` paths: `CAUSAL_WITH_LIMITATIONS`; rolling context slices end at the decision candle, but all detector dependencies are not capability-constrained.
- ICT rolling replay: `CAUSAL_WITH_LIMITATIONS`; detector prefixes are causal, but entry fills and some precomputed context ownership remain weaker than a canonical as-of contract.
- IFVG v2/v3 causal audits and frozen detector-profile holdout: `CAUSAL_PROVEN` for the specifically tested detector fixtures, not for a two-year data/run lifecycle.
- Placeholder/distributed Grinch entries: `UNVERIFIED` for canonical historical execution.
- Session-sensitive strategies: additionally `BLOCKED` for accepted historical conclusions until historical provider time/DST is verified.

## Parameter-Search Readiness

No executable family is ready for unrestricted large-scale search. Generic profile controls are typed but mix detector, geometry, engine, and cost concerns; most family-specific detector thresholds are hardcoded; Session Raid v2 exposes nine floats without canonical allowed ranges; and the ICT 2,560-candidate grid re-filters existing outcomes rather than rerunning detector semantics. IFVG's 26 named variants are useful ablation evidence but are not a complete search schema.

BT3A must publish a versioned parameter schema for each executable family before BT8A search operations. Frozen positive/negative controls remain immutable. Controlled ablations use overlays or new profile versions. Full details are in `bt0-parameter-search-and-anti-overfitting-addendum.md`.

## Coverage Conclusion

`FULLY_BACKTESTABLE`: 0

`PARTIALLY_BACKTESTABLE`: IFVG v2, IFVG v3, CMD v2

`EXPERIMENTAL`: IFVG v4

`REPLAY_ONLY`: Silver Bullet v1/v2, IFVG v1, Turtle Soup, CISD, session raid v1/v2, Phase 2 buy/sell/One Shot

`FIXTURE_ONLY`: CMD paper watchlist and three distributed Grinch models

`PLACEHOLDER`: Cameron, CRT, OTE, AMD, PD Array, Scalp

`DIAGNOSTIC`: market map, order-block taxonomy, universal recognition
