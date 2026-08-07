# GoTrader Architecture Change Control

Status: frozen architecture governance policy

Governing index:
`docs/gotrader-runtime/architecture-index.md`

## 1. Purpose

This policy prevents accepted GoTrader architecture from drifting through
silent edits, reused milestone numbers, unreviewed runtime adoption, or implied
authority changes.

It governs documentation and architecture decisions. It does not authorize
runtime implementation.

## 2. Frozen Record Rule

An accepted record is frozen by:

```text
repository/worktree
document path
source commit
Git blob ID
```

The branch name is informational. A branch pointer is not an immutable
architecture identity.

Editing a current file does not alter the accepted record. The edit becomes a
candidate revision and must pass this process before the index may reference
its new commit/blob identity.

## 3. Required Change Proposal

Every architecture proposal must identify:

1. proposal title and owner;
2. affected milestone and namespace;
3. current governing documents and frozen identities;
4. reason for change;
5. behavior added, removed, or reclassified;
6. compatibility impact;
7. data and schema migration requirements;
8. operational migration requirements;
9. rollback behavior;
10. authority impact;
11. test and acceptance evidence;
12. documents superseded, merged, deprecated, or retained;
13. whether the change is planning, implementation, or operational acceptance;
14. explicit non-goals.

No specification may silently replace another.

## 4. Status Transitions

### 4.1 Document status

```text
planning -> accepted
planning -> archived
accepted -> superseded
accepted -> deprecated
accepted -> merged
blocked -> accepted
```

Each transition requires a named replacement or acceptance record. Historical
records are retained.

### 4.2 Implementation status

```text
not_started -> partial -> complete
```

Implementation completion requires deterministic tests but does not imply
operational acceptance or production adoption.

### 4.3 Operational status

```text
not_run -> blocked
not_run -> partial_acceptance
blocked -> partial_acceptance
blocked -> accepted_with_limitations
blocked -> accepted
partial_acceptance -> accepted_with_limitations
partial_acceptance -> accepted
```

An operational result may regress to `blocked` when new evidence invalidates
the accepted conditions. The failed evidence must be preserved.

## 5. Milestone Numbering

- Existing milestone identifiers are immutable.
- A refinement uses a suffix, such as `A3.1` or `B1-L1`.
- `B1-L1` is a planning subtrack and cannot replace runtime milestone `B1.2`.
- Reserved `B2-B4` names contain no accepted design.
- Future execution has no milestone until a separate proposal is accepted.

Renumbering requires an explicit migration table in the architecture index.

## 6. Worktree And Branch Isolation

Architecture planning, runtime implementation, operational acceptance, and
baseline integration should use separate worktrees or branches.

Required controls:

- begin from a named frozen commit;
- record branch and worktree only as informational context;
- keep unrelated dirty work out of the change;
- stage exact paths or hunks;
- never merge a dirty worktree as acceptance evidence;
- preserve failed reports and checkpoints;
- update frozen identities only after commit.

Runtime acceptance must reference the exact implementation commit tested.

## 7. Compatibility Policy

GoTrader favors adapters over rewrites.

Every implementation proposal must state:

- legacy authoritative path;
- new shadow path;
- input identity parity;
- output comparison method;
- mismatch policy;
- adoption gate;
- rollback path.

Until a named adoption gate passes:

- legacy behavior remains authoritative;
- new behavior remains shadow-only;
- no new evidence or readiness authority is granted;
- production adoption remains false.

## 8. Data And Migration Policy

Changes to persisted artifacts require:

1. schema version;
2. deterministic identity rules;
3. migration or compatibility adapter;
4. bounded storage behavior;
5. rollback/read compatibility;
6. raw-data exposure review;
7. source-fingerprint preservation;
8. test fixtures for old and new records.

Raw candles must not be copied into compact research artifacts, memory packets,
UI state, advisory packets, or lineage summaries. They remain in the canonical
candle repository and are referenced by immutable identity.

## 9. Authority Review

Every change must explicitly preserve or request review of:

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

A proposal that changes any value above cannot be accepted as an ordinary
architecture revision. It requires a separate security, operational, and
authority architecture with explicit human approval.

AI, MCP, and memory integrations are advisory and read-only by default. They
cannot infer authority from access to research artifacts.

## 10. Required Review Gates

An architecture revision is accepted only when reviewers verify:

- all affected records are named;
- source commit and blob IDs are accurate;
- status axes are not conflated;
- implementation prerequisites are satisfied;
- compatibility behavior is explicit;
- migration and rollback are credible;
- authority is unchanged or separately approved;
- safety tests pass;
- operational evidence matches the tested commit;
- the architecture index and roadmap are updated together.

## 11. Runtime Adoption Gate

Architecture acceptance does not authorize runtime adoption.

Runtime adoption requires:

1. accepted specification;
2. isolated implementation;
3. deterministic test pass;
4. operational acceptance where required;
5. frozen baseline review;
6. explicit adoption decision;
7. rollback verification;
8. index update.

