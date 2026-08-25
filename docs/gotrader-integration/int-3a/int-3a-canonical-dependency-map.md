# INT-3A Canonical Dependency Map

| Strategy concern | Canonical owner | INT-3A use |
| --- | --- | --- |
| Swings and equal levels | `ictCanonical/canonicalSwingLiquidity` | Consume only |
| Liquidity and draw | `ictCanonical/canonicalSwingLiquidity` | Consume liquidity; compose the existing draw selector |
| FVG | `ictCanonical/canonicalImbalance` | Consume post-MSS facts |
| Displacement and MSS | `ictCanonical/canonicalStructure` | Consume in causal order |
| Dealing range and PD location | `ictCanonical/canonicalRangePd` | Consume for PO3 state/context |
| Sessions | `ictCanonical/canonicalTime` | Consume accepted New York session facts |
| Hierarchical narrative | C1/C1.1 runtime context | HTF objective, intermediate structure, LTF execution; no vote |
| SMT | S1 | Optional declared input only; no private calculation |
| Geometry intent | `tradeGeometry/strategyGeometryIntent` | Sole producer contract |
| Geometry | G1.1 `buildCanonicalTradeGeometry` | Sole numeric geometry owner |
| Current candidates | `currentOpportunity` | Preserve a candidate collection |
| Current Read | `ictCurrentRead` | Project each strategy without geometry mixing |
| Activate Market | `ictActivateMarketPipeline` | Aggregate owner-preserving candidates |
| Operator plan | operator console | Display owner strategy and geometry identity |

## Missing Integration, Not Missing Facts

The accepted draw and session fact builders exist but are not included by
`buildCanonicalIctFactSnapshot`. INT-3A may compose those owners at the model
integration boundary. This is not authorization to implement duplicate fact
semantics.

## Governance

- ICT 2022 can become executable research only after end-to-end parity passes.
- PO3 is a primary state model; geometry stays source-blocked where target
  precedence is ambiguous.
- Judas remains source-blocked context.
- IFVG v3 remains the existing primary executable profile.
- IFVG v4 remains experimental research only.
- All new evidence defaults to `researchValidated: false` and requires
  rebaseline.

