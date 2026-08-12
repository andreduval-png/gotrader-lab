# BT3 Stage 4 Silver Bullet Parity Authorization

Date: 2026-08-12

Branch: `codex/gotrader-backtest-bt3-silver-bullet-parity`

Parent CMD Stage 3 acceptance: `c4f9df85b6c8f7ba0caebc3f91a8bbbb53bd3b04`

## Decision

```text
ACC-BT3-SILVER-BULLET-PARITY-STAGE-4
APPROVED FOR ISOLATED FIXTURE IMPLEMENTATION
```

Stage 4 may freeze compact, deterministic Silver Bullet v1 and v2 detector
fixtures and translate eligible native detector geometry into the BT2 canonical
opportunity contract. Both directions and representative blocked paths may be
covered. V1 must remain a rejected negative-control profile. V2 must remain a
strict research profile with insufficient sample depth.

Stage 4 may not change detector gates, run historical simulation or replay,
make performance claims, perform comparison/search/statistics, authorize Paper
Demo or readiness, adopt runtime behavior, mutate broker state, place orders,
or execute. Turtle Soup and later adapters remain unauthorized.

## Acceptance Gate

1. V1 and v2 valid/blocked compact fixtures are byte-stable.
2. Native side, entry, stop, target, timing, and blockers match exactly.
3. V1 remains `negative_control`; v2 remains `strict_research`.
4. Both profiles remain non-promotable regardless of geometry eligibility.
5. New fixture hashes use a separate BT3 manifest; prior hashes remain frozen.
6. Fixture certificate/dataset identities remain synthetic.
7. Raw candles, outcomes, PnL, readiness, and trading authority are absent.
8. Focused Silver Bullet, complete BT3/BT2, time normalization, typecheck,
   build, syntax, and hash validation pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
promotionAllowed: false
```

No later strategy adapter is authorized by this decision.

## Completion Record

Stage 4 passed under implementation commit
`da78ccbbc8166ccaf672ab54dbf65486964d3625` and report
`sha256:3052c1b57e3d146a34de578d1a488dbb74c205281e7b81ed09ed1d940c1ed14e`.
No later strategy adapter is authorized by this completion.
