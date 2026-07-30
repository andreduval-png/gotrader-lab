# GoTrader Track B1 Pre-Authorization Verification Report

Status: planning verified; runtime implementation blocked

Verified on: 2026-07-29

Planning worktree:
`C:\Users\andre\OneDrive\Documents\gotrader-runtime-track-b1-plan`

Planning branch:
`codex/gotrader-infrastructure-track-b1-planning`

## 1. Decision

The B1 architecture, fixtures, authority policy, lineage contracts, readiness
package, and kickoff prompt are coherent and ready for controlled baseline
integration.

B1.0 implementation is not authorized yet. The remaining gate is:

```text
A3.2 accepted observation
  -> accepted runtime commit pinned
  -> planning artifacts integrated without runtime drift
  -> Runtime Freeze recorded
  -> baseline review passed
  -> explicit B1.0 authorization
```

This report introduces no runtime service, repository, scheduler, contract
implementation, lineage persistence, MCP behavior, GBrain behavior, strategy
execution, evidence path, readiness path, Paper Demo path, broker path, or
execution path.

## 2. Exact Baselines

| Record | Identity | Current status |
| --- | --- | --- |
| Common planning/runtime ancestor | `ad8608a6f40361a3a9a84b92c93a4da4d64e59b1` | Frozen common base |
| A3.2 runtime candidate | `481cbaaee2c7fbcd291349f54a8fe20f417d1fda` | Remediated; operational acceptance pending |
| A3.2 report blob at candidate | `d5182202bffed6d09edebf1c7c622b3e6d2b3260` | Honest blocked report |
| B1 planning HEAD | `4092410b5f575a03bc3e4c819fd5772890f2c645` | Clean and planning-ready |
| B1 fixture planning baseline | `ad8608a6f40361a3a9a84b92c93a4da4d64e59b1` | Preserved in manifest |
| Canonical hash contract | `gotrader-v2-sha256-v1` | Reused; no second serializer |

The runtime and planning branches diverge at `ad8608a`. Neither branch is an
ancestor of the other.

The B1 documents, fixture oracle, fixture files, and package test command are
intentionally absent from the A3.2 runtime candidate. This is correct branch
isolation, but it creates a required post-acceptance integration step. A blind
merge of the two branches is not approved.

## 3. Runtime Candidate Delta

The current A3.2 candidate adds these focused runtime corrections after the
common baseline:

```text
96392c3 Stabilize A3.2 market resume verification
0edbb50 Stabilize verified-time feed handoff
b217b8a Finalize MT5 closed candles before publication
61cdd8f Stabilize terminal proof correlation handoff
c664c0e Stabilize MT5 closed candle settlement
481cbaa Stabilize MT5 disconnect recovery
```

The next acceptance observation must test the exact accepted candidate. If
another safety correction is required, its replacement commit becomes the
candidate and must receive a fresh observation.

## 4. Planning Artifact Set

The planning branch adds these commits after the common baseline:

```text
33e10e3 Add B1 canonical research engine plan
d4261e6 Add B1 contract fixture specification
a9564d8 Specify B1 autonomous research pipeline
f73b219 Specify B1 canonical lineage graph
c2530b6 Add frozen GoTrader architecture index
4092410 Prepare B1 implementation readiness package
```

The first, third, fourth, fifth, and sixth commits are documentation only. The
fixture commit adds:

- one package script;
- one planning-only fixture validator;
- seven compact fixture files;
- no runtime registration;
- no scheduler task;
- no repository;
- no production capability.

## 5. Fixture Freeze

### 5.1 Expected behavior

| Check | Frozen expectation | Verified |
| --- | ---: | ---: |
| Accepted requests | 2 | 2 |
| Identity-drift cases | 7 | 7 |
| Idempotent duplicate cases | 1 | 1 |
| Payload-conflict cases | 1 | 1 |
| Seal-blocker cases | 2 | 2 |
| Forbidden-field cases | 10 | 10 |
| Runtime integration allowed | false | false |
| Scheduler registration allowed | false | false |
| Evidence creation allowed | false | false |
| Readiness change allowed | false | false |
| Production adoption allowed | false | false |

Accepted fixture identities:

| Case | Logical job ID | Payload hash |
| --- | --- | --- |
| `safe_context_lineage_request` | `sha256:96046ef27967bb38cda06898ef00dfd7b5f0782ee5b3d0882e756db28b271d7f` | `sha256:a3ebeccebfc491a3e1c87322137229707309c3cb3e06bacbf9bbef927a0693fe` |
| `safe_strategy_shadow_request` | `sha256:9b073c4dbc81f43720bd6ce548b53ebe96d8524a4ce9f025469fcf1d95b4376f` | `sha256:34feb1ca7c67cfe84d1edd3fc1d0d3dc1c2d2b354a3a58535e2f95182c6cd799` |

### 5.2 Fixture file SHA-256 values

| File | SHA-256 |
| --- | --- |
| `cancellation-lease.matrix.json` | `7d4c45f4b3a23208037e12305fb684c9580b6441c70a47ba791e829433f0d776` |
| `forbidden-fields.matrix.json` | `8f013a0c6325d76e294d0af39365db8a56ad8e6bc28cdd22c73179b6efd26b70` |
| `idempotency-conflict.matrix.json` | `a5204eb542cc58d66af5bc0663c2420377e09fc5d920d7c8af40275ffc3d9bbc` |
| `identity-drift.matrix.json` | `f4a6632575ad93eb3a28ba18dca11a99602f0af0e57d5d6282d4d6118c5f655d` |
| `manifest.json` | `990bdf37757932f8779bf2d21665048dea0548aa003605250dc43e36571885a0` |
| `safe-context-lineage.request.json` | `52287c79ff44856168501d4e0fbbb1f8fa36bf5afe7fdbcd51063eceb5fa04bd` |
| `safe-strategy-shadow.request.json` | `855dcdd81d607844140a51bd6eb75d4a2eb9bc58b14dfadb3e610f5eb8f12949` |

