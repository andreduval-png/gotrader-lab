# GoTrader Infrastructure Track B1 - Autonomous Canonical Research Engine Plan

Status: design verified; implementation not yet authorized

Planning branch: `codex/gotrader-infrastructure-track-b1-planning`

Planning baseline: `ad8608a6f40361a3a9a84b92c93a4da4d64e59b1`

## 1. Decision

Track B1 is the correct next design track while the final Track A3.2 live
operational acceptance waits for the next normal market maintenance break.

B1 must not be implemented against the operational runtime until the A3.2
acceptance report passes its full observation gate. This document permits design
and fixture work only. It does not authorize a new live runtime profile, strategy
promotion, evidence creation, readiness changes, or execution.

The correct B1 interpretation is:

> A durable, event-driven, research-only job engine that consumes verified
> canonical market context and produces immutable shadow research artifacts.

It is not:

- another browser research loop;
- a replacement for the existing Strategy Library;
- a rewrite of replay, walk-forward, evidence, or readiness;
- an LLM-controlled research authority;
- an automatic model discovery or calibration-apply loop;
- an execution, paper-order, broker, account, order, or position service.

## 2. Repository Verification

### 2.1 Already implemented and reusable

The current repository already provides the following foundations:

- MT5 read-only candle and range transport;
- verified current-live time contracts and terminal-clock proof;
- a continuous closed-candle feed;
- a bounded, idempotent autonomous scheduler;
- current market-state awareness and safe market-close pause behavior;
- historical context hydration for current-live analysis;
- a canonical V2 market context engine;
- causal strategy adapter contracts;
- an IFVG v3 shadow adapter and comparison lifecycle;
- source fingerprints, window identities, schema versions, and authority checks;
- compact runtime checkpoints and integrity-hashed reports;
- fail-closed authority `none / none / none`;
- disabled evidence, readiness, production, and execution capabilities.

These are the B1 foundation. They should be extended through compatibility
adapters, not replaced.

### 2.2 Partially implemented

The repository also contains older research orchestration systems:

- `src/lib/autonomousResearch/*`;
- `src/lib/researchCycle/*`;
- `src/lib/autoResearch/*`;
- validation-chain, replay, walk-forward, evidence, maturity, and readiness
  modules;
- localStorage and IndexedDB persistence for browser research state.

These systems contain useful behavior, but their state is coupled to browser
workflows and large aggregate run objects. They are not suitable as the B1
runtime contract.

B1 should eventually project compact results into compatibility views for those
systems. It should not copy their monolithic state model into the always-on
runtime.

### 2.3 Current blockers

The following constraints are active:

1. A3.2 has not completed its final live maintenance-break acceptance.
2. Historical DST and historical time-basis authority remain unverified.
3. Phase 3F IFVG evidence completion remains blocked by historical source
   identity and insufficient live operational ledger evidence.
4. `shadow_ifvg_comparison` remains intentionally disabled in the scheduler.
5. No V2 output is authorized to create validation-chain evidence, readiness,
   Paper-Demo eligibility, production adoption, or execution.

These are real gates. B1 must represent them as blockers rather than work around
them.

## 3. Architecture Corrections

### 3.1 Separate current-market and historical research lanes

B1 must contain two distinct workloads.

#### Current-market shadow lane

- Trigger: verified `candle_closed` event.
- Input: current-live verified canonical windows.
- Work: rebuild canonical context, validate identity, optionally run an
  allowlisted shadow strategy adapter.
- Output: compact detection or blocker artifact.
- Latency: bounded and low.
- Persistence: compact immutable results only.
- Evidence authority: none.

#### Explicit historical research lane

- Trigger: explicit operator request or separately scheduled research job.
- Input: historically verified, immutable dataset manifest.
- Work: detector replay, walk-forward, OOS, and Monte Carlo through existing
  deterministic engines.
- Output: immutable research artifacts.
- Latency: background and resumable.
- Availability: disabled until historical time basis and DST policy are
  verified.

Deep 90-day or 180-day research must never become a page-load task or a
side-effect of every live candle close.

### 3.2 Rebuild context deterministically for a research job

The A3.2 compact shadow-context artifact stores fact counts and identities, not
the full typed fact graph. B1 strategy adapters need typed canonical facts.

B1 should not persist raw candles or silently expand the A3.2 artifact. Instead:

1. receive the closed-candle event and referenced context artifact identity;
2. read the canonical rolling windows as-of that event;
3. rebuild the V2 context using the existing context engine;
4. verify the rebuilt context artifact ID matches the expected identity;
5. pass typed facts to the adapter in memory;
6. persist only compact result artifacts and lineage.

This preserves deterministic restart behavior without storing candle arrays or
duplicating a second market-context model.

### 3.3 Keep the LLM outside the deterministic core

