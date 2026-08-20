# ICT Strategy Coverage Matrix

Status is implementation status only. "Accepted separate" and "shadow" are not integrated-primary claims.

+| ICT item | type | existing GoTrader ID | current status | detector | state machine | BT2 | Current Read | MTF narrative | SMT dependency | parameter schema | causality tests | two-year baseline | action required | implementation wave |
+| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
+| Liquidity pools | concept | multiple | PARTIAL | Yes | N/A | Fact-ready | Yes | Legacy/partial | S1 optional | Partial | Partial | No | CONSOLIDATE | I1 |
| External/internal liquidity | concept | none canonical | PARTIAL | Partial | N/A | Fact-ready | Partial | C1 partial | S1 optional | Missing identity | Partial | No | CREATE identities | I1 |
| IRL/ERL transition | framework | none | MISSING | No | No | No | No | No | Optional | Missing | No | No | CREATE facts first | I1/I4 |
| Swing highs/lows | concept | multiple | PARTIAL | Yes | N/A | Conditional | Yes | Legacy/partial | None | Partial | Partial | No | CONSOLIDATE confirmedAt | I1 |
| Equal highs/lows | concept | suite helper | PARTIAL | Yes | N/A | Conditional | Partial | Partial | None | Partial | Partial | No | CONSOLIDATE | I1 |
| FVG | concept | multiple | PARTIAL | Yes | N/A | Fact-ready | Yes | Partial | Optional | Partial | Partial | No | CONSOLIDATE | I1 |
| IFVG v1-v4 | strategy variants | ifvg_* | FULLY_IMPLEMENTED | Yes | Yes | Accepted adapter | Yes | Legacy; C1 pending | Optional | Yes | Yes per profile | No universal | REUSE/integrate adapter | I7 |
| BPR | concept | pd hierarchy | PARTIAL | Yes | N/A | Fact-ready | Partial | Partial | None | Partial | Partial | No | CONSOLIDATE | I1 |
| Order Block | concept | multiple | PARTIAL | Yes | N/A | Fact-ready | Yes | Partial | Optional | Partial | Partial | No | CONSOLIDATE | I1 |
| Breaker Block | concept | taxonomy/helper | PARTIAL | Yes | N/A | Fact-ready | Partial | Partial | Optional | Partial | Partial | No | CONSOLIDATE | I1 |
| Mitigation Block | concept | taxonomy/helper | PARTIAL | Yes | N/A | Fact-ready | Partial | Partial | Optional | Partial | Partial | No | CONSOLIDATE | I1 |
| MSS | concept | multiple | PARTIAL | Yes | N/A | Conditional | Yes | C1 partial | Optional | Partial | Partial | No | CONSOLIDATE | I1 |
| CISD | strategy | cisd_v1 | FULLY_IMPLEMENTED | Yes | Yes | Accepted adapter | Yes | C1 pending | Optional | Yes | Yes | No universal | REUSE/integrate adapter | I7 |
| Displacement | concept | multiple | PARTIAL | Yes | N/A | Fact-ready | Yes | C1 partial | Optional | Partial | Partial | No | CONSOLIDATE | I1 |
| Premium/discount | context | multiple | PARTIAL | Yes | N/A | Context-ready | Yes | C1 partial | None | Partial | Partial | No | CONSOLIDATE | I1 |
| Dealing range/equilibrium | context | multiple | PARTIAL | Yes | N/A | Conditional | Yes | C1 partial | None | Partial | Partial | No | CONSOLIDATE | I1 |
| OTE trading model | strategy | ote_research_v1 | PLACEHOLDER | No | No | No | Placeholder | No | Optional | UNRESOLVED | No | No | CREATE | I4 |
| PD Arrays | context | pd_array_setup_research_v1 | CONCEPT_ONLY | Yes | No | Fact-ready | Recognition only | Partial | Optional | Partial | Partial | No | REUSE context | I1 |
| SMT | context | S1 artifact | IMPLEMENTED_BUT_NOT_RUNTIME_WIRED | Yes on S1 | N/A | Context-ready | Shadow | Yes | Canonical owner | Yes | Yes on S1 | No | INTEGRATE S1 | I1 |
| Killzones/sessions | time filter | multiple | PARTIAL | Yes | N/A | Filter-ready | Yes | C1 partial | None | Partial | Partial | No | CONSOLIDATE | I1 |
| ICT macros | time filter | none canonical | PARTIAL | Partial | N/A | Filter-ready | Partial | Partial | None | UNRESOLVED | Partial | No | CREATE schedule | I1 |
| NDOG fact | concept | calculateNewDayOpeningGap | PARTIAL | Yes | N/A | Fact-ready | Partial | Partial | None | Partial | Partial | No | CONSOLIDATE identity | I1 |
| NWOG fact | concept | calculateNewWeekOpeningGap | PARTIAL | Yes | N/A | Fact-ready | Partial | Partial | None | Partial | Partial | No | CONSOLIDATE identity | I1 |
| Draw on liquidity | context | findNearestDrawOnLiquidity | PARTIAL | Yes | N/A | Context-ready | Partial | C1 partial | Optional | Partial | Partial | No | CONSOLIDATE policy | I1 |
| AMD/PO3 context | framework | amd_power_of_three_research_v1 | CONCEPT_ONLY | Partial | No | No | Context only | Partial | Optional | UNRESOLVED | Partial | No | SPECIFY model | I2 |
| Cameron's model | strategy placeholder | camerons_model_research_v1 | PLACEHOLDER | No | No | No | Placeholder | No | Unknown | UNRESOLVED | No | No | SOURCE PACKET | I6 |
| CRT | strategy placeholder | crt_research_v1 | PLACEHOLDER | No | No | No | Placeholder | No | Unknown | UNRESOLVED | No | No | SOURCE PACKET | I6 |
| Market map | diagnostic | market_map_only_diagnostic_v1 | CONCEPT_ONLY | Yes | No | No | Yes | Legacy | Optional | Partial | Partial | No | KEEP diagnostic | I7 |
| Generic scalp setup | recognition | scalp_setup_research_v1 | CONCEPT_ONLY | Recognition | No | No | Recognition | No | Optional | Partial | Partial | No | KEEP recognition | I7 |
| Order-block taxonomy service | diagnostic | ict-order-block-taxonomy | CONCEPT_ONLY | Yes | No | No | Context | Partial | Optional | Partial | Partial | No | CONSOLIDATE facts | I1 |
| Universal recognition service | diagnostic | universal_recognition_service | CONCEPT_ONLY | Yes | No | No | Context | Partial | Optional | Partial | Partial | No | KEEP diagnostic | I7 |
| Silver Bullet v1/v2 | strategy variants | silver_bullet_* | FULLY_IMPLEMENTED | Yes | Yes | Accepted adapter | Yes | C1 pending | Optional | Yes | Yes | No universal | REUSE/integrate adapter | I7 |
| Turtle Soup | strategy | turtle_soup_v1 | FULLY_IMPLEMENTED | Yes | Yes | Accepted adapter | Yes | C1 pending | Optional | Yes | Yes | No universal | REUSE/integrate adapter | I7 |
| OSOK | strategy | ict-one-shot-one-kill | IMPLEMENTED_BUT_NOT_BT2_WIRED | Yes | Yes | Accepted separate | Yes | Legacy | Optional | Partial | Accepted parity | No | INTEGRATE adapter | I7 |
| B&B Buy/Sell | strategy variants | ict-bread-and-butter-* | IMPLEMENTED_BUT_NOT_BT2_WIRED | Yes | Yes | Accepted separate | Yes | Legacy | Optional | Partial | Accepted parity | No | INTEGRATE adapter | I7 |
| CMD high displacement v2 | strategy | cmd_high_displacement_v2_research | FULLY_IMPLEMENTED | Yes | Yes | Accepted adapter | Yes | C1 pending | Optional | Yes | Yes | No universal | REUSE | I7 |
| CMD short watchlist v1 | profile | ict_cmd_short_paper_watchlist_v1 | PARTIAL | Partial | Partial | Partial | Watchlist | Legacy | Optional | Partial | Partial | No | COMPLETE or DEPRECATE | I7 |
| Nasdaq London raid v1/v2 | strategy variants | nasdaq_london_raid_* | FULLY_IMPLEMENTED | Yes | Yes | Accepted adapter | Yes | C1 pending | Optional | Yes | Yes | No universal | REUSE | I7 |
| Grinch family | confluence profiles | grinch_* | IMPLEMENTED_BUT_NOT_RUNTIME_WIRED | Yes | No | No | Confluence only | Partial | Optional | Partial | Partial | No | KEEP confluence | I7 |
| Liquidity Reclaim Scalper | strategy | liquidity_reclaim_scalper_v1 | IMPLEMENTED_BUT_NOT_RUNTIME_WIRED | Accepted separate | Yes | Accepted separate | No integrated | C1 policy | Optional | Frozen | Yes separate | No accepted 2y | ADOPT after R1 | I7 |
| ICT 2022 model | strategy | none | PARTIAL | No composite | No | No | No | Required | Policy TBD | UNRESOLVED | No | No | CREATE | I2 |
| Judas Swing | strategy | none | MISSING | No | No | No | No | Required | Optional | UNRESOLVED | No | No | CREATE | I2 |
| PO3 HOD/LOD variant | strategy variant | none | MISSING | No | No | No | No | Required | Optional | UNRESOLVED | No | No | SPECIFY then CREATE | I2 |
| MMBM | strategy | none | MISSING | No | No | No | No | Required | Policy TBD | UNRESOLVED | No | No | CREATE | I3 |
| MMSM | strategy | none | MISSING | No | No | No | No | Required | Policy TBD | UNRESOLVED | No | No | CREATE | I3 |
| MMXM | framework/model | none | MISSING | No | No | No | No | Required | Policy TBD | UNRESOLVED | No | No | CLASSIFY then CREATE | I3 |
| Unicorn / Breaker+FVG | strategy/alias | none | DUPLICATE_OR_ALIAS | Partial facts | No | No | No | Required | Optional | UNRESOLVED | No | No | DISAMBIGUATE | I4 |
| Breaker trading model | strategy | none | PARTIAL | Fact only | No | No | No | Required | Optional | UNRESOLVED | No | No | SPECIFY or keep fact | I4 |
| Mitigation trading model | strategy | none | PARTIAL | Fact only | No | No | No | Required | Optional | UNRESOLVED | No | No | SPECIFY or keep fact | I4 |
| IRL-to-ERL delivery | strategy | none | MISSING | No | No | No | No | Required | Optional | UNRESOLVED | No | No | CREATE | I4 |
| ERL-to-IRL delivery | strategy | none | MISSING | No | No | No | No | Required | Optional | UNRESOLVED | No | No | CREATE | I4 |
| Generic PD Array execution | policy/model | pd_array_setup_research_v1 | CONCEPT_ONLY | Recognition | No | No | Recognition | Required | Optional | UNRESOLVED | No | No | CLASSIFY | I4 |
| NDOG model | strategy | none | MISSING | Fact partial | No | No | No | Required | Optional | UNRESOLVED | No | No | CREATE after I1 | I5 |
| NWOG model | strategy | none | MISSING | Fact partial | No | No | No | Required | Optional | UNRESOLVED | No | No | CREATE after I1 | I5 |
| TGIF | strategy | none | MISSING | No | No | No | No | Required | Optional | UNRESOLVED | No | No | CREATE | I5 |
| Charter 1-12 | unknown | none | INSUFFICIENT_DEFINITION | No | No | No | No | Unknown | Unknown | UNRESOLVED | No | No | SOURCE PACKETS | I6 |

## Authority

Every item remains research-only. Execution, broker, and readiness-override authority is none/none/none. Coverage
does not imply positive expectancy, current validation, Paper Demo eligibility, runtime adoption, or permission to
trade.
