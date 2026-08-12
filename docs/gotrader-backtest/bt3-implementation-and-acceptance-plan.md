# BT3 Implementation And Acceptance Plan

## Stage 1 - IFVG Frozen Fixture Parity

Authorized now:

1. verify frozen IFVG v2/v3 snapshot hashes before use;
2. derive explicit synthetic fixture dataset/certificate/lineage identities;
3. translate eligible frozen geometry into BT2 canonical opportunities;
4. preserve negative-control and positive-canary classification separately
   from candidate eligibility;
5. preserve forming/rejected blockers without emitting opportunities;
6. compare strategy, profile, source, timing, geometry, blockers, authority,
   and canonical identities exactly;
7. write compact parity evidence containing no raw candles.

## Acceptance Matrix

- all frozen snapshot hashes equal the committed hash manifest;
- IFVG v2 negative control preserves native geometry and remains
  `promotionAllowed: false`;
- IFVG v3 positive canary preserves native geometry exactly;
- IFVG v3 forming and rejected fixtures emit no opportunity and retain exact
  blocker lists;
- opportunity activation is no earlier than the first candle after the frozen
  closed-candle boundary;
- future fixture fields and forbidden outcome fields cannot influence the
  canonical opportunity;
- malformed hashes, unsupported profiles, missing geometry, and identity drift
  fail closed;
- repeated adaptation is byte- and hash-deterministic;
- authority remains `none / none / none` with every capability disabled;
- no raw candles, outcomes, PnL, statistics, readiness, or promotion claims
  appear in compact evidence;
- focused tests, BT2 regression tests, typecheck, build, syntax, and diff checks
  pass from the exact candidate.

## Deferred Work

- IFVG historical dataset-backed simulation;
- migration of additional frozen strategies;
- cross-strategy comparison or selection;
- BT4 analytics, costs experiments, R:R sweeps, and statistics;
- BT5+ walk-forward, holdouts, Monte Carlo, risk, and reporting;
- B1.3/B1.4 runtime adoption and every broker/execution capability.

## Exit Decision

Stage 1 is complete only after an acceptance report seals the exact parent,
implementation, frozen snapshot, parity report, and validation identities.
Completion authorizes neither historical IFVG simulation nor the next strategy
adapter implicitly.