Any change to these values before B1.0 requires explicit fixture review. The
implementation must preserve the logical job IDs and payload hashes, not only
the file hashes.

## 6. Authority Freeze

All B1 contracts and future implementations remain bounded by:

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

Missing, unknown, additional, or conflicting authority values fail closed.
Planning access cannot be interpreted as runtime permission.

## 7. Controlled Integration After A3.2 Passes

After A3.2 is accepted:

1. record the full accepted runtime commit and report integrity hash;
2. create a clean integration branch from that accepted runtime commit;
3. apply planning commits in the recorded order with review at each boundary;
4. resolve the `package.json` fixture-script hunk additively;
5. reject any runtime, service-registry, scheduler, profile, strategy,
   evidence, readiness, Paper Demo, GBrain, MCP, broker, or execution change;
6. run the fixture and baseline suites;
7. capture the resulting integration commit and blob IDs;
8. perform the Runtime Freeze and Baseline Review;
9. create a separate B1.0 implementation worktree only after explicit
   authorization.

The integration may use reviewed cherry-picks or equivalent exact patch
application. It must not use an unreviewed branch merge.

The expected integrated delta before B1.0 is limited to:

- accepted architecture and B1 planning documents;
- B1 fixture files;
- the planning-only fixture validator;
- the `test:b1-contract-fixtures` package script.

No B1 implementation source exists at this gate. Pinning the accepted A3.2
runtime commit is not the formal Runtime Freeze. The formal freeze records the
accepted runtime identity plus the reviewed planning-artifact integration
identity, fixture hashes, validation results, and rollback boundary.

## 8. Runtime Freeze Record

The freeze record must capture:

- accepted runtime branch and full commit;
- clean-worktree proof;
- accepted A3.2 observer ID, report path, integrity hash, and report blob;
- exact runtime profile and configuration allowlist;
- service registry, startup order, commands, and port ownership;
- source, time, candle, context, proof, and event contract versions;
- canonical serializer/hash version and blob identity;
- B1 planning document and fixture blob identities;
- fixture SHA-256 values and accepted logical identities;
- accepted supervisor/feed/scheduler/verifier/hydration counters;
- zero-drift authority and forbidden-capability scan;
- complete baseline and safety validation results;
- rollback commit and rollback procedure.

Secrets and machine-specific credentials must not enter the freeze record.

## 9. Baseline Review

The review must prove:

- the A3.2 report was generated by the frozen runtime commit;
- scheduled-close and disconnect/reconnect handling match accepted evidence;
- current-live proof is not promoted into historical time authority;
- Phase 2A context identity and Phase 3 legacy IFVG behavior remain unchanged;
- the B1 fixture oracle still produces its frozen IDs and hashes;
- GBrain remains optional, derived, read-only, and non-authoritative;
- no runtime profile enables strategy, evidence, readiness, Paper Demo,
  broker, production, calibration apply, or execution capabilities;
- no raw candles are copied into B1 fixtures or compact artifacts.

Historical timestamp/DST authority remains a later B1.4 gate. Its absence does
not block B1.0 contracts or B1.1 fixture-only engine work.

## 10. Risk Register

| Risk | Control |
| --- | --- |
| Starting B1 from the planning branch instead of accepted runtime | Create implementation worktree only from the frozen runtime integration commit. |
| Blindly merging divergent branches | Apply the six planning commits through reviewed, bounded integration. |
| Dropping newer runtime package scripts | Resolve only the additive fixture-script hunk and compare complete `package.json`. |
| Fixture or identity drift | Verify file hashes, logical IDs, payload hashes, and canonical serializer version. |
| Updating the frozen index prematurely | Create a new index revision only after acceptance and integration commit identities exist. |
| Treating planning readiness as implementation authority | Require explicit B1.0 authorization after Baseline Review. |
| Capability or authority drift | Run recursive forbidden-field and authority tests before every commit. |
| Copying raw candles into research artifacts | Keep candles in the canonical repository and reference immutable identities only. |
| Expanding B1.0 into a repository or scheduler | Enforce milestone file allowlist and staged-diff review. |

## 11. Verification Results

Passed on the clean planning worktree:

- `npm.cmd run test:b1-contract-fixtures`;
- `npm.cmd run test:core`;
- `npm.cmd run test:strategy-baselines`;
- `npm.cmd run test:source-integrity`;
- `npm.cmd run test:provenance`;
- `npm.cmd run test:safety`.

No runtime service was started and no production ledger was changed.

## 12. Final Status

```text
B1 PLANNING ARTIFACTS VERIFIED

FIXTURE IDENTITIES FROZEN

RUNTIME/PLANNING DIVERGENCE DOCUMENTED

A3.2 OPERATIONAL ACCEPTANCE STILL REQUIRED

RUNTIME FREEZE NOT YET RECORDED

BASELINE REVIEW NOT YET PASSED

B1.0 IMPLEMENTATION NOT AUTHORIZED
```
