# MMXM Causal State Machine

The shared lifecycle is:

`SEARCHING -> RANGE_CONTEXT_ESTABLISHED -> LIQUIDITY_ENGINEERING_FORMING -> LIQUIDITY_EVENT_CONFIRMED -> DELIVERY_TRANSITION_FORMING -> DELIVERY_TRANSITION_CONFIRMED -> PD_ARRAY_REPRICE_FORMING -> ENTRY_ELIGIBLE -> ACTIVE_DELIVERY`.

Terminal states are `OBJECTIVE_REACHED`, `INVALIDATED`, `ENTRY_MISSED`, `SETUP_EXPIRED`, `SOURCE_BLOCKED`, `NO_VALID_TARGET`, `TARGET_CONSUMED`, and `GEOMETRY_NON_ACTIONABLE`.

Every transition is ordered by `validFrom` and evaluated only after filtering facts to `validFrom <= asOf`. Candidate identity excludes receipt time, render time, and process identity. Appending future facts at a fixed `asOf` cannot change an earlier state.

The core does not infer swings, liquidity, ranges, IRL/ERL, displacement, MSS, or PD arrays. It requires canonical identities and records them in the compact context. BT2 remains the sole owner of fill, same-bar ambiguity, costs, and outcomes.
