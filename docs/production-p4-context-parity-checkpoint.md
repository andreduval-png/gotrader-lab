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
The certified bounded pilot and artifact verification are complete against local
checkpoint dc14f6e. This is operational wiring acceptance, not performance validation.

Passed: RC1B historical evaluation (including added negative cases), RC1C
operator research, INT-3A frozen core models, P3 fold scoring, operator console,
TypeScript/build, and diff whitespace checks. Existing circular-chunk and bundle
size warnings remain. Frozen ICT 2022 prices remain 100.5 / 105 / 89, R:R 2.5555556.

## Bounded Pilot Evidence

Local artifact directory: `.gotrader/bt-g1-3r/supervised-1789777436472-18320`.
No raw candles or generated artifacts are included in this commit.

- Supervisor: COMPLETED, exit 0, 67,581 ms, 607,064,064 bytes peak RSS,
  67 samples, 3,734,735 output bytes, zero stderr; package unchanged.
- Five owners completed six evaluation points each. All admission, result-content,
  result-identity, provenance-binding, and checkpoint hashes verified. Checkpoints
  reached position 6 and matched result fold identities. Supervisor lock removed.
- Pilot report canonical SHA256:
  `a95124adece56118be6c50e6b6ae20ae5c7a0588cd32b2c918747bc2e0c6d5ed`.
- Supervisor report canonical SHA256:
  `f7900882f668ed2b97fd6f10abbfcc418aaf2481cb05606736eead8290b300f7`.
- ICT 2022 advanced beyond missing draw at five of six points, reaching raid,
  displacement, MSS, or directional-objective states. March 17 14:30 UTC still
  reports primary_external_draw_missing; no target was forced to bypass it.
- IFVG produced three geometry-backed candidates but none eligible. Across all
  owners there were zero eligible candidates, fills, or completed trades.
- Remaining blockers include missing displacement/MSS/FVG/raid, premium/discount
  context, HTF alignment, used IFVG, and small stops. London remains forming.

## Boundaries

The six checkpoint steps are complete. Broader production phases are not certified.
Full-dataset execution and performance acceptance remain pending. Research remains
unvalidated; production adoption is false; authority remains none/none/none.
Primary HEAD f67cc8e9456aa45fc5706cedc54a609e03f4d463 and tracked-diff SHA256
c07cc42efd81b93ca7327767dc79003c4595c3b9c674e3bbfc7831aea8eaf42b were unchanged.
