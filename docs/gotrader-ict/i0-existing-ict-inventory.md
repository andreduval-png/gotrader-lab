# I0 Existing ICT Inventory

Date: 2026-08-16

## Preflight

`ICT_I0_SAFE_WITH_RESTRICTIONS`

The primary worktree was dirty and was not touched. The audit runs in the isolated worktree
`C:\Users\andre\OneDrive\Documents\gotrader-ict-i0-coverage-audit` on branch
`codex/gotrader-ict-i0-coverage-audit`, based on integration HEAD
`fbd14782f6473f61059f07704a4e2b2825fa27a6`.

Restrictions applied:

- documentation and read-only source inspection only;
- no dependency installation, build, browser smoke, historical replay, or runtime mutation while R1 is active;
- no merge from the dirty primary or from accepted feature worktrees;
- no Paper Demo, broker, execution, readiness override, or production adoption;
- no raw candle artifacts.

## Sources Of Truth

| Scope | Exact identity | Audit treatment |
| --- | --- | --- |
| Integration baseline | `fbd14782f6473f61059f07704a4e2b2825fa27a6` | Canonical integrated source for this audit |
| C1 MTF narrative | `8a201d9c0aa119b3d51713a68462a0757664a38b` | Accepted shadow context; not integrated strategy eligibility |
| C1.1 Current Read | `e408646dadad7ef1217921e81b451f1c64e9633a` | Accepted Current Read-only projection |
| S1 canonical SMT | `50868f5ec2d6fbd86d45af337eb0a08bb93c7641` | Implemented shadow engine; operationally blocked |
| LRS v1 / active R1 line | `2c0ec73e59f383d01abfb0d4d87724c3d22d1324` | Accepted strategy implementation, not integrated baseline; R1 still running |
| BT3 Phase 2 coverage line | `d67c5d010c75e658d2eed82c55066094f47538a3` | Accepted adapter/parity evidence for three legacy engines |

Accepted-unintegrated means the code exists on an independently accepted clean branch. It does not mean the
integration baseline exposes or adopts it.

## Authoritative Baseline Catalog

The integrated strategy baseline manifest contains 27 entries: 22 Strategy Library definitions, three
supplemental legacy strategy engines, and two diagnostic services. All retain authority `none/none/none`.

| Strategy/profile | Inventory classification | Detector / ownership note |
| --- | --- | --- |
| `silver_bullet_v1` | FULLY_IMPLEMENTED | Executable detector, trade geometry, fixtures, replay/OOS references, canonical adapter |
| `silver_bullet_v2_refined_research` | FULLY_IMPLEMENTED | Executable refined detector; small research sample, no promotion claim |
| `camerons_model_research_v1` | PLACEHOLDER | Catalog vocabulary only |
| `ifvg_v1` | FULLY_IMPLEMENTED | Executable comparator with BT3 coverage |
| `ifvg_filtered_v2_research` | FULLY_IMPLEMENTED | Frozen negative control; implementation is complete, edge is not established |
| `ifvg_fresh_retest_v3_research` | FULLY_IMPLEMENTED | Positive migration canary; forward evidence still required |
| `ifvg_fresh_retest_v4_candidate` | FULLY_IMPLEMENTED | Experimental forward candidate, research-only |
| `turtle_soup_v1` | FULLY_IMPLEMENTED | Deterministic false-break reversal detector |
| `crt_research_v1` | PLACEHOLDER | No deterministic detector or trade plan |
| `ote_research_v1` | PLACEHOLDER | No deterministic detector or trade plan |
| `cisd_v1` | FULLY_IMPLEMENTED | Deterministic detector and canonical coverage |
| `amd_power_of_three_research_v1` | CONCEPT_ONLY | Session narrative path exists; registry entry deliberately does not duplicate it |
| `ict_cmd_short_paper_watchlist_v1` | PARTIAL | Date gate and telemetry exist, but detector ownership remains placeholder/overfit-risk |
| `cmd_high_displacement_v2_research` | FULLY_IMPLEMENTED | Executable experimental detector with canonical coverage |
| `grinch_reversal_expansion_confirmation_v1` | IMPLEMENTED_BUT_NOT_RUNTIME_WIRED | Distributed deterministic confluence profile; no standalone opportunity authority |
| `grinch_model_1_research_v1` | IMPLEMENTED_BUT_NOT_RUNTIME_WIRED | Model/confluence fact provider only |
| `grinch_consolidation_research_v1` | IMPLEMENTED_BUT_NOT_RUNTIME_WIRED | Model/confluence fact provider only |
| `pd_array_setup_research_v1` | CONCEPT_ONLY | Universal recognition can form context but not evidence or geometry |
| `scalp_setup_research_v1` | CONCEPT_ONLY | Generic recognition label, not a complete strategy contract |
| `nasdaq_london_raid_ny_reversal_v1` | FULLY_IMPLEMENTED | Executable session model and canonical coverage |
| `nasdaq_london_raid_ny_reversal_v2_filtered_research` | FULLY_IMPLEMENTED | Filtered executable profile and canonical coverage |
| `market_map_only_diagnostic_v1` | CONCEPT_ONLY | Must never own entry, stop, target, RR, evidence, or Paper Demo eligibility |
| `ict-bread-and-butter-buy` | FULLY_IMPLEMENTED | Legacy Phase 2 engine; accepted BT3 adapter/parity coverage exists separately |
| `ict-bread-and-butter-sell` | FULLY_IMPLEMENTED | Legacy Phase 2 engine; accepted BT3 adapter/parity coverage exists separately |
| `ict-one-shot-one-kill` | FULLY_IMPLEMENTED | Legacy Phase 2 engine; accepted BT3 adapter/parity coverage exists separately |
| `ict-order-block-taxonomy` | CONCEPT_ONLY | Diagnostic primitive taxonomy, not promotable evidence |
| `universal_recognition_service` | CONCEPT_ONLY | Recognition context only |

