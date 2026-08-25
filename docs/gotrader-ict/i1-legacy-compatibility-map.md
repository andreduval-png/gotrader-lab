# I1 Legacy Compatibility Map

The executable maps are `CANONICAL_ICT_FACT_OWNERSHIP` and `CANONICAL_LEGACY_COMPATIBILITY`.

| Concept | Retained legacy implementations | Canonical owner | Adapter/state |
|---|---|---|---|
| Swing/equal | `detectSwings`, suite swing helpers | `canonicalSwingLiquidity` | swing adapter; shadow |
| Liquidity/draw | `detectLiquiditySweeps`, suite pools/draw | `canonicalSwingLiquidity` | structural adapter; shadow |
| FVG/BPR | `detectFVG`, suite FVG, PD hierarchy | `canonicalImbalance` | FVG adapter; shadow |
| Blocks | suite block variants, phase 2, PD hierarchy | `canonicalBlocks` | relationship adapter; shadow |
| Structure | `detectMSS`, suite displacement | `canonicalStructure` | policy-specific; shadow |
| Range/PD | dealing-range module, suite range, PD hierarchy | `canonicalRangePd` | structural adapter; shadow |
| Sessions | session tagger, strategy-local windows | `canonicalTime` | accepted-window adapter; shadow |
| Gaps | suite NDOG/NWOG, opening equilibrium | `canonicalOpeningGap` | identity wrapper; shadow |

Nothing is deleted or replaced in I1. The duplicate helpers remain a documented migration backlog.
