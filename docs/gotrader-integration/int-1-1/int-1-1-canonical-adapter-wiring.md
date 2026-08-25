# INT-1.1 Canonical Adapter Wiring

Attachment point: `assessIctIfvgFreshRetestV3`, after the native detector completes and before the assessment is compacted.

The adapter now:

- preserves the native `candidateId`;
- preserves v3 strategy/profile identity;
- maps `entry_missed` to canonical `ENTRY_MISSED`;
- applies the frozen MNQ/USTECH 4-point viability boundary as `riskDistance >= 4`;
- returns no geometry for incomplete or sub-boundary native geometry;
- retains native levels with `VALID_BELOW_RR_THRESHOLD` when geometry is structurally valid but below 2R;
- never widens a stop, stretches a target, or substitutes current price.

`researchOnly: false` at the canonical builder means plan-actionable geometry, not execution authority. The assessment, signal, activation, and operator packets remain research-only with authority `none/none/none` and execution disabled.