## Accepted-Unintegrated Inventory

`liquidity_reclaim_scalper_v1` is FULLY_IMPLEMENTED on its accepted feature line. It has immutable parameters,
a causal state machine, canonical facts, compact candidate geometry, a canonical adapter, strict BT2 ownership,
focused causality/safety tests, and authority `none/none/none`. It is not registered in the audited integration
baseline. Its R1 parameter-family operation does not change the implementation classification and does not grant
research validation or production adoption.

C1, C1.1, and S1 are not strategies. They are reusable context dependencies. C1 is shadow-only; C1.1 is accepted
for Current Read explanations only; S1 remains shadow-only because live peer freshness and certified peer history
are insufficient.

## Infrastructure Inventory

| Responsibility | Integrated owner | Audit finding |
| --- | --- | --- |
| Strategy definitions and frozen parameters | `src/lib/strategyLibrary/strategyRegistry.ts` | 22 definitions; mixes executable, placeholder, confluence, and diagnostic semantics |
| Authoritative baseline catalog | `src/lib/v2Baseline/strategyBaselineManifest.ts` | 27 entries with detector, evidence, tests, fixtures, and authority metadata |
| Current opportunity orchestration | `src/lib/currentOpportunity/detectCurrentOpportunities.ts` | Consumer/orchestrator, not a strategy detector |
| Current Read | `src/lib/ict-strategy-suite/ictCurrentRead.ts` | Presentation projection; C1.1 is accepted only on its separate line |
| Generic replay | `src/lib/ict-strategy-suite/ictReplayValidation.ts` | Separates historical detector window from future outcome window |
| Generic backtest | `src/lib/backtesting/runBacktest.ts` | Contains both native candidate paths and generic simulation assumptions |
| Outcome scoring | `src/lib/backtesting/outcomeScoring.ts` | Entry touch, costs, expiry, and conservative same-bar ambiguity |
| Walk-forward | `src/lib/walkForward` | Chronological split/orchestration and stability analysis; identity match remains mandatory |
| Canonical adapters | `src/lib/backtestStrategyAdapters` on accepted BT3 line | IFVG, CMD, CISD, Phase 2, session raid, Silver Bullet, Turtle Soup |
| LRS adapter | `src/lib/backtestStrategyAdapters/liquidityReclaimScalperCanonicalAdapter.ts` on LRS line | Accepted-unintegrated strict adapter |
| Strategy parameter discovery | Registry profiles plus per-strategy modules | Frozen profiles must not be mutated by generic optimization |
| Baseline fixtures | `scripts/v2-baseline` plus per-strategy test scripts | Behavioral coverage, not profitability evidence |
| UI consumers | Operator Decisions, Research Advisor, ICT Lab, Results | Must read identity-bound records; presentation is not evidence ownership |

The integration baseline does not contain a single universal adapter registry. The accepted BT3 line supplies the
canonical adapter set, while LRS supplies its own accepted adapter on a separate line. Integration is future work,
not an I0 documentation action.

## Duplicate And Alias Surfaces

- Swing, liquidity, sweep, displacement, FVG, order-block, and premium/discount logic exists in both
  `src/lib/ict` and `src/lib/ict-strategy-suite/ictStrategySuiteHelpers.ts`.
- Phase 2 order-block taxonomy is a third representation with strategy-specific classifications.
- Grinch profiles and registry names describe confluence models; they are not aliases for standalone strategies.
- `amd_power_of_three_research_v1` is a catalog reference to existing session/model logic, not a second detector.
- `pd_array_setup_research_v1` and `scalp_setup_research_v1` are aliases for recognition categories, not trade models.
- S1 supersedes ad hoc pair/basket SMT projections only after separate integration; the old projections remain
  compatibility surfaces until then.

## Audit Count Summary

- 27 integrated manifest entries.
- 14 entries with complete executable strategy behavior when accepted BT3 Phase 2 coverage is included.
- 3 explicit catalog placeholders.
- 7 context, recognition, or confluence-only entries.
- 1 partial CMD watchlist profile.
- 2 integrated diagnostic-only services already included in the context count.
- 1 additional accepted-unintegrated executable strategy: Liquidity Reclaim Scalper v1.

Implementation completeness is not profitability, research maturity, readiness, Paper Demo approval, or execution
authority.
