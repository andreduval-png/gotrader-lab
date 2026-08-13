# Canonical IFVG Interface Correction Authorization

The certified-baseline preflight exposed a pre-observation contract mismatch:
the Phase 2A fact engine emits an inverted original FVG as `gapType: fvg` with
`state: inverted`, while the LRS detector accepted only normalized
`gapType: ifvg` facts.

This correction is authorized before any historical baseline result exists. It
may only normalize the already accepted canonical IFVG lifecycle semantics:

- a direct `gapType: ifvg` fact uses its stated trade direction;
- an inverted original bearish FVG is a long IFVG;
- an inverted original bullish FVG is a short IFVG;
- inversion time must exist and remain causal;
- the source FVG must be unused before inversion;
- inversion must occur within the accepted 36-bar canonical IFVG horizon;
- all existing freshness and source guards remain active.

No parameter, threshold, state transition, entry, stop, target, cost, authority,
or production behavior may change. Authority remains `none / none / none`.
