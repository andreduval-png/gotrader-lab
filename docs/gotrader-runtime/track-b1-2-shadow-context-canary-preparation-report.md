# GoTrader B1.2 Shadow Context Canary Preparation Report

## Status

```text
B1.2 PREPARATION VERIFIED
LIVE CANARY NOT ACTIVATED
FORMAL A3.2 ACCEPTANCE STILL REQUIRED
```

This change prepares the B1.2 context-lineage boundary without registering a
runtime profile, scheduler task, live event consumer, or production import.
It is not B1.2 operational acceptance.

## Implemented Boundary

The preparation harness can:

- accept a recorded, verified `MNQ` / `USTECH` M5 close reference;
- rebuild the existing V2 canonical context from in-memory canonical windows;
- compare the rebuilt context artifact, identity, schema, source, trigger, and
  window identities with a compact accepted A3.2 shadow-context reference;
- pass a matching compact request through the B1.1 deterministic engine;
- persist only hashes, IDs, stage artifacts, compact lineage, checkpoints, and
  projections in an isolated test repository;
- coalesce exact duplicates and resume from immutable repository artifacts;
- block stale proof, invalid trigger scope, unsafe context boundaries, and
  context identity drift.

The preparation harness cannot:

- register with the accepted A3.2 runtime or scheduler;
- consume live events;
- mutate A3.2 ledgers;
- persist candles or market facts;
- run a strategy;
- create evidence, readiness, Paper Demo status, memory, trade intent, broker
  access, or production adoption.

The default mode is `disabled`. The only executable mode is
`recorded_artifact_test` under `scripts/support`. The adapter was deliberately
kept outside `src/lib` after the V2 production-adoption guard correctly rejected
an initial source-library placement.

## Deterministic Coverage

`npm.cmd run test:b1-shadow-context-adapter` verifies:

- default-disabled behavior produces no repository files;
- recorded A3.2-style current-live context identity parity;
- deterministic canonical context rebuild;
- exact duplicate coalescing;
- context and window identity mismatch blocking;
- stale time-proof and trigger-scope blocking;
- unsafe context capability blocking;
- process-restart continuity over the same isolated repository;
- compact lineage integrity;
- no persisted candle arrays, facts, OHLC fields, secrets, account data, order
  data, or position data;
- no B1 scheduler or runtime-profile registration;
- authority remains `none / none / none`.

## Validation

Passed during preparation:

- `npm.cmd run test:b1-contract-fixtures`
- `npm.cmd run test:b1-contracts`
- `npm.cmd run test:b1-local-engine`
- `npm.cmd run test:b1-shadow-context-adapter`
- `npm.cmd run test:v2-context-foundation`
- `npm.cmd run test:gotrader-runtime-a3-2`
- `npm.cmd run test:gotrader-runtime-a3-2-integration`
- `npm.cmd run test:mt5-readonly-safety`
- `npm.cmd run smoke:routes` (`44/44`)
- `npm.cmd run build`

The MT5 wrapper was not running during the safety test. Static allowlist and
fail-closed mutation checks passed; this preparation does not require a live
MT5 service.

## Activation Gate

No live B1.2 activation is authorized by this report. After formal A3.2
operational acceptance, B1.2 still requires a separate isolated runtime profile,
explicit scheduler registration, rollback control, and its own operational
observation with zero identity conflicts, duplicate artifacts, ledger gaps,
authority drift, or raw-data leakage.