An LLM may later explain a completed B1 projection or propose a new research job.
It may not:

- create or alter a canonical fact;
- choose a different source identity;
- change strategy thresholds;
- skip a stage;
- create evidence;
- approve readiness;
- apply calibration;
- grant authority;
- place or route a trade.

An unavailable LLM must not block deterministic B1 work.

## 4. Proposed B1 Contracts

Add contracts under `src/lib/v2/research/`. Names may be refined during
implementation, but their responsibilities must remain separate.

### 4.1 `CanonicalResearchJobRequest`

Required compact fields:

- `jobType`;
- `jobVersion`;
- `requestedAt`;
- `triggerEventId`;
- `triggerCandleIdentity`;
- `requestedSymbol`;
- `brokerSymbol`;
- `primaryTimeframe`;
- `contextArtifactId`;
- `contextIdentity`;
- `strategyId` when applicable;
- `profileId` and `profileVersion` when applicable;
- `parameterHash`;
- `costModelId` when applicable;
- `requiredFacts`;
- `requiredTimeframes`;
- `sourceFingerprint`;
- `timeContractId`;
- `schemaVersions`;
- `shadowOnly: true`;
- `authority: none / none / none`.

Forbidden request data:

- raw candle arrays;
- imported OHLCV arrays;
- account, order, position, balance, or credential data;
- broker mutation commands;
- execution intent;
- readiness or evidence grants;
- calibration-apply permission.

### 4.2 `CanonicalResearchJobIdentity`

The logical job ID must be a canonical hash over:

- job type and version;
- trigger event identity;
- source and window identity;
- canonical context identity;
- strategy/profile/version;
- parameter hash;
- cost model;
- time contract and offset regime;
- schema versions.

An identical request must resolve to the same logical job. The same logical job
ID with a different payload hash is a conflict and must fail closed.

### 4.3 `CanonicalResearchStageArtifact`

Every stage writes an immutable compact artifact containing:

- stage name and version;
- job ID;
- input artifact IDs;
- output summary;
- deterministic blocker codes;
- start and completion timestamps;
- attempt number;
- payload hash;
- previous-stage hash;
- status;
- safety capabilities;
- authority.

The artifact must not contain raw candles, full MT5 snapshots, screenshots,
base64 data, secrets, or mutable broker commands.

### 4.4 `CanonicalResearchJobCheckpoint`

The checkpoint is a recoverable projection, not the evidence record. It stores:

- current stage;
- completed stage artifact IDs;
- pending next stage;
- retry state;
- cancellation state;
- lease owner and expiry;
- last heartbeat;
- terminal status;
- compact blocker and next action.

The immutable stage artifacts remain authoritative if a checkpoint is lost or
must be rebuilt.

### 4.5 `CanonicalResearchResultArtifact`

Initial result types:

- `context_lineage_verified`;
- `context_lineage_blocked`;
- `strategy_shadow_detected`;
- `strategy_shadow_rejected`;
- `strategy_shadow_blocked`;
- `strategy_shadow_expired`.

Each result must contain:

- complete research identity;
- causal timestamps;
- compact strategy geometry when present;
- deterministic diagnostics and blockers;
- source and context lineage;
- `shadowOnly: true`;
- `canCreateEvidence: false`;
- `readinessChanged: false`;
- `productionAdoptionAllowed: false`;
- authority `none / none / none`.

### 4.6 `CanonicalResearchProjection`

This is the operator-facing summary:

- job status;
- current stage;
- strategy/profile identity;
- source status;
- result classification;
- blocker summary;
- next action;
- artifact IDs;
- freshness;
- authority.

It contains no controls for trade execution, readiness promotion, or calibration
application.

## 5. Job State Machine

The initial deterministic state machine is:

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

- Source, time, identity, schema, or authority ambiguity produces `blocked`.
- A detector returning no setup is a successful `completed` research result,
  not a runtime failure.
- Deterministic blocker results are not retried.
- Transport and transient file-system failures may retry within a bounded
  policy.
- Cancellation is checked before every stage and immediately before sealing.
- A stale lease cannot complete a job.
- A delayed result from a cancelled or superseded job is discarded.

## 6. Storage Model

B1 should use a bounded, append-first disk repository beneath the selected
runtime profile:

```text
.gotrader/runtime/<profile>/research/
  requests/
  stages/
  results/
  checkpoints/
  projections/
  quarantine/
```

Requirements:

- atomic temp-write plus rename;
- schema and payload hash on every artifact;
- integrity verification on read;
- path traversal protection;
- bounded artifact sizes;
- bounded completed-job retention;
- quarantine for corrupt or conflicting files;
- rebuildable checkpoints and projections;
- no browser localStorage dependency;
- no raw candles in persisted research artifacts.

Existing browser state remains readable during migration. B1 must not perform a
one-shot rewrite of legacy storage.

