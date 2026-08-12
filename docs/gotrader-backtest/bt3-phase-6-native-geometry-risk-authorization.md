# BT3 Phase 6 Native Geometry And Structural Risk Authorization

Date: 2026-08-12

Branch: `codex/gotrader-backtest-bt3-geometry-risk`

Parent Phase 5 acceptance: `1f90c73722bfb7fbf384011d6505714d2bcce64c`

## Decision

```text
ACC-BT3-PHASE-6-NATIVE-GEOMETRY-RISK
APPROVED FOR ISOLATED CONTRACT IMPLEMENTATION
```

Phase 6 may add a deterministic assessment over one validated BT2 canonical
opportunity. The assessment may preserve the strategy-native entry, stop, and
ordered targets and derive only:

- absolute entry-to-stop price distance;
- absolute entry-to-target price distance;
- dimensionless reward-to-risk multiples;
- absolute signal-to-entry price distance; and
- factual target-sequence and signal-entry alignment states.

The assessment is descriptive and instrument-neutral. It must not infer point,
pip, tick, lot, margin, cash, portfolio, or account risk without a separately
sealed instrument specification. It may not impose a minimum or maximum RR,
rank geometry, choose a target, resize a position, rewrite an entry, stop, or
target, create a standardized RR child, or alter opportunity eligibility.

Phase 6 may not consume raw candles, run a detector, contact MT5, simulate a
trade, calculate PnL or performance, compare strategies, create evidence,
authorize readiness or Paper Demo, adopt runtime behavior, mutate broker state,
place an order, or execute. Phase 7 and BT3A remain unauthorized.

## Acceptance Gate

1. Every input passes canonical opportunity hash and structural validation.
2. Schema and geometry mode are exactly the governed BT2 native forms.
3. Long, short, signal-entry displacement, and multiple-target fixtures pass.
4. Input opportunities remain byte-identical and unmodified after assessment.
5. Price distances and dimensionless R values reproduce deterministically.
6. Low or high native RR remains descriptive and does not become a blocker.
7. Target order is reported factually and no target is selected or ranked.
8. Point, pip, tick, lot, cash, margin, portfolio, and sizing fields are absent.
9. Authority remains `none/none/none`; all capabilities remain disabled.
10. Focused geometry, complete BT3/BT2, time, typecheck, build, hash, syntax,
    and diff validation pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
nativeGeometryMutationAllowed: false
standardizedRrExperimentAllowed: false
positionSizingAllowed: false
currentLiveGeometryAuthoritative: true
```

No later phase is authorized by this decision.

## Completion Record

Phase 6 passed under implementation commit
`bd59f70c3bf221a03343f7f76cf0f6c7d602ce25` and report
`sha256:c4106d5cc597263f10974a74606b2a0293bd98a644c4ba523c6907853db142cd`.
Phase 7 remains separately gated and unauthorized.
