# I2 Judas Swing State Machine

Reserved lifecycle: `WAITING_FOR_SESSION -> SESSION_ACTIVE -> INITIAL_MOVE_FORMING -> MANIPULATION_CONFIRMED -> REVERSAL_TRIGGER_FORMING -> REVERSAL_CONFIRMED -> ENTRY_ELIGIBLE -> ACTIVE`.

Terminal states are `SESSION_EXPIRED`, `MANIPULATION_INVALID`, `REVERSAL_FAILED`, `ENTRY_MISSED`, `TARGET_REACHED`, `INVALIDATED`, and `SOURCE_BLOCKED`.

Only `WAITING_FOR_SESSION -> SOURCE_BLOCKED` is reachable in I2. This is intentional. Implementing later states requires an accepted source packet, versioned parameters, causal fixtures, and a new review; it cannot be unlocked by changing a flag.