For B1 specifically, no implementation may begin until:

```text
A3.2 Operational Acceptance
Runtime Freeze
Baseline Review
Explicit B1 Milestone Authorization
```

## 12. Change Record Format

Each accepted revision should include:

| Field | Required value |
| --- | --- |
| Change ID | Stable milestone/revision identifier |
| Previous record | Path, commit, blob |
| New record | Path, commit, blob |
| Status transition | Document, implementation, operational |
| Compatibility | Adapter/parity behavior |
| Migration | Data/runtime steps |
| Rollback | Exact restore point and procedure |
| Authority | Before and after values |
| Evidence | Tests, report, observation |
| Decision | Accepted, blocked, superseded, archived |

## 13. Emergency Corrections

Critical safety corrections may be implemented before a full architecture
revision only to fail closed. They must:

- reduce authority or disable unsafe behavior;
- avoid unrelated changes;
- be isolated in a focused commit;
- preserve evidence of the defect;
- receive a follow-up architecture/index review.

An emergency process may never be used to grant execution, broker, readiness,
evidence, production, or calibration-apply authority.

## 14. Index Update Procedure

To update the frozen index:

1. create and review the replacement record;
2. commit it;
3. calculate its exact Git blob ID;
4. preserve the old record and status;
5. update the master index and roadmap;
6. explain dependency and gate changes;
7. validate all local references;
8. commit the index revision separately when practical.

The architecture index itself is versioned. "Frozen" means immutable by Git
identity, not that architecture can never evolve.

## 15. Current Gate

At this revision:

```text
GOTRADER ARCHITECTURE INDEX FROZEN

Accepted Architecture Indexed

A3.2 Accepted With Limitations

Runtime Frozen

Baseline Review Accepted

B1.0 Contracts And Identity Accepted

B1.1 Local Engine And Repository Accepted

B1.2 Live Canary Implemented - Operational Acceptance Pending

BT1 Dataset Foundation Complete - Historical Time Limitations Preserved

BT2 Blocked

B1.3 Not Authorized
```

Change record `B1.0-AUTHORIZATION-2026-08-03` accepts only the B1.0 contracts,
authority, validation, identity, lineage identity, and fixture scope at commit
`25b2c1acab0bbf76e9d65860995b51d12431b1d4`. Its canonical record hash is
`sha256:3e8b37fd2f574dd8929ca1815226ecc7c834a40a4bd6d865dd452ea2fe0fbf10`.

Change record `B1.1-AUTHORIZATION-2026-08-03` accepts only the local
deterministic engine and compact repository scope at commit
`92da83b7b550eac31d3114acffc4e8748d880cfe`. Its canonical record hash is
`sha256:2a752f183bf8abd3a46245f219512b62d478b161490e9eca83a6183d19acdaf8`.

Change record `B1.2-AUTHORIZATION-2026-08-03` authorizes only the isolated
current-live context-lineage canary implementation at
`820a6278fcdadf061c354c4e30c89af034d20780`. Its canonical record hash is
`sha256:f1d9e2706bf434e2cec42166037d8541862acb13ea8484399dd1ed5d2efee928`.
Operational acceptance remains pending. B1.3 is not authorized, and B1.2 grants
no strategy, production, evidence, readiness, memory, broker, execution, or
calibration authority.

## 16. Accepted BT1 Architecture Change

Change ID: `ACC-BT-B1.4`

Decision: `APPROVED`

Authorization record:

```text
path: docs/gotrader-backtest/bt1-architecture-and-concurrency-authorization.md
source commit: 02e7393d842475747ac7d1f36f44c45d1bf58902
blob: 89833057dbf88954a1595cdf2fa0b6c847d1f2b2
```

Implementation and report records:

```text
implementation commit: 3f6b3d87ff4d23b17908c5fa01fd95d7092e60aa
report commit: 9ea4a4356cb3c8c1b7e8a069c7ba8df87135106f
foundation report blob: 42ee544089a1fde39ec86c198ac2a430912bc068
```

The accepted change creates a new isolated canonical historical dataset
subsystem rather than extending incompatible legacy backtest stores. It owns
historical provider adapters, normalization, immutable partitions, integrity,
identity, manifests, checkpoints, verification, symbol/time snapshots,
derived timeframe lineage, and historical-OHLC storage.

Compatibility is additive and library-only. Existing runtime, B1, Phase 2A,
Phase 3, GBrain, Native Evidence, strategy hashes, broker paths, and production
behavior are unchanged. B1-L1 receives compact external-authoritative
references; raw candles remain in BT1 storage.

Rollback is to remove all BT1 consumers and leave sealed dataset roots
read-only. No existing subsystem depends on BT1.

Authority before and after remains `none / none / none`; all production,
evidence, readiness, calibration, and trade-intent capabilities remain false.

Acceptance is limited to the BT1 foundation and deterministic fixture evidence.
MT5 broker-historical time/DST and an actual two-year dataset remain blocked.
BT2 is not authorized.
