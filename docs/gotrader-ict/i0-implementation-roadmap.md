# I0 Implementation Roadmap

I0 authorizes documentation only. Every later wave requires explicit authorization, isolated worktree, source
packet, preregistered parameters, focused causality/parity tests, full regression, acceptance evidence, governance
commit, and exact identity handoff.

## Wave I1 - Canonical Facts And Model Contract

- Select owners for time/session, swings/structure, liquidity/IRL/ERL, FVG/BPR, block taxonomy, and dealing range.
- Add validFrom/confirmedAt semantics and future-extension-invariance fixtures.
- Consolidate NDOG/NWOG facts rather than reimplementing them.
- Define the typed model contract and lossless adapter registry.
- Integrate C1/C1.1 and S1 as context artifacts, not strategy logic.

Exit: parity fixtures pass, no frozen strategy candidate changes, duplicate map is complete.

## Wave I2 - 2022, PO3, And Judas Specifications

- Accept source-bound definition packets and alias decisions first.
- Implement one model per slice; prefer the 2022 model only after its dependency packet is unambiguous.
- Keep PO3 HOD/LOD as a variant only if materially distinct behavior is proven.

Exit: causal state machines, native geometry, parameter schemas, Current Read projection, canonical adapters, BT2
parity, and no adaptive search.

## Wave I3 - Market Maker Family

- Decide whether MMXM is a framework or executable model.
- Specify MMBM and MMSM against shared AMD/liquidity/structure facts.
- Prove they are not aliases of CMD, Grinch, or 2022.

Exit: non-overlapping IDs and fixtures; shared facts reused.

## Wave I4 - Unicorn, Breaker, Mitigation, OTE, And Delivery

- Resolve Unicorn versus Breaker+FVG aliasing.
- Treat breaker/mitigation as facts unless a full source-defined model exists.
- Implement OTE only after dealing-range and retracement identity is canonical.
- Implement IRL-to-ERL and ERL-to-IRL only after stable liquidity identities.

Exit: every model has unique causal rules and no concept-count inflation.

## Wave I5 - NDOG, NWOG, TGIF

- Version timezone, market calendar, week/day open, holiday, DST, and first-eligible-bar semantics.
- Reuse canonical opening-gap facts and add models separately.

Exit: clock-edge fixtures, source-defined geometry, BT2 parity, and two-year-capable dataset specification.

## Wave I6 - Charter Models

- Accept definition packets for labels 1-12.
- Classify each as distinct, profile, composite, already covered, or insufficient.
- Implement at most one distinct model per slice.

Exit: no arbitrary IDs and no duplicate strategy behavior.

## Wave I7 - Coverage Acceptance

- Re-run registry/alias/duplicate audit, all concept causality tests, adapter parity, BT2, C1/C1.1, S1, provenance,
  typecheck/build, route smoke, and Playwright.
- Produce model-specific two-year baselines where source/data coverage permits; mark unavailable otherwise.
- Update the frozen manifest only through explicit governance authorization.

Exit: every advertised item is executable with exact evidence or visibly unavailable; all authority remains
none/none/none.

## Frozen-Baseline Impact

I0 changes no frozen baseline. I1 parity work must preserve existing candidate IDs, timestamps, geometry, blockers,
and parameter fingerprints. Any later model or profile adds a new versioned manifest entry; it may not rewrite
historical evidence. Runtime adoption, readiness, Paper Demo, broker access, and execution are out of scope.
