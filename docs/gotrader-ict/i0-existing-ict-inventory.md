# I0 Existing ICT Inventory

Date: 2026-08-20

## Concurrency Result

`ICT_I0_SAFE_WITH_RESTRICTIONS`

The audit is documentation-only in `C:\Users\andre\OneDrive\Documents\gotrader-ict-i0-coverage-audit` on
`codex/gotrader-ict-i0-coverage-audit`. Active R1 family-v4, local stack services, historical worktrees, and their
evidence were not modified. No process was started or stopped and no raw candles were copied.

## Audited Identities

| Scope | Exact HEAD | Treatment |
| --- | --- | --- |
| Current integrated primary | `d665288ecde763d103a59387584f3cdfd16f8c95` | Registry, consumers, manifest, and concept source of truth |
| Audit starting commit | `07bb49a6c0208263a30c17abe4748cffe82225ae` | Prior I0 evidence; corrected by this audit |
| BT2 architecture | `0d98523cc74286a5a146afb34ccdca3fb9ee11ad` | Simulation ownership boundary |
| Accepted BT3 adapter/parity line | `d67c5d010c75e658d2eed82c55066094f47538a3` | Accepted-unintegrated adapter evidence |
| C1 MTF narrative | `8a201d9c0aa119b3d51713a68462a0757664a38b` | Accepted shadow context |
| C1 Current Read adoption | `927c462570c7b5d82e54ce5cf6b898908a2c387a` | Accepted-unintegrated projection |
| C1.1 maturation correction | `e408646dadad7ef1217921e81b451f1c64e9633a` | Accepted setup-relative context correction |
| S1 canonical SMT | `50868f5ec2d6fbd86d45af337eb0a08bb93c7641` | Shadow-only canonical SMT owner |
| LRS v1 R1 recovery | `8d6158f01eab6eeb15b38fdc30ac61606f1fa188` | Accepted-unintegrated strategy; active research is not acceptance |
| Frozen governance baseline | `5c6ba415050aee0d3a3ba71944919a3ba76907e6` | Read-only impact reference |

Accepted-unintegrated means code or evidence exists on a separate clean branch. It does not mean primary exposes,
adopts, validates, or authorizes it.

## Registry And Manifest

`src/lib/strategyLibrary/strategyRegistry.ts` contains 22 library definitions. The integrated manifest in
`src/lib/v2Baseline/strategyBaselineManifest.ts` adds three legacy strategy engines and two diagnostics, yielding
27 catalog entries. Catalog count is not executable-strategy count.

| Entry or family | I0 classification | Integrated detector/runtime | Adapter/BT2 finding |
| --- | --- | --- | --- |
| `silver_bullet_v1`, `silver_bullet_v2_refined_research` | FULLY_IMPLEMENTED | Yes | Accepted adapter/parity exists; primary lacks universal adapter registry |
| `ifvg_v1`, `ifvg_filtered_v2_research`, `ifvg_fresh_retest_v3_research`, `ifvg_fresh_retest_v4_candidate` | FULLY_IMPLEMENTED | Yes | Accepted adapter/parity; v2 negative control, v4 experimental |
| `turtle_soup_v1` | FULLY_IMPLEMENTED | Yes | Accepted adapter/parity |
| `cisd_v1` | FULLY_IMPLEMENTED | Yes | Accepted adapter/parity |
| `cmd_high_displacement_v2_research` | FULLY_IMPLEMENTED | Yes | Accepted adapter/parity; research-only |
| `nasdaq_london_raid_ny_reversal_v1`, `nasdaq_london_raid_ny_reversal_v2_filtered_research` | FULLY_IMPLEMENTED | Yes | Accepted session-raid adapter/parity |
| `ict-bread-and-butter-buy`, `ict-bread-and-butter-sell`, `ict-one-shot-one-kill` | IMPLEMENTED_BUT_NOT_BT2_WIRED | Legacy runtime yes | Adapter/parity accepted separately, not integrated primary |
| `ict_cmd_short_paper_watchlist_v1` | PARTIAL | Watchlist/date-gated path | No authoritative complete detector contract |
| Three Grinch rows | IMPLEMENTED_BUT_NOT_RUNTIME_WIRED | Confluence only | Must not be standalone strategies |
| `amd_power_of_three_research_v1` | CONCEPT_ONLY | Context/catalog row | No complete state machine or geometry |
| `pd_array_setup_research_v1`, `scalp_setup_research_v1` | CONCEPT_ONLY | Recognition labels | Not trade models |
| `market_map_only_diagnostic_v1`, `ict-order-block-taxonomy`, `universal_recognition_service` | CONCEPT_ONLY | Diagnostic/context | Cannot own eligibility or evidence |
| `camerons_model_research_v1`, `crt_research_v1`, `ote_research_v1` | PLACEHOLDER | No | No detector, geometry, adapter, or baseline |

