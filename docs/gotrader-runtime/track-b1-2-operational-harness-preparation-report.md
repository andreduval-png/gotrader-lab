# GoTrader B1.2 Operational Harness Preparation Report

## Status

```text
B1.2 OPERATIONAL HARNESS PREPARED
DEFAULT STATE DISABLED
NO LIVE RUNTIME OR SCHEDULER REGISTRATION
```

This checkpoint prepares B1.2 lifecycle, control, health, and audit behavior in
script-only test support. It does not activate or accept the B1.2 live canary.

## Profile Contract

The preparation profile is:

```text
b1_2_shadow_context_canary_preparation
```

Its state machine has only two modes:

- `disabled`, the default and rollback state;
- `recorded_artifact_test`, an explicitly acknowledged fixture-validation mode.

There is no live mode. The harness rejects an injected adapter unless it reports
recorded-test mode, no runtime registration, no scheduler registration, no live
consumption, and authority `none / none / none`.

## Durable Safety Behavior

The harness persists one compact integrity-hashed state envelope containing:

- current preparation mode and applied control revision;
- bounded counters;
- the latest compact outcome reference;
- at most 100 compact audit entries;
- authority and disabled capabilities.

It never persists the event input, candle windows, candles, context facts, OHLC,
secrets, account data, order data, or position data. Operator control reasons are
stored only as canonical hashes.

Missing state initializes disabled. Valid state restarts without losing counters
or rollback state. Invalid or tampered state blocks initialization and cannot
invoke the adapter.

## Control And Rollback

Controls require:

- the exact preparation control version;
- a strictly newer positive revision;
- an allowlisted mode;
- a canonical timestamp;
- a bounded non-empty reason;
- explicit operator acknowledgement;
- authority `none / none / none`;
- no unknown fields.

Stale controls are ignored. Unknown live modes, unknown fields, missing
acknowledgement, and authority drift are rejected. Rollback transitions directly
to `disabled` and prevents subsequent adapter calls.

## Health And Audit Counters

The compact health view reports:

- received, disabled, blocked, completed, and coalesced outcomes;
- identity mismatches;
- applied and rejected controls;
- rollbacks and restarts;
- current blockers and latest compact outcome;
- runtime, scheduler, live-consumption, and accepted-ledger mutation flags;
- immutable disabled capabilities and authority.

## Focused Verification

`npm.cmd run test:b1-shadow-canary-harness` verifies:

- default-disabled startup;
- disabled mode cannot invoke the adapter;
- explicit acknowledged recorded-test enablement;
- rejection of live mode and authority drift;
- rejection of an unsafe injected adapter;
- stale-control handling;
- completed, duplicate, and mismatch counters;
- immediate rollback;
- restart continuity;
- integrity-tamper blocking;
- bounded compact audit retention;
- reason hashing and raw-input exclusion;
- no runtime or scheduler registration;
- authority `none / none / none`.

## Remaining Gate

Formal A3.2 operational acceptance is still required before implementing an
isolated live B1.2 profile. Activation must use a separately reviewed runtime
registration, scheduler allowlist entry, rollback path, and operational
observation. This preparation checkpoint grants none of those capabilities.
