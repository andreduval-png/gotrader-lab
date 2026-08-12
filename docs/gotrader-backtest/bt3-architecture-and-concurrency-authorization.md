# BT3 IFVG Parity Architecture And Concurrency Authorization

Date: 2026-08-12

Branch: `codex/gotrader-backtest-bt3-ifvg-parity`

Parent BT2 acceptance: `0d98523cc74286a5a146afb34ccdca3fb9ee11ad`

## Decision

```text
ACC-BT3-IFVG-PARITY-STAGE-1
APPROVED FOR ISOLATED FIXTURE IMPLEMENTATION
```

BT3 Stage 1 may adapt the frozen IFVG v2 negative-control and IFVG v3
positive-canary fixtures into the accepted BT2 canonical opportunity contract.
The adapter may preserve native entry, stop, target, direction, profile,
classification, blocker, and causal timing identities and may emit compact
parity reports.

This approval does not authorize detector or profile changes, historical
simulation, strategy comparison, parameter search, performance or statistical
claims, runtime adoption, B1.3/B1.4 activation, Paper Demo, readiness,
production, broker mutation, order placement, or execution. BT3A and every
later strategy migration remain unauthorized.

## Ownership

| Component | Owns | Excludes |
| --- | --- | --- |
| Frozen IFVG fixtures | Expected classification, blockers, and native geometry | BT2 fills and outcomes |
| BT3 IFVG adapter | Deterministic fixture-to-opportunity translation | Strategy logic changes |
| BT3 parity comparison | Exact input, geometry, blocker, and identity comparison | Profitability or promotion |
| BT2 opportunity contract | Canonical immutable opportunity identity | Detector selection |
| BT2 simulator | Future order/fill lifecycle when separately authorized | BT3 Stage 1 fixture parity |

## Evidence Boundary

Stage 1 operates only on committed frozen snapshots. Each adapter call must
verify the snapshot file SHA-256 against the frozen baseline manifest before
translation. Fixture dataset, certificate, and lineage IDs are derived from
the snapshot identity and are explicitly synthetic. They must not reuse or
impersonate the BT1.6 qualified historical dataset identity.

An adapted opportunity is parity evidence only. It is not evidence that the
strategy has run against the qualified two-year dataset, and it cannot be used
for performance, readiness, or production conclusions.

## Concurrency Preflight

Verdict: `BT3_STAGE_1_SAFE_WITH_RESTRICTIONS`.

- the isolated BT3 worktree begins at the exact accepted BT2 commit and is
  clean;
- the dirty primary worktree and accepted BT2/governance worktrees remain
  untouched;
- no observer or historical qualification operator is running;
- Stage 1 requires no MT5, bridge, browser, server, or raw candle contact;
- current memory and disk are sufficient for fixture-only compilation/tests;
- elevated desktop CPU prevents no fixture-only action but excludes heavy
  historical work.

Implementation restrictions:

1. Work only in the isolated BT3 worktree.
2. Never edit the frozen baseline snapshots or hash manifest.
3. Fail closed on hash, profile, geometry, timing, identity, or blocker drift.
4. Preserve negative-control classification and deny promotion independently
   of whether a local canonical candidate can be represented.
5. Emit no opportunity for forming or rejected fixtures.
6. Keep authority `none / none / none` and all capabilities disabled.
7. Do not persist raw candles in reports or Git.

## Authority

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
canCreateTradeIntent: false
canPlaceOrder: false
canApproveReadiness: false
canApplyCalibration: false
```

## Implementation Gate

BT3 Stage 1 is authorized for IFVG fixture adapters, exact parity comparison,
deterministic tests, and compact reports. Historical dataset-backed IFVG
simulation and every additional strategy require a separate acceptance and
fresh authorization decision.
