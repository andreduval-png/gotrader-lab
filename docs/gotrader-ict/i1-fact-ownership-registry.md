# I1 Fact Ownership Registry

Status: accepted canonical shadow foundation.

| Owner | Canonical module | Facts | Migration state |
|---|---|---|---|
| ICT_FACT_SWING | `canonicalSwingLiquidity` | SWING, EQUAL_LEVEL | CANONICAL_WITH_COMPATIBILITY_ADAPTER |
| ICT_FACT_LIQUIDITY | `canonicalSwingLiquidity` | LIQUIDITY, DRAW_ON_LIQUIDITY | CANONICAL_WITH_COMPATIBILITY_ADAPTER |
| ICT_FACT_IRL_ERL | `canonicalIrlErl` | range-relative INTERNAL/EXTERNAL liquidity, transitions | CANONICAL_SHADOW |
| ICT_FACT_FVG | `canonicalImbalance` | FVG, FVG_TRANSITION, BPR | CANONICAL_WITH_COMPATIBILITY_ADAPTER |
| ICT_FACT_BLOCK | `canonicalBlocks` | ORDER_BLOCK, BREAKER_BLOCK, MITIGATION_BLOCK | CANONICAL_WITH_COMPATIBILITY_ADAPTER |
| ICT_FACT_STRUCTURE | `canonicalStructure` | DISPLACEMENT, MSS | CANONICAL_WITH_COMPATIBILITY_ADAPTER |
| ICT_FACT_DEALING_RANGE | `canonicalRangePd` | DEALING_RANGE, PD_LOCATION, OTE_ZONE, PD_ARRAY | CANONICAL_WITH_COMPATIBILITY_ADAPTER |
| ICT_FACT_SESSION | `canonicalTime` | SESSION_WINDOW | CANONICAL_WITH_COMPATIBILITY_ADAPTER |
| ICT_FACT_OPENING_GAP | `canonicalOpeningGap` | NDOG, NWOG | CANONICAL_WITH_COMPATIBILITY_ADAPTER |

The executable registry is `CANONICAL_ICT_FACT_OWNERSHIP`. Legacy implementations remain present and are not owners for new I2+ models.
