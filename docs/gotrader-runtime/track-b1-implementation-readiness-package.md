# GoTrader Track B1 - Implementation Readiness Package

Status: planning-ready; implementation not authorized

Planning branch:
`codex/gotrader-infrastructure-track-b1-planning`

Governing index:
`docs/gotrader-runtime/architecture-index.md`

## 1. Purpose

This package converts the accepted B1 architecture into an implementation
sequence that can be reviewed, authorized, tested, and rolled back one
milestone at a time.

It does not authorize B1 implementation. The current gate remains:

```text
A3.2 final operational acceptance
  -> Runtime Freeze
  -> Baseline Review
  -> explicit B1.0 authorization
```

Until every gate passes, work is limited to documentation, frozen-hash
verification, fixture validation, and diagnosis of acceptance failures.

## 2. Sources Of Truth

Implementation decisions must use the following precedence:

1. fail-closed execution and broker-safety contracts;
2. the accepted runtime and its A3.2 operational evidence;
3. the frozen architecture index and change-control policy;
4. existing V2 time, source, candle, context, and canonical hash contracts;
5. accepted B1 contracts, pipeline, stage, authority, and lineage
   specifications;
6. existing browser-facing compatibility contracts;
7. optional advisory and memory integrations.

The principal B1 documents are:

- `track-b1-autonomous-canonical-research-engine-plan.md`;
- `track-b1-contract-fixture-spec.md`;
- `track-b1-autonomous-research-pipeline-specification.md`;
- `track-b1-stage-reference.md`;
- `track-b1-authority-matrix.md`;
- `track-b1-canonical-lineage-graph-specification.md`;
- `track-b1-lineage-node-reference.md`;
- `track-b1-lineage-edge-reference.md`.

## 3. Universal Boundary

Every B1 request, stage, artifact, checkpoint, result, relationship, and
projection must contain or inherit this fail-closed boundary:

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
canCreateEvidence: false
canApproveReadiness: false
canApplyCalibration: false
canCreateTradeIntent: false
```

Missing, unknown, conflicting, or additional authority and capability fields
must block admission. No default may infer permission.

B1 artifacts, logs, projections, memory documents, and future MCP reads must
exclude:

- raw candle or OHLCV arrays;
- raw runtime or MT5 snapshots;
- screenshots or base64 payloads;
- secrets, credentials, API keys, passwords, or tokens;
- account, balance, order, position, or trade-mutation data;
- execution requests or mutable broker commands;
- readiness overrides;
- calibration apply or auto-apply instructions.

Canonical candles remain in the existing candle repository. B1 refers to them
by immutable identity and reads them only inside deterministic stage execution.

## 4. Authorization Gates

| Gate | Required proof | Current state | Failure behavior |
| --- | --- | --- | --- |
| A3.2 operational acceptance | Accepted observation spans the scheduled market break with fresh proof resume, healthy services, clean ledgers, and authority none/none/none. | pending | Preserve failed checkpoint and diagnose; do not start B1. |
| Runtime Freeze | Exact accepted commit, configuration allowlist, service registry, ports, contracts, fixture hashes, reports, and safety results are recorded. | blocked by A3.2 | No implementation worktree. |
| Baseline Review | Frozen runtime matches A3.2 evidence; Phase 2A/3 parity and GBrain advisory boundaries remain intact. | blocked by Runtime Freeze | Correct the baseline or architecture through change control. |
| B1.0 authorization | Named base commit, isolated worktree, approved scope, test plan, rollback plan, and reviewer approval. | blocked by Baseline Review | Planning only. |
| B1.1 authorization | B1.0 contracts, identity, fixture parity, and negative safety tests pass. | blocked by B1.0 | No repository or job engine. |
| B1.2 authorization | B1.1 recovery, idempotency, conflict, cancellation, stale-lease, and crash tests pass. | blocked by B1.1 | No live scheduler registration. |
| B1.3 authorization | B1.2 shadow canary accepted with clean identity and integrity deltas. | blocked by B1.2 | No strategy adapter job. |
| B1.4 authorization | B1.3 parity accepted and historical time basis/DST authority independently verified. | blocked | No historical jobs. |
| B1.5 authorization | B1.4 results accepted and compatibility projection contract reviewed. | blocked | Legacy views remain authoritative. |
| B1.6 authorization | B1.5 accepted and selected GBrain G1-G3 baseline reviewed. | blocked | No B1 memory delivery. |

Passing a gate authorizes only the next named milestone. It does not authorize
the remainder of B1.

## 5. Runtime Freeze Capture

After A3.2 passes, the Runtime Freeze record must capture:

- accepted branch and full commit hash;
- clean-worktree proof;
- integrity hash of the accepted A3.2 report;
- runtime profile names and exact configuration allowlist;
- service registry, command lines, port ownership, and startup ordering;
- environment variable names and redacted-value policy;
- source, time, candle, context, proof, and event contract versions;
- canonical hash version and serializer blob ID;
- fixture manifest and fixture file hashes;
- ledger roots and retention policy;
- accepted supervisor, feed, scheduler, hydration, and verifier counters;
- zero-drift authority and forbidden-capability scan;
- baseline build, runtime, and safety test results.

The freeze must not include secrets or machine-specific credential values.

## 6. Baseline Review Checklist

Reviewers must confirm:

- A3.2 evidence was produced by the frozen commit and configuration;
- market-close and maintenance-break behavior is deterministic;
- current-live verification is not misused as historical time authority;
- canonical M5/M15/H1/H4/D1 context remains compatible with Phase 2A;
- existing Phase 3 IFVG behavior remains legacy-authoritative;
- GBrain remains optional, derived, advisory, and unable to create evidence;
- no hidden profile enables strategy, evidence, readiness, Paper Demo, broker,
  or execution authority;
- B1 fixture identities still hash to the accepted values;
- the implementation branch starts from the reviewed frozen baseline.

## 7. Milestone Implementation Map

### 7.1 B1.0 - Contracts and identity

This is the first and only initially authorized implementation milestone.

Allowed:

- typed request, identity, stage, checkpoint, result, projection, authority,
  capability, state, and status contracts;
- runtime validators for those compact contracts;
- canonical identity derivation;
- forbidden-field and authority assertions;
- fixture-backed contract and identity tests;
- B1-L1 node, edge, and relationship identity contracts needed by later work.

Not allowed:

- a job engine;
- a repository or graph database;
- a scheduler task or runtime profile;
- live closed-candle consumption;
- strategy execution;
- evidence, readiness, or Paper Demo integration;
- UI, MCP, OpenClaw, GBrain, broker, or execution integration.

Proposed ownership:

```text
src/lib/canonicalResearch/
  contracts/
    canonicalResearchTypes.ts
    canonicalResearchValidation.ts
    canonicalLineageTypes.ts
  identity/
    canonicalResearchIdentity.ts
  authority/
    canonicalResearchAuthority.ts
  index.ts

