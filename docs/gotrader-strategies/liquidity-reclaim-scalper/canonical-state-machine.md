# Canonical State Machine

The state machine advances causally through objective identification, raid,
directional displacement, canonical IFVG reclaim, entry waiting, eligibility,
and active outcome states. Every transition is identity-hashed from previous
state, next state, market time, canonical trigger fact IDs, and blockers.

Terminal states cannot transition. Illegal skips such as `SEARCHING` directly
to `IFVG_RECLAIMED`, or `TARGET_CONSUMED` to `ENTRY_ELIGIBLE`, fail closed.
The detector filters every fact by causal closed-candle and validity time before
selection. Runtime receipt time and UI state are excluded from candidate identity.
