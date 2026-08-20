# I2 Power of Three State Machine

`SEARCHING -> ACCUMULATION_FORMING -> ACCUMULATION_CONFIRMED -> MANIPULATION_FORMING -> MANIPULATION_CONFIRMED -> DISTRIBUTION_FORMING -> DISTRIBUTION_CONFIRMED -> ENTRY_ELIGIBLE -> ACTIVE`.

Terminal states include `MODEL_INVALIDATED`, `RANGE_BROKEN_INVALID`, `SESSION_EXPIRED`, `NO_DISTRIBUTION`, `ENTRY_MISSED`, and `TARGET_REACHED`. Range-only and manipulation-only states are explicitly non-signals. Wrong-direction displacement/MSS cannot confirm distribution.

Mandatory/inseparable: range, range-side manipulation, displacement, MSS. Dependent: FVG retrace and geometry. Optional: session filter, SMT context, and HOD/LOD objective profile.
