# Causal Sequence Selection Correction Authorization

The interrupted one-segment certified-dataset preflight exposed a detector
selection defect before any baseline report or performance metric existed. A
long candidate could select a historical buy-side pool below its entry because
fact selection did not bind the external objective to trade geometry or require
the strategy's canonical event order.

This correction is authorized only to enforce the already frozen semantics:

- external objective precedes the opposite-side raid;
- raid precedes directional displacement;
- displacement precedes the canonical IFVG inversion/reclaim;
- a long objective is above entry and a short objective is below entry;
- the complete sequence stays within `maximumSetupAgeBars` on the frozen
  execution timeframe;
- the newest complete causal sequence wins deterministic selection.

The failed preflight root and output remain preserved. No parameter, threshold,
entry, stop, target, cost, authority, optimization, or production behavior may
change. Authority remains `none / none / none`.
