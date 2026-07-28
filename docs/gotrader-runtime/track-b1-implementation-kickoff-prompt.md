# GoTrader Track B1.0 - Implementation Kickoff Prompt

Status: prepared prompt; do not execute before authorization

Use this prompt only after:

1. A3.2 final operational acceptance passes;
2. Runtime Freeze is recorded;
3. Baseline Review passes;
4. an isolated B1.0 implementation worktree is created from the approved frozen
   commit;
5. B1.0 implementation is explicitly authorized.

---

Working directory:

```text
<AUTHORIZED_B1_0_WORKTREE>
```

Approved base commit:

```text
<FROZEN_BASE_COMMIT>
```

Task:
Implement GoTrader Infrastructure Track B1.0 contracts and canonical identity.

Goal:
Implement only the fixture-backed, fail-closed B1 contract and identity layer.
Do not implement a repository, job engine, scheduler, runtime profile, live
event consumer, strategy runner, evidence path, readiness path, memory
projection, MCP tool, broker path, or execution path.

Read first:

- `docs/gotrader-runtime/architecture-index.md`
- `docs/gotrader-runtime/architecture-roadmap.md`
- `docs/gotrader-runtime/architecture-change-control.md`
- `docs/gotrader-runtime/track-b1-implementation-readiness-package.md`
- `docs/gotrader-runtime/track-b1-autonomous-canonical-research-engine-plan.md`
- `docs/gotrader-runtime/track-b1-contract-fixture-spec.md`
- `docs/gotrader-runtime/track-b1-autonomous-research-pipeline-specification.md`
- `docs/gotrader-runtime/track-b1-stage-reference.md`
- `docs/gotrader-runtime/track-b1-authority-matrix.md`
- `docs/gotrader-runtime/track-b1-canonical-lineage-graph-specification.md`
- `docs/gotrader-runtime/track-b1-lineage-node-reference.md`
- `docs/gotrader-runtime/track-b1-lineage-edge-reference.md`
- `src/lib/v2/serialization/canonicalSerialization.ts`
- `scripts/test-b1-contract-fixtures.mjs`
- `tests/fixtures/v2-research-b1/*`
- `package.json`

Before editing:

1. verify the current branch and full HEAD;
2. verify the worktree is clean;
3. verify HEAD equals `<FROZEN_BASE_COMMIT>`;
4. run `npm.cmd run test:b1-contract-fixtures`;
5. stop if the fixture hashes or accepted counts differ from the frozen
   baseline.

Implement under:

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
```

Add focused tests and a package script:

```text
scripts/test-b1-contracts.mjs
test:b1-contracts
```

Required contract family:

- `CanonicalResearchJobRequest`
- `CanonicalResearchJobIdentity`
- `CanonicalResearchStageArtifact`
- `CanonicalResearchJobCheckpoint`
- `CanonicalResearchResultArtifact`
- `CanonicalResearchProjection`
- compact B1-L1 lineage node, edge, and relationship identity contracts needed
  for future B1.1 work
- explicit state, status, authority, capability, blocker, and validation result
  types

Required identity behavior:

- reuse `canonicalSerialize`, `canonicalHash`, and
  `gotrader-v2-sha256-v1` from the existing V2 serialization module;
- do not introduce another canonical serializer or hash version;
- derive logical job identity from the accepted fixture identity fields;
- derive a separate payload hash from the complete validated compact request;
- normalize set-like identity arrays exactly as the accepted specification
  requires;
- reject non-canonical or ambiguous identity inputs;
- preserve the exact accepted fixture logical job IDs and payload hashes.

Required authority:

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

Missing, unknown, extra, conflicting, or non-false capability values must block
admission. Never fill a missing permission with an inferred value.

Reject recursively:

- raw candles, candle arrays, and imported OHLCV arrays;
- raw runtime/MT5 snapshots;
- screenshots and base64 payloads;
- secrets, credentials, API keys, tokens, and passwords;
- account, balance, order, position, and trade-mutation data;
- execution requests and mutable broker commands;
- readiness overrides;
- calibration apply, approval, active-calibration mutation, and auto-apply;
- authority values other than `none`;
- `shadowOnly` values other than `true`.

Required validator result:

- deterministic;
- compact;
- sorted unique blocker codes;
- no rejected payload echo;
- no raw or secret values in errors or logs;
- safe for use before hashing or persistence.

Required tests:

1. both accepted fixture requests validate;
2. fixture logical job IDs and payload hashes remain unchanged;
3. all seven identity-drift cases produce distinct logical IDs;
4. an identical request coalesces idempotently;
5. the same logical identity with a different payload returns
   `logical_job_payload_conflict`;
6. cancellation/lease sealing cases fail closed;
7. all forbidden-field cases block with the expected category;
8. missing authority blocks;
9. unknown authority blocks;
10. extra true capabilities block;
11. non-finite numbers, dates, cycles, unsupported values, and unordered
    identity sets are rejected consistently with canonical serialization;
12. validation errors contain no raw candles, secrets, account, order, or
    position values;
13. authority remains `none / none / none`;
14. no runtime integration, scheduler registration, evidence creation,
    readiness change, production adoption, calibration apply, or trade intent
    is introduced.

Implementation constraints:

- prefer existing TypeScript and test patterns;
- add no package dependency unless separately approved;
- do not copy the serializer into B1;
- do not change accepted fixture payloads merely to make implementation easier;
- if a fixture/specification conflict appears, stop and report it through
  architecture change control;
- do not touch the accepted A3.2 runtime profile or ledgers;
- do not create browser UI;
- do not add backend endpoints;
- do not add MCP or GBrain behavior;
- do not add strategy detection;
- do not add persistent storage.

Validation:

```text
npm.cmd run build
npm.cmd run test:b1-contract-fixtures
npm.cmd run test:b1-contracts
npm.cmd run test:mt5-readonly-safety
npm.cmd run smoke:routes
git diff --check
git diff --cached --check
```

Also scan the staged diff for:

```text
/execute
Place Order
Buy Market
Sell Market
Close Position
Enable Live Trading
Connect Live Broker
account
order
position
readinessOverrideAuthority
brokerAuthority
executionAuthority
autoApply
applyCalibration
```

Expected matches are restricted to fail-closed contracts, tests, and safety
language. No actionable or permissive path is allowed.

Commit isolation:

1. stage only B1.0 contract, identity, authority, export, focused test, and
   package-script changes;
2. show `git diff --cached --stat`;
3. show `git diff --cached --name-only`;
4. verify no B1.1 or later milestone implementation is staged;
5. commit only after every required test passes.

Commit message:

```text
Add canonical research contracts and identity
```

Do not push.

Final report:

- branch and approved base commit;
- files changed;
- contracts added;
- canonical identity behavior;
- fixture hash parity;
- authority and forbidden-field behavior;
- validation results;
- safety scan result;
- commit hash;
- final git status;
- explicit statement that B1.1 remains unauthorized.

---

End of prepared kickoff prompt.