scripts/
  test-b1-contracts.mjs
```

The implementation must reuse
`src/lib/v2/serialization/canonicalSerialization.ts` and
`gotrader-v2-sha256-v1`. It must not introduce a second canonical serializer or
hash version. The existing planning fixture validator must either consume the
shared implementation through a supported test adapter or prove byte-for-byte
and hash-for-hash parity with it.

Exit criteria:

- all safe fixture requests validate;
- accepted logical job IDs and payload hashes remain unchanged;
- every identity-drift fixture produces a different logical job ID;
- idempotent duplicates coalesce;
- equal logical identity with a different payload is quarantined;
- all cancellation, lease, sealing, authority, and forbidden-field negative
  fixtures fail closed;
- no runtime integration or persistent repository exists;
- build and safety suites pass.

Rollback:

- revert the single B1.0 implementation commit;
- retain the accepted planning fixtures and documents;
- no runtime state or migration cleanup is needed.

### 7.2 B1.1 - Local deterministic engine and repository

Allowed only after B1.0 acceptance:

- a local deterministic stage registry and runner;
- immutable append-first compact artifacts and relationships;
- atomic writes, payload-hash verification, idempotency, and conflict
  quarantine;
- lease, cancellation, timeout, retry, recovery, and retention behavior;
- fixture-only context-lineage execution.

Proposed ownership:

```text
src/lib/canonicalResearch/
  engine/
  repository/
  stages/
