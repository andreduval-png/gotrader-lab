# MMXM Framework Specification

MMXM owns composition, not detection. It consumes canonical dealing ranges, external/internal liquidity, IRL/ERL transitions, displacement, MSS, PD arrays, C1/C1.1 narrative, and optional S1 SMT.

It exposes one compact context containing:

- directional delivery state;
- `dealingRangeId`;
- external liquidity event identity and consumption time;
- canonical transition identity/type;
- PD-array identity;
- opposite external objective identity;
- supporting fact IDs and none/none/none authority.

MMXM does not create executable candidates and is not registered as a strategy. MMBM and MMSM are thin directional profiles over the shared causal core.

The framework is distinct from PO3: PO3 owns an accumulation/manipulation/distribution lifecycle, while MMXM composes delivery across a named range, external engineering event, canonical IRL/ERL transition, and PD-array repricing. Both may describe the same period for different reasons.
