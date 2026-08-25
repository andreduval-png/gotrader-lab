# Static Winner Scan

The unified canonical set uses a stable strategy/candidate ordering only for deterministic presentation. Selection occurs only when disposition is `SINGLE_ACTIONABLE_CANDIDATE`.

No R:R, score, confidence, or candidate iteration order selects a winner when multiple actionable candidates exist. Opposing directions produce `CONFLICTING_CANONICAL_SETUPS`; same-direction candidates produce `MULTIPLE_ALIGNED_CANONICAL_SETUPS`; both dispositions leave `selectedCandidateId` absent.

The broader scanner still sorts non-canonical diagnostic rows for presentation. That sort does not select a canonical candidate and does not bypass unified conflict arbitration.