```

The initial repository should follow the accepted bounded filesystem and
atomic-write patterns. A database or graph database requires a separate
architecture change.

Exit criteria:

- restart and crash recovery preserve identity;
- duplicate requests do not duplicate artifacts;
- payload conflicts quarantine;
- stale leases cannot commit;
- cancellation is checked immediately before every write/seal boundary;
- partial artifacts cannot become complete;
- raw candles are never persisted;
- no scheduler or live source is connected.

Rollback:

- stop the local test runner;
- revert the B1.1 commit;
- quarantine, rather than reinterpret, any test artifacts;
- leave the canonical candle repository and legacy research state unchanged.

### 7.3 B1.2 - Live shadow context-lineage canary

Allowed only after B1.1 acceptance:

- consume verified closed-candle events from the accepted A2/A3.2 boundary;
- rebuild canonical context from the existing candle repository;
- compare context identity with the accepted A3.2 artifact;
- persist compact shadow lineage and mismatch diagnostics;
- expose health and audit counters for the isolated shadow profile.

Not allowed:

- strategy execution;
- evidence, readiness, production, Paper Demo, or memory delivery;
- page-load or timer-driven deep history;
- mutation of the accepted runtime ledgers.

Exit criteria include a separately prescribed live observation with zero
identity conflicts, duplicate artifacts, ledger gaps, authority drift, and raw
data leakage.

Rollback disables only the isolated B1.2 profile. The accepted A3.2 runtime
continues unchanged.

### 7.4 B1.3 - IFVG v3 shadow adapter

Allowed only after B1.2 acceptance:

- one allowlisted IFVG v3 profile;
- deterministic strategy interpretation over verified canonical context;
- compact candidate/rejection artifacts;
- parity comparison with frozen legacy behavior.

Legacy remains authoritative. Results cannot create evidence, readiness, Paper
Demo status, calibration changes, trade intent, or production adoption.

### 7.5 B1.4 - Explicit historical jobs

This milestone remains blocked until historical timestamp basis and DST
authority are independently verified.

When authorized, replay, walk-forward, OOS, and Monte Carlo jobs must be:

- explicit manual or bounded background jobs;
- resumable and identity-pinned;
- separated from live-close and page-load paths;
- cost-model and profile-version specific;
- unable to reinterpret current-live time proof as historical authority.

### 7.6 B1.5 - Compatibility projections

Project compact accepted B1 results through adapters into existing UI and
research domains. Do not rewrite those domains or migrate browser storage in
place. Legacy fallback remains available per profile until parity acceptance.

### 7.7 B1.6 - Memory projection

Only accepted compact native deterministic artifacts may be projected into
GBrain. GBrain remains an optional derived index:

- unavailable GBrain degrades memory/advisory only;
- GBrain output cannot enter deterministic detector scoring;
- GBrain cannot create evidence, readiness, calibration, trade intent, or
  authority;
- MCP access remains bounded and read-only.

## 8. Test Matrix

| Milestone | Required focused tests |
| --- | --- |
| B1.0 | Existing `test:b1-contract-fixtures`; typed validation; canonical hash parity; identity drift; forbidden fields; authority/capability fail-closed; serialization leakage scan. |
| B1.1 | Repository atomicity; append-only behavior; idempotency; payload conflict; stale lease; cancellation race; timeout/retry; crash recovery; retention; raw-data exclusion. |
| B1.2 | Verified event admission; context rebuild parity; duplicate event handling; restart continuity; ledger integrity; operational observation; profile isolation. |
| B1.3 | IFVG fixture parity; current-window parity; rejection parity; no active-setup inflation; source/time/profile identity; no promotion. |
| B1.4 | Historical timestamp/DST fixtures; replay determinism; walk-forward partitioning; OOS freeze; Monte Carlo reproducibility; cancellation/resume. |
| B1.5 | Projection compatibility; unavailable-B1 fallback; no UI authority drift; no browser raw-data persistence. |
| B1.6 | Sanitization; delivery idempotency; offline degradation; bounded MCP reads; no deterministic feedback; no native-evidence mutation. |

Every milestone also runs the build, relevant V2/runtime regression tests, MT5
read-only safety tests, forbidden-control scan, `git diff --check`, and staged
diff check before commit.

## 9. Compatibility And Migration

- Existing runtime, strategies, validation, evidence, readiness, UI, and memory
  domains remain authoritative until their specific adapters pass acceptance.
- B1 reads existing immutable identities; it does not rewrite legacy IDs.
- Contract version changes require explicit adapters and golden fixtures.
- No one-shot browser-storage or artifact migration is permitted.
- No new package dependency is justified for B1.0.
- A later persistence technology change requires its own specification,
  migration proof, and rollback plan.

## 10. Commit And Branch Discipline

After authorization:

1. create a new isolated B1.0 implementation worktree from the frozen baseline;
2. record the exact base commit in the implementation report;
3. implement one milestone only;
4. keep fixtures and safety tests in the same commit as their contract;
5. avoid mixed runtime, UI, memory, MCP, strategy, or execution changes;
6. show staged file names and staged diff checks before commit;
7. do not merge or push into the accepted runtime baseline until review.

Recommended commit boundaries:

```text
B1.0  Add canonical research contracts and identity
B1.1  Add local canonical research repository
B1.2  Add canonical context-lineage shadow canary
B1.3  Add IFVG v3 canonical shadow adapter
B1.4  Add explicit historical research jobs
B1.5  Add canonical research compatibility projections
B1.6  Add derived canonical research memory projection
```

These are labels, not advance authorization.

## 11. Open Decisions

The following must be resolved at the named gate, not guessed during coding:

- exact frozen base commit after A3.2 acceptance;
- exact B1.0 schema/version constants approved by review;
- whether the Node fixture validator imports built shared contracts or compares
  against an independent oracle;
- B1.1 filesystem layout, quotas, and retention bounds;
- B1.2 runtime profile name and acceptance duration;
- historical server-time/DST authority for B1.4;
- selected accepted GBrain baseline for B1.6.

None of these decisions may weaken the universal authority boundary.

## 12. Current Readiness Decision

The planning materials and fixture oracle are coherent. The fixture suite
currently passes with:

- two accepted shadow requests;
- seven identity-drift cases;
- one idempotent duplicate;
- one payload conflict;
- two sealing blockers;
- ten forbidden-field cases;
- runtime, scheduler, evidence, readiness, and production integration disabled;
- authority `none / none / none`.

The architecture is ready for baseline review preparation, but B1
implementation remains blocked.

```text
B1 PLANNING READY

A3.2 ACCEPTANCE REQUIRED

RUNTIME FREEZE REQUIRED

BASELINE REVIEW REQUIRED

B1.0 IMPLEMENTATION NOT YET AUTHORIZED
```
