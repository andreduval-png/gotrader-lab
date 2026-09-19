# Historical Canonical Context Checkpoint

## Scope

The historical fold previously supplied raw facts and a narrative but omitted the
draw-on-liquidity and session facts assembled by the live canonical runtime.
It now uses that same builder on closed candles. Explicit historical narratives
also govern draw selection. A new context policy participates in fold identity,
preventing reuse of pre-correction checkpoints.

No detector parameters, geometry thresholds, scoring rules, or authority changed.
Primary and prior pilot evidence remain untouched. Missing genuine external
liquidity remains a blocker; this change does not manufacture a target.

## Verification

Regression coverage compares historical facts against live-builder output,
including a candle-based draw fixture, empty/missing draws, consumed liquidity,
closed-bar causality, deterministic restart, and future-candle independence.
The certified bounded pilot and artifact verification are pending a clean local
checkpoint. This is operational wiring acceptance, not performance validation.