The 27 manifest entries classify as 11 integrated executable definitions, 3 executable legacy engines lacking
integrated BT2 wiring, 3 confluence-only rows, 6 concept/diagnostic rows, 1 partial watchlist, and 3 placeholders.
This partition is exhaustive and totals 27. LRS is an additional
accepted-unintegrated executable strategy and is not counted in the integrated 27.

Exact catalog IDs:

- `silver_bullet_v1`, `silver_bullet_v2_refined_research`, `camerons_model_research_v1`
- `ifvg_v1`, `ifvg_filtered_v2_research`, `ifvg_fresh_retest_v3_research`, `ifvg_fresh_retest_v4_candidate`
- `turtle_soup_v1`, `crt_research_v1`, `ote_research_v1`, `cisd_v1`, `amd_power_of_three_research_v1`
- `ict_cmd_short_paper_watchlist_v1`, `cmd_high_displacement_v2_research`
- `grinch_reversal_expansion_confirmation_v1`, `grinch_model_1_research_v1`,
  `grinch_consolidation_research_v1`
- `pd_array_setup_research_v1`, `scalp_setup_research_v1`
- `nasdaq_london_raid_ny_reversal_v1`, `nasdaq_london_raid_ny_reversal_v2_filtered_research`
- `market_map_only_diagnostic_v1`, `ict-bread-and-butter-buy`, `ict-bread-and-butter-sell`
- `ict-one-shot-one-kill`, `ict-order-block-taxonomy`, `universal_recognition_service`

## Detector And Consumer Inventory

| Surface | Finding |
| --- | --- |
| `src/lib/currentOpportunity/detectCurrentOpportunities.ts` | Orchestrates IFVG v1-v3, Silver Bullet v1/v2, Turtle Soup, CISD, session raid v1, CMD/market-map paths; consumer, not fact owner |
| `src/lib/ict-strategy-suite/ictStrategySuiteEngines.ts` | Advisor engines for HTF bias, daily range, liquidity run, FVG displacement, OB, B&B, OSOK, relative strength, risk governor |
| `src/lib/ict-strategy-suite/ictCurrentRead.ts` | Presentation projection; not evidence or eligibility authority |
| `src/lib/ict-strategy-suite/ictReplayValidation.ts` | Separates causal detector windows from future outcome windows |
| `src/lib/backtesting/runBacktest.ts`, `outcomeScoring.ts` | Simulator mechanics; future candles allowed only after candidate freeze |
| `src/lib/backtestStrategyAdapters` | Absent from integrated primary; present on accepted BT3/LRS branches |
| `src/lib/walkForward` and evidence ledgers | Validation infrastructure; exact strategy/profile/parameter/source identities required |

## Duplicate And Alias Findings

- Swing, liquidity, FVG, displacement, block, dealing-range, and premium/discount logic is split between
  `src/lib/ict`, `ictStrategySuiteHelpers.ts`, and sometimes `ictPhase2OrderBlocks.ts`.
- Advisor IDs such as `ict-htf-bias`, `ict-daily-range`, `ict-liquidity-run`, `ict-order-block`, and
  `ict-risk-governor` are services, not additional registered strategies.
- `amd_power_of_three_research_v1` aliases context vocabulary; it is not a second PO3 detector.
- PD-array/scalp rows are recognition categories. Grinch rows are confluence profiles.
- Legacy SMT projections are compatibility surfaces; S1 is the future canonical SMT artifact after integration.
- Breaker, mitigation, OTE, PD arrays, killzones, IRL/ERL, and opening gaps are facts or filters unless a separately
  source-defined complete model is specified.

## Baseline And Authority

No audited strategy has a universal two-year certified baseline. Existing fixtures, rolling windows, OOS checks,
and accepted branch evidence vary by model and must not be relabeled as two-year evidence. All entries remain
research-only with execution, broker, and readiness-override authority `none/none/none`.