## 7. Scheduler Integration

Do not enable a broad autonomous research task in the current A3.2 profile.

Create an additive future profile:

`always_on_canonical_research_shadow`

It inherits the verified A3.2 runtime and initially enables one new task:

`canonical_research_context_lineage`

This first task verifies context identity and repository behavior only. It does
not run a strategy and cannot create evidence.

After Phase 3 strategy canary gates are complete, a second task may be enabled:

`canonical_research_strategy_shadow`

Scheduler requirements:

- verified `candle_closed` triggers only;
- one active logical job per strategy/profile/symbol/timeframe;
- deterministic job ID;
- duplicate coalescing;
- bounded queue depth;
- newest-state coalescing when backpressure is reached;
- no concurrent mutation of the same checkpoint;
- runtime timeout and memory limits;
- transport retry only;
- compact health and blocker projection.

`shadow_ifvg_comparison` must remain disabled until the separate Phase 3 gate
authorizes its successor task.

## 8. Phased Implementation

### B1.0 - Contracts and identity

Deliver:

- research job, stage, checkpoint, result, and projection types;
- canonical hashing and serialization;
- authority and forbidden-field assertions;
- deterministic fixture tests.

Runtime effect: none.

Exit gate:

- A3.2 final acceptance has passed;
- all contract and safety tests pass;
- no scheduler registry change.

### B1.1 - Local deterministic job engine

Deliver:

- stage runner;
- idempotency and lease handling;
- cancellation, timeout, and retry policy;
- bounded disk artifact repository;
- checkpoint recovery;
- fixture-only context-lineage handler.

Runtime effect: none. Run only through focused CLI tests.

Exit gate:

- restart recovery proven;
- duplicate requests produce one logical result;
- payload conflicts quarantine and block;
- tampered artifacts are rejected;
- no raw candle persistence.

### B1.2 - Live shadow context-lineage canary

Deliver:

- additive runtime profile;
- closed-candle scheduler task;
- deterministic context rebuild and identity comparison;
- compact operator projection.

Runtime effect: current-live shadow lineage validation only.

Exit gate:

- multi-hour canary with no duplicate jobs, conflicts, gaps, or managed
  restarts;
- bounded memory and disk growth;
- market-close pause and resume verified;
- historical eligibility remains false;
- authority remains none.

### B1.3 - IFVG v3 shadow adapter job

Prerequisites:

- Phase 3 IFVG canary lifecycle is complete;
- adapter/input identity is frozen;
- current-live source and context eligibility are satisfied.

Deliver:

- adapter registry entry for `ifvg_fresh_retest_v3_research`;
- in-memory context-to-adapter handoff;
- compact detected/rejected/blocked/expired results;
- parity comparison against the frozen legacy path.

Runtime effect: strategy shadow research only.

Exit gate:

- causal detection parity within the approved tolerance;
- zero unsupported production side effects;
- no evidence, readiness, Paper-Demo, or execution writes.

### B1.4 - Explicit historical research jobs

Prerequisites:

- historical time basis and DST policy verified;
- immutable historical dataset manifest accepted;
- Phase 3F historical evidence regeneration complete.

Deliver:

- explicit replay, walk-forward, OOS, and Monte Carlo job adapters;
- resumable stages using existing deterministic engines;
- shared research identity and immutable lineage.

Runtime effect: manual or scheduled background research only.

Exit gate:

- frozen legacy metrics remain non-inferior;
- no lookahead or cross-window leakage;
- result artifacts match the active profile and source identity;
- no automatic evidence or readiness promotion.

### B1.5 - Compatibility projections

Deliver:

- read-only adapters for existing Dashboard, Advisor, Validation Chain, and
  research views;
- materialized compact projections;
- legacy fallback when B1 is unavailable.

Runtime effect: display and query optimization only.

Exit gate:

- no page starts deep research automatically;
- UI does not infer evidence or readiness;
- legacy behavior remains recoverable per profile.

## 9. Tests And Acceptance

### 9.1 Contract tests

- canonical serialization is stable;
- job identity changes for source, context, profile, parameters, cost model, time
  contract, or schema changes;
- authority other than none is rejected;
- forbidden data is rejected;
- result status does not imply evidence or readiness.

### 9.2 Repository tests

- atomic writes survive interruption;
- checkpoints recover from immutable stages;
- duplicate writes are idempotent;
- conflicting payloads are quarantined;
- corrupt hashes fail closed;
- retention is bounded;
- no raw candle arrays are serialized.

### 9.3 Orchestration tests

- completed stages are not rerun after restart;
- transient transport failures retry within policy;
- deterministic blockers do not retry;
- cancellation and stale leases cannot seal a result;
- queue coalescing preserves the newest valid event;
- no page-render dependency exists.

