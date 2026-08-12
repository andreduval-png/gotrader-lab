# BT3 Stage 3 CMD Parity Authorization

Date: 2026-08-12

Branch: `codex/gotrader-backtest-bt3-cmd-parity`

Parent IFVG Stage 2 acceptance: `ee7b6be68a0ac03073b3aaeb1738695617c356eb`

## Decision

```text
ACC-BT3-CMD-PARITY-STAGE-3
APPROVED FOR ISOLATED FIXTURE IMPLEMENTATION
```

Stage 3 may freeze compact CMD policy/detector fixtures and translate eligible
`cmd_high_displacement_v2_research` native geometry into the BT2 canonical
opportunity contract. The `ict_cmd_short_paper_watchlist_v1` lane must remain a
policy-only no-opportunity fixture because it has no dedicated canonical
detector ownership.

Stage 3 may not borrow v2 geometry for v1, change CMD gates, run historical
simulation, make performance claims, perform search, authorize Paper Demo or
readiness, adopt runtime behavior, mutate broker state, place orders, or
execute. Silver Bullet and later adapters remain unauthorized.

## Acceptance Gate

1. CMD v1 policy-only fixture remains no-opportunity and non-promotable.
2. CMD v2 valid and representative blocked compact fixtures are byte-stable.
3. v2 native entry, stop, target, side, timing, and blockers match exactly.
4. New fixture hashes use a separate BT3 manifest; prior hashes remain frozen.
5. Fixture certificate/dataset identities remain synthetic.
6. Raw candles, outcome metrics, PnL, readiness, and authority are absent.
7. CMD focused tests, complete BT3/BT2 regression suites, typecheck, build,
   syntax, and hash checks pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
promotionAllowed: false
```

## Completion Record

Stage 3 passed under implementation commit
`79c49946d13a4b72ebfc431dbe55f46b94011b25` and report
`sha256:29c71b12eb6501393285c5f43d3e662681ba3087c7737e11cdeb49a901a9c02f`.
No later strategy adapter is authorized by this completion.
