# BT3 Stage 2 IFVG v1/v4 Parity Authorization

Date: 2026-08-12

Branch: `codex/gotrader-backtest-bt3-ifvg-v1-v4-parity`

Parent BT3 Stage 1 acceptance: `2d53d9f5ddd5952768c9eb73fab675b55e7bdb6c`

## Decision

```text
ACC-BT3-IFVG-V1-V4-PARITY-STAGE-2
APPROVED FOR ISOLATED FIXTURE IMPLEMENTATION
```

Stage 2 may freeze deterministic golden outputs for the existing IFVG v1
baseline detector and IFVG v4 shallow-retest experimental profile, adapt their
eligible native geometry into the accepted BT2 canonical opportunity contract,
and preserve representative blocked cases.

This approval does not authorize detector/profile changes, historical dataset
simulation, parameter search, analytics, strategy comparison, runtime adoption,
Paper Demo, readiness, production, broker mutation, order placement, or
execution. CMD, Silver Bullet, other adapters, BT3A, and later phases remain
unauthorized.

## Evidence Boundary

- New Stage 2 fixtures live in a separate BT3 snapshot and hash manifest.
- The Phase 0 baseline snapshots and hashes remain byte-for-byte frozen.
- Fixture dataset/certificate/lineage identities are synthetic and cannot
  impersonate BT1.6 historical qualification.
- v1 remains a replay-only behavioral baseline.
- v4 remains experimental and non-promotable even when its local candidate is
  detector-eligible.
- Forming, blocked, or deep-retest cases emit no canonical opportunity.

## Concurrency Preflight

Verdict: `BT3_STAGE_2_SAFE_WITH_RESTRICTIONS`.

- the isolated worktree begins at the exact accepted Stage 1 commit and is
  clean;
- no historical or observer operator is running;
- approximately 5.7 GiB memory and sufficient disk are available;
- the work is fixture-only and requires no MT5, bridge, server, browser, or raw
  historical repository contact;
- accepted BT2, BT3 Stage 1, governance, and dirty primary worktrees remain
  untouched.

## Acceptance Gate

1. Two consecutive fixture generations must be byte-identical.
2. A separate canonical-text hash manifest must verify each fixture.
3. v1 valid long geometry and representative blocker behavior must match.
4. v4 shallow valid and deep blocked behavior must match.
5. Adapted opportunity timing must begin at the closed-candle boundary.
6. v1 and v4 must remain non-promotable with authority `none / none / none`.
7. Raw candles, outcomes, PnL, readiness, and historical claims are forbidden
   from compact parity evidence.
8. IFVG detector tests, Stage 1 parity, BT2 regressions, typecheck, build, syntax,
   and frozen-hash checks must pass.

## Completion Record

Stage 2 passed under implementation commit
`3f31744bd8eae5516220952732967123bbe53798` and parity report
`sha256:c7d6974cfc7c32a1c28a1c447a40fdd7dd48d9acc934394eac1fc10739b84282`.
No later adapter or historical simulation is authorized by this completion.