### 9.4 Live canary acceptance

Minimum initial canary:

- verified current-live runtime;
- at least three completed M5-triggered research jobs;
- at least three matching context identities;
- zero duplicate logical jobs;
- zero payload conflicts;
- zero ledger gaps;
- zero authority drift;
- zero evidence/readiness/production writes;
- zero managed restart delta;
- fresh proof after a market-close pause and resume when the observation spans
  that boundary;
- bounded resource growth.

No positive strategy result is required for infrastructure acceptance. Honest
blocked or no-setup results are valid.

### 9.5 Required regression suite

At minimum:

- `npm.cmd run build`;
- `npm.cmd run smoke:routes`;
- `npm.cmd run test:gotrader-autonomous-scheduler`;
- `npm.cmd run test:gotrader-shadow-context`;
- `npm.cmd run test:gotrader-runtime-a3`;
- `npm.cmd run test:gotrader-runtime-a3-1-integration`;
- `npm.cmd run test:gotrader-runtime-a3-2`;
- `npm.cmd run test:v2-context-foundation`;
- `npm.cmd run test:v2-context-compatibility`;
- `npm.cmd run test:v2-ifvg-shadow`;
- `npm.cmd run test:v2-ifvg-phase3-canary-gate`;
- `npm.cmd run test:mt5-readonly-safety`;
- focused B1 contract, repository, orchestrator, and integration tests;
- `git diff --check`.

## 10. Safety Invariants

B1 must continuously assert:

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
shadowOnly: true
canCreateEvidence: false
readinessChanged: false
productionAdoptionAllowed: false
```

The runtime task registry must continue to disable:

- execution intent;
- paper order creation;
- broker execution;
- account/order/position access;
- readiness promotion;
- evidence creation;
- profile mutation;
- calibration apply;
- unverified historical replay;
- automatic walk-forward, OOS, or Monte Carlo.

Research success cannot change these invariants.

## 11. Compatibility And Rollback

Compatibility rules:

- legacy strategies remain authoritative until a profile-specific canary gate;
- frozen IFVG metrics and identities do not change;
- current runtime profile remains available;
- B1 artifacts use new versioned paths and schemas;
- browser research state remains readable;
- no global migration switch is introduced.

Rollback:

1. stop the additive B1 runtime profile;
2. restore the A3.2 operational profile;
3. disable the B1 scheduler task;
4. retain B1 artifacts for audit or quarantine them;
5. remove B1 projections from readers;
6. leave legacy research and frozen evidence unchanged.

Rollback must not require deleting source candles, rewriting evidence, or
changing authority.

## 12. Risks And Mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Lookahead from context rebuild | Critical | Rebuild strictly as-of the triggering closed candle and assert causal timestamps. |
| Source identity drift | Critical | Hash source, windows, time contract, profile, parameters, and schemas into the job identity. |
| Duplicate jobs after restart | High | Deterministic IDs, immutable stages, leases, and checkpoint recovery. |
| Browser storage quota recurrence | High | Use bounded disk artifacts; store only compact projections in the browser. |
| Research task blocks feed | High | Separate process/queue, strict timeout, backpressure, and no deep history on candle-close tasks. |
| Phase 3 shadow output treated as production | Critical | Keep explicit shadow flags and block evidence/readiness/projection adoption. |
| Historical hydration mistaken for verified history | Critical | Preserve `historicalEligible: false` until the historical time contract passes. |
| LLM changes deterministic output | Critical | Keep LLM downstream and explanation-only. |
| Scheduler grows into a monolith | High | Keep handlers versioned, typed, and independently gated. |
| Hidden execution path | Critical | Continue forbidden-capability and authority scans in every B1 test. |

## 13. Authorization Gates

### B1 planning

Authorized now.

### B1.0 implementation

Authorize only after:

- the final A3.2 observer completes successfully;
- the integrity-hashed acceptance report is reviewed;
- the A3.2 branch is clean and frozen;
- the B1 implementation starts from that accepted commit.

### Live B1.2 canary

Authorize only after B1.0 and B1.1 pass fixture, recovery, and safety tests.

### IFVG B1.3 task

Authorize only after the separate Phase 3 canary/evidence gate permits the
adapter input contract.

### Historical B1.4 jobs

Authorize only after historical time-basis and DST verification. Current-live
proof is not sufficient.

## 14. Recommended Next Action

1. Keep A3.2 running unchanged.
2. Let the scheduled Monday maintenance-break observer complete.
3. Review and commit the final A3.2 operational acceptance report.
4. Create B1 implementation branch/worktree from that accepted commit.
5. Implement B1.0 contracts and identity only.
6. Do not enable a live B1 task in the same commit.

This sequencing gives GoTrader an autonomous research foundation without
confusing infrastructure health with strategy edge, historical evidence,
readiness, or execution authority.
