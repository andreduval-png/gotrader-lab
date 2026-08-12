# BT2 Implementation And Acceptance Plan

## Stage 1 - Contracts And Pure Engine

Authorized now:

1. authority/capability constants and forbidden-field scanning;
2. canonical opportunity, experiment, transition, simulation-record, checkpoint,
   and ledger-seal types;
3. canonical hashing and validation;
4. pure order activation, fill, gap, intrabar, exit, cost, and excursion logic;
5. fixture storage with atomic immutable writes and conflict checks;
6. deterministic unit/property tests and controlled restart tests.

No legacy strategy adapter or live dataset execution is part of Stage 1.

## Stage 2 - Qualified Dataset Shadow Harness

After Stage 1 acceptance and a fresh safe preflight, add a read-only iterator
over a supplied qualified BT1 repository, bounded partitions/workers, durable
checkpointing, uninterrupted-versus-resumed seal comparison, and compact
resource reports. Use synthetic canonical opportunities only. MT5 contact is
unnecessary because BT2 consumes sealed BT1 storage.

## Acceptance Matrix

- exact BT1.6 certificate/registry binding and rejection of unqualified input;
- future-append invariance and HTF-close availability;
- deterministic opportunity/record/ledger identities;
- complete long/short OHLC ambiguity and gap matrices;
- explicit fill, expiry, insufficient-data, ambiguity, and terminal outcomes;
- gross/net cost separation and price/point/pip/R unit separation;
- no unsupported instruction approximation;
- identical uninterrupted and resumed ledger seals;
- bounded memory/storage and deterministic parallel ordering;
- immutable conflict and corrupt-checkpoint rejection;
- zero raw candles in compact artifacts or Git;
- strategy neutrality and authority `none / none / none`;
- typecheck, build, syntax, source-integrity, provenance, and safety validation.

## Deferred Phases

- BT3: frozen strategy adapters and parity;
- BT4: analytics, costs experiments, R:R sweeps, and statistics;
- BT5+: walk-forward, holdouts, Monte Carlo, risk, and reporting;
- B1.4: separately authorized orchestration only;
- all broker, Paper Demo, readiness, production, and execution behavior.

## Exit Decision

BT2 is complete only after Stages 1 and 2 pass and a committed acceptance report
seals exact implementation, fixture, dataset, engine, checkpoint, and ledger
identities. Passing BT2 authorizes neither BT3 nor runtime adoption implicitly.
