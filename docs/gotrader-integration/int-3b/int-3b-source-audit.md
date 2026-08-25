# INT-3B Source Audit

## Lineage

- Certified base: `99caa4e0ee85fa5e4a02ad8815ac69e1b2c8b6ce`
- Certified tree: `5d01ccb0797216a5d65a605d8f885d75b0dedd81`
- Historical I3 reference: `50c396d1ef0afd89939232766104546a75cd4917`
- Historical I3 tree: `0959dca0bd77124ff5464fc41f2beefe5bde50e6`
- Merge base with certified base: `99caa4e0ee85fa5e4a02ad8815ac69e1b2c8b6ce`
- Authority: `none/none/none`

## Historical I3 classification

### REUSABLE

- `marketMakerModelCore.ts`: frozen direction-parameterized causal sequence, range ownership, liquidity engineering, transition, displacement, PD-array, native stop/target, and lifecycle behavior.
- `marketMakerFramework.ts`: framework-only MMXM context and causal fact identity projection.
- `marketMakerParameters.ts`: accepted mirrored parameter set, including optional MSS/SMT and the six frozen eligible PD-array classes.
- `marketMakerBuyModel.ts` and `marketMakerSellModel.ts`: distinct canonical strategy identities over the shared core.
- `ictI3Registry.ts`: exactly two executable strategies and one non-executable framework.
- Symmetry, causality, geometry, missed-entry, consumed-target, and future-extension fixtures.

### REQUIRES_ADAPTATION

- I3 candidate types must use the current `IctHierarchicalNarrative`, canonical authority, and G1.1 contracts.
- Production evaluation must consume the same current canonical fact snapshot used by ICT 2022/PO3/Judas rather than deriving a parallel fact family.
- Candidates must enter `buildCanonicalRuntimeCandidateSet` through `CurrentOpportunityContext`, preserving candidate and geometry identities.
- Current Read, signal, Activate Market, snapshot, and Operator UI projection must use the certified INT-3A candidate-plan path.
- Framework context must be diagnostic-only and unable to contribute actionable direction.

### SUPERSEDED_BY_INT3A

- The historical standalone I3 Current Read envelope.
- The historical direct Current Opportunity adapter shape.
- Any standalone candidate selection or conflict logic.
- Any old display projection that predates candidate/global actionability separation.

### OBSOLETE

- Historical BT2 request integration for this runtime-convergence gate. BT-G1 and historical characterization are explicitly out of scope.
- Historical acceptance descriptions that call composite Node coverage full production E2E.

### DO_NOT_PORT

- Duplicate dealing-range, liquidity, IRL/ERL, displacement, MSS, PD-array, FVG/IFVG, or block detectors.
- Any old geometry service, current-price fallback, generic stop, farther-target search, target stretching, or R:R-generated geometry.
- Historical validation/adoption state. Integrated candidates remain `researchValidated: false` and `productionAdoptionAllowed: false`.
- PO3, Judas, B&B, OSOK, Unicorn, OTE, TGIF, IFVG, or ICT 2022 behavior changes.

## Current integration owners

- Canonical facts and hierarchical narrative: `src/lib/ictI2/ictI2Runtime.ts`
- G1.1 geometry: `src/lib/tradeGeometry`
- Unified candidates/conflicts: `src/lib/currentOpportunity/canonicalRuntimeCandidateSet.ts`
- Current Opportunity: `src/lib/currentOpportunity/detectCurrentOpportunities.ts`
- Current Read: `src/lib/ict-strategy-suite/ictCurrentRead.ts`
- Signal: `src/lib/ict-strategy-suite/ictSignalContract.ts`
- Activate Market: `src/lib/ict-strategy-suite/ictActivateMarketPipeline.ts`
- Operator snapshot/UI: `src/lib/operatorConsole`

## Port decision

Selectively port the frozen I3 causal producers and registry. Replace historical downstream adapters with a current compact candidate collection carried through the certified INT-3A production path. MMXM remains context-only; MMBM/MMSM alone may become canonical actionable candidates after valid G1.1 geometry.
