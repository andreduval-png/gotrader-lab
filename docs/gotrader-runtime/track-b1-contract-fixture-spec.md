# GoTrader Infrastructure Track B1 - Contract Fixture Specification

Status: planning and fixture validation only

Planning baseline: `ad8608a6f40361a3a9a84b92c93a4da4d64e59b1`

Planning branch: `codex/gotrader-infrastructure-track-b1-planning`

This specification prepares B1.0 contract tests without implementing a job
engine, repository, scheduler task, runtime profile, strategy adapter, evidence
writer, readiness writer, Paper-Demo path, broker path, or execution path.

## 1. Safety Boundary

Every accepted fixture must preserve:

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
shadowOnly: true
canCreateEvidence: false
readinessChanged: false
productionAdoptionAllowed: false
```

B1 fixtures may describe deterministic research jobs. They must not contain raw
candles, imported OHLCV arrays, raw MT5 snapshots, screenshots, base64 payloads,
credentials, secrets, account data, order data, position data, balance data,
broker mutation, execution requests, readiness grants, or calibration-apply
permission.

## 2. Canonical Job Identity

The planned canonical hash version is the existing
`gotrader-v2-sha256-v1`.

Canonical serialization:

1. removes `undefined` object values;
2. recursively sorts object keys;
3. preserves array order;
4. serializes as UTF-8 JSON without whitespace;
5. hashes `gotrader-v2-sha256-v1`, a newline, then the canonical JSON;
6. returns `sha256:<64 lowercase hex characters>`.

Fields that represent sets, including `requiredFacts`, `requiredTimeframes`, and
schema-version keys, must be normalized before hashing. Fixture set arrays are
unique and lexically sorted.

The logical job identity core contains:

- `jobType`;
- `jobVersion`;
- `triggerEventId`;
- `triggerCandleIdentity`;
- `requestedSymbol`;
- `brokerSymbol`;
- `primaryTimeframe`;
- `contextArtifactId`;
- `contextIdentity`;
- `strategyId`, when present;
- `profileId`, when present;
- `profileVersion`, when present;
- `parameterHash`, when present;
- `costModelId`, when present;
- `requiredFacts`;
- `requiredTimeframes`;
- `sourceFingerprint`;
- `timeContractId`;
- `schemaVersions`.

`requestedAt` is intentionally excluded from logical identity. It remains in
the full request payload hash. Therefore:

- an exact repeated request is idempotent;
- a request with the same logical identity and the same payload hash coalesces;
- the same logical identity with a different `requestedAt` or any other
  non-identity payload change is a payload conflict and fails closed;
- source, context, profile, parameter, cost-model, time-contract, or schema
  drift creates a different logical job ID.

This strict rule prevents a later submission from silently replacing the
original request for the same market event.

## 3. Planned Compact Contracts

### 3.1 Request

The fixture request is a compact projection of the future
`CanonicalResearchJobRequest`. It includes the identity fields, `requestedAt`,
`shadowOnly: true`, and authority `none / none / none`.

No request fixture grants evidence, readiness, production, Paper-Demo, or
execution capability.

### 3.2 Stage artifact

A future immutable stage artifact must contain:

- stage name and version;
- logical job ID;
- input artifact IDs;
- compact output summary;
- deterministic blocker codes;
- start and completion timestamps;
- attempt number;
- payload hash;
- previous-stage hash;
- status;
- safety capabilities;
- authority.

The stage payload hash covers the complete stage artifact core. A different
payload for the same stage identity is quarantined as a conflict.

### 3.3 Checkpoint

A checkpoint is a rebuildable projection, not evidence. It contains:

- logical job ID;
- current state and stage;
- completed stage artifact IDs;
- pending next stage;
- retry count;
- cancellation state;
- lease owner and expiry;
- heartbeat time;
- compact blocker and next action.

A cancelled job cannot seal a result. An expired lease cannot seal a result.
Restart recovery may rebuild the checkpoint from immutable stage artifacts.

### 3.4 Result

Initial result classifications are:

- `context_lineage_verified`;
- `context_lineage_blocked`;
- `strategy_shadow_detected`;
- `strategy_shadow_rejected`;
- `strategy_shadow_blocked`;
- `strategy_shadow_expired`.

A positive or detected result remains shadow research. It cannot create
evidence, change readiness, allow production adoption, or create an execution
intent.

### 3.5 Operator projection

The projection may expose:

- job status;
- stage;
- strategy/profile identity;
- source status;
- result classification;
- blockers;
- next action;
- immutable artifact IDs;
- freshness;
- authority.

It must not expose controls for readiness promotion, calibration application,
Paper-Demo order creation, broker mutation, or execution.

## 4. State And Recovery Rules

Planned nonterminal sequence:

```text
queued
  -> input_verification
  -> context_rebuild
  -> context_identity_verification
  -> adapter_detection
  -> result_validation
  -> result_seal
  -> completed
```

Allowed terminal states:

- `completed`;
- `blocked`;
- `failed`;
- `cancelled`;
- `expired`.

Rules:

- deterministic blockers do not retry;
- bounded transport failures may retry;
- cancellation is checked before every stage and immediately before sealing;
- an expired or foreign lease cannot complete a job;
- a delayed result from a cancelled or superseded job is discarded;
- duplicate requests coalesce by logical job ID and payload hash;
- conflicting payloads quarantine and block;
- no-setup is a successful research result, not a runtime failure.

## 5. Fixture Matrix

Fixtures live in `tests/fixtures/v2-research-b1/`.

| Fixture | Expected planning assertion |
| --- | --- |
| safe context lineage request | Accepted; stable logical job ID and payload hash. |
| safe strategy shadow request | Accepted; stable ID; shadow-only result boundary. |
| identity drift matrix | Source, context, profile, parameter, cost, time, and schema drift change job identity. |
| idempotency/conflict matrix | Exact duplicate coalesces; same ID with changed payload blocks. |
| cancellation/lease matrix | Cancelled or stale-lease jobs cannot seal. |
| forbidden-fields matrix | Raw data, authority drift, execution, account/order/position, readiness, and auto-apply fields block. |

Forbidden fixtures use non-sensitive sentinel values. They contain no real
candles, credentials, account identifiers, orders, positions, or secrets.

## 6. Static Fixture Validator

`scripts/test-b1-contract-fixtures.mjs` is a planning validator only. It:

- parses every fixture listed by the manifest;
- verifies the manifest and fixture versions;
- verifies sorted unique set fields;
- verifies authority and shadow boundaries;
- rejects forbidden keys recursively;
- calculates canonical job and payload hashes twice and requires identical
  results;
- verifies identity-drift relationships;
- verifies exact-duplicate and payload-conflict relationships;
- verifies cancellation and stale-lease seal blockers;
- verifies forbidden-field blocker codes;
- scans accepted fixtures for raw candle, secret, account, order, position,
  readiness, calibration-apply, and execution data.

The validator does not import runtime services, read live market data, bind a
port, start a process, write runtime state, register a scheduler task, or create
evidence.

## 7. B1.0 Implementation Gate

These fixtures do not authorize B1.0 implementation. Implementation begins only
after:

1. the final A3.2 observer completes successfully;
2. the integrity-hashed A3.2 acceptance report is reviewed and committed;
3. the accepted A3.2 commit is frozen;
4. a new B1 implementation worktree is created from that accepted commit.

At B1.0 implementation time, the fixture validator becomes the behavioral
input to typed contracts and canonical identity helpers. Runtime and scheduler
integration remain deferred to later B1 gates.
