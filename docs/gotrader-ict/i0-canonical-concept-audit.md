# I0 Canonical Concept Audit

"Yes" below means substantive deterministic code exists, not that canonical ownership is settled. "Conditional"
causality means the fact is safe only when exposed at confirmation time rather than backdated to its pivot.

| Concept | Canonical implementation | File/function | Causal | MTF | BT2-compatible | Duplicates / consumers | Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Liquidity pools | Yes, ownership partial | ictStrategySuiteHelpers.detectLiquidityPools; ict/detectLiquidityPools | Conditional | Yes | Yes as fact | Suite, current opportunity, advisor, market episodes | CONSOLIDATE |
| External liquidity | Partial | pool/target selection and findNearestDrawOnLiquidity | Yes | Partial | Yes | CMD, IFVG, LRS, session raid | CONSOLIDATE |
| Internal liquidity / IRL | Partial | FVG/BPR/PD hierarchy used implicitly | Yes | Partial | Yes | No stable IRL identity | CREATE canonical identity |
| ERL | Partial | external pool/target facts | Yes | Partial | Yes | No stable ERL identity | CREATE canonical identity |
| IRL/ERL transition | No | None | No | No | No | Requested delivery models | CREATE |
| Swing highs/lows | Yes, duplicated | detectSwingHighs/Lows; ict/detectSwings | Conditional | Yes | Conditional | Most structure/liquidity consumers | CONSOLIDATE |
| Equal highs/lows | Yes, ownership partial | detectEqualHighs/Lows | Conditional | Partial | Conditional | Liquidity pool construction | CONSOLIDATE |
| Fair Value Gap | Yes, duplicated | detectFairValueGap; ict/detectFVG | Yes on closed third candle | Yes | Yes | IFVG, Silver Bullet, session raid, advisor | CONSOLIDATE |
| Inverse FVG | Yes at model layer | IFVG v1-v4 detectors | Yes when inversion close is frozen | Yes | Yes via accepted adapter | Current opportunity and research | REUSE |
| Balanced Price Range | Partial | ict/pdArrayHierarchy | Yes on closed overlaps | Partial | Yes as fact | PD hierarchy only | CONSOLIDATE |
| Order Block | Yes, duplicated | detectOrderBlock; Phase 2 classifications | Conditional | Yes | Yes as fact | Advisor, B&B, OSOK, hierarchy | CONSOLIDATE |
| Breaker Block | Partial | detectBreakerBlock; Phase 2 classification | Conditional | Partial | Yes as fact | Session raid and taxonomy | CONSOLIDATE |
| Mitigation Block | Partial | detectMitigationBlock; Phase 2 classification | Conditional | Partial | Yes as fact | Taxonomy/context | CONSOLIDATE |
| MSS | Yes | ict/detectMSS plus strategy-local checks | Conditional | Yes | Yes | Turtle Soup, session raid, narrative | CONSOLIDATE |
| CISD / change in delivery | Yes at strategy layer | CISD detector/profile | Yes | Yes | Yes via accepted adapter | Current opportunity, registry | REUSE |
| Displacement | Yes, duplicated | detectDisplacement and strategy-specific measurements | Yes | Yes | Yes | CMD, Silver Bullet, session raid, advisor | CONSOLIDATE |
| Premium/discount | Yes, duplicated | classifyPremiumDiscount; ict/detectPremiumDiscount | Yes | Yes | Yes as context | OTE placeholder, advisor, hierarchy | CONSOLIDATE |
| Dealing range/equilibrium | Yes, duplicated | calculateDealingRange; dealing-range modules | Conditional | Yes | Yes as context | Advisor, PD hierarchy, Model One | CONSOLIDATE |
| OTE | Partial | ict/modelOnePowerThree; registry placeholder | Conditional | Partial | No complete model | PO3 context only | CREATE model after fact consolidation |
| PD Arrays | Yes as context | ict/pdArrayHierarchy; universal recognition | Conditional | Yes | Yes as facts | Current Read/advisor/recognition | REUSE context |
| SMT | Yes on S1 branch | S1 multi-asset artifact; legacy SMT projections in primary | Yes with peer timestamps | Yes | Yes as context | Shadow only; peer freshness/certification blocked | CONSOLIDATE on S1 |
| Killzones/session windows | Yes, duplicated | groupCandlesBySession, session tagger, strategy clocks | Yes | Yes | Yes as filter | Silver Bullet, raid, advisor | CONSOLIDATE |
| ICT macros | Partial | session/news timing windows | Yes | Partial | Yes as filter | No canonical macro schedule/version | CREATE schedule contract |
| NDOG fact | Partial, corrected | calculateNewDayOpeningGap | Yes on first eligible closed bar | Partial | Yes as fact | Opening-price equilibrium overlaps | CONSOLIDATE clock/identity |
| NWOG fact | Partial, corrected | calculateNewWeekOpeningGap | Yes on first eligible closed bar | Partial | Yes as fact | Sunday-open references overlap | CONSOLIDATE clock/identity |
| Draw on liquidity | Partial | findNearestDrawOnLiquidity; C1 liquidity path | Yes | Yes | Yes as context | Strategy-local target policies | CONSOLIDATE policy inputs |
| Accumulation/manipulation/distribution | Partial | CMD profiles, modelOnePowerThree, session narrative | Conditional | Yes | Partial | AMD catalog row is concept-only | CONSOLIDATE facts |
| Market-maker accumulation/distribution | Partial concepts | Grinch/consolidation and CMD context | Conditional | Partial | No complete models | MMBM/MMSM/MMXM absent | CREATE models later |

## Causality Gate

1. A detector receives only closed candles available at decision time. Outcome candles are introduced only after an
   immutable candidate is frozen.
2. Symmetric swing algorithms inspect right-hand candles. Their pivot is not knowable at the pivot timestamp; the
   canonical fact needs confirmedAt or validFrom, and every consumer must filter on it.
3. Session high/low, liquidity state, FVG inversion/mitigation, block status, and dealing range must be computed from
   the causal prefix, never from the completed session/day.
4. Generic replay preserves the broad historical/future boundary, and outcome scoring treats same-bar stop/target
   ambiguity conservatively. This does not prove every concept detector causal.
5. No concept enters the canonical library without positive, negative, edge, forming-candle, truncation, and
   future-extension-invariance fixtures.

## Ownership Decision

I1 must select one typed owner for each primitive fact, freeze legacy output, and prove parity before consumer
migration. C1/C1.1 owns narrative projection, S1 owns SMT context, strategy detectors own setup semantics and native
geometry, BT2 owns fills/costs/ambiguity/outcomes, and UI surfaces own none of those.
