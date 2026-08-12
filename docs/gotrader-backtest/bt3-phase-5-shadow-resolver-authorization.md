# BT3 Phase 5 Shadow Conflict/Confluence Resolver Authorization

Date: 2026-08-12

Branch: `codex/gotrader-backtest-bt3-conflict-resolver`

Parent Session Raid Stage 7 acceptance: `b79a5cc56927621ae2489cbdfa7521aeaf520c1d`

## Decision

```text
ACC-BT3-PHASE-5-SHADOW-RESOLVER
APPROVED FOR ISOLATED CONTRACT IMPLEMENTATION
```

Phase 5 may add a deterministic evidence-family-aware shadow resolver over
validated BT2 canonical opportunities. The resolver may classify:

- a single active candidate;
- same-family overlap;
- cross-family directional confluence;
- cross-family directional conflict;
- mixed overlap containing both duplication and conflict.

The resolver must preserve every active opportunity identity and may not rank,
select, suppress, merge, mutate, or synthesize trade geometry. Evidence-family
membership is explicit input, not inferred from strategy naming. Input ordering
must not influence the result. Current live opportunity resolution remains the
only authoritative path.

Phase 5 may not consume raw candles, run a detector, contact MT5, simulate a
trade, calculate performance, change eligibility, create evidence, authorize
readiness or Paper Demo, adopt runtime behavior, mutate broker state, place an
order, or execute. Phase 6 and BT3A remain unauthorized.

## Acceptance Gate

1. Every input opportunity passes its canonical hash and structural validation.
2. Scope symbol, broker symbol, decision time, and active interval are explicit.
3. Duplicate opportunity identities and unknown evidence families fail closed.
4. Single, same-family, confluence, conflict, mixed, and inactive cases have
   deterministic compact fixtures.
5. Reordered equivalent inputs produce the same resolver identity and bytes.
6. Output contains all active candidate IDs and no selected opportunity field.
7. Authority remains `none/none/none`; all capabilities remain disabled.
8. No raw candles, PnL, outcomes, ranking score, readiness, or promotion claim
   enters the artifact.
9. Focused resolver, complete BT3/BT2, time, typecheck, build, hash, syntax, and
   diff validation pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
currentLiveResolutionAuthoritative: true
shadowSelectionAllowed: false
```

No later phase is authorized by this decision.
