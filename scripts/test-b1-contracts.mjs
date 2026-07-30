#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const workspace = process.cwd();
const fixtureDir = path.join(
  workspace,
  "tests",
  "fixtures",
  "v2-research-b1"
);
const outRoot = path.join(workspace, ".gotrader", "b1-contract-test");
const sourceFiles = [
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/canonicalResearch/contracts/canonicalResearchTypes.ts",
  "src/lib/canonicalResearch/authority/canonicalResearchAuthority.ts",
  "src/lib/canonicalResearch/contracts/canonicalLineageTypes.ts",
  "src/lib/canonicalResearch/contracts/canonicalResearchValidation.ts",
  "src/lib/canonicalResearch/identity/canonicalResearchIdentity.ts"
].map((file) => path.join(workspace, file));

const readJson = (fileName) =>
  JSON.parse(fs.readFileSync(path.join(fixtureDir, fileName), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
const setPath = (target, dottedPath, value) => {
  const parts = dottedPath.split(".");
  let current = target;
  for (const part of parts.slice(0, -1)) {
    current[part] ??= {};
    current = current[part];
  }
  current[parts.at(-1)] = value;
  return target;
};

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) =>
  import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const authority = await load("canonicalResearchAuthority");
const types = await load("canonicalResearchTypes");
const lineageTypes = await load("canonicalLineageTypes");
const validation = await load("canonicalResearchValidation");
const identity = await load("canonicalResearchIdentity");

const safeContext = readJson("safe-context-lineage.request.json");
const safeStrategy = readJson("safe-strategy-shadow.request.json");
const manifest = readJson("manifest.json");

const expectedIdentities = new Map([
  [
    "safe_context_lineage_request",
    {
      logicalJobId:
        "sha256:96046ef27967bb38cda06898ef00dfd7b5f0782ee5b3d0882e756db28b271d7f",
      payloadHash:
        "sha256:a3ebeccebfc491a3e1c87322137229707309c3cb3e06bacbf9bbef927a0693fe"
    }
  ],
  [
    "safe_strategy_shadow_request",
    {
      logicalJobId:
        "sha256:9b073c4dbc81f43720bd6ce548b53ebe96d8524a4ce9f025469fcf1d95b4376f",
      payloadHash:
        "sha256:34feb1ca7c67cfe84d1edd3fc1d0d3dc1c2d2b354a3a58535e2f95182c6cd799"
    }
  ]
]);

for (const fixture of [safeContext, safeStrategy]) {
  const result = validation.validateCanonicalResearchJobRequest(fixture.request);
  assert.equal(result.accepted, true, JSON.stringify(result));
  assert.deepEqual(result.blockers, []);
  assert.deepEqual(result.authority, authority.CANONICAL_RESEARCH_AUTHORITY_NONE);
  assert.deepEqual(
    result.capabilities,
    authority.CANONICAL_RESEARCH_CAPABILITIES_DISABLED
  );

  const derived = await identity.deriveCanonicalResearchJobIdentity(
    fixture.request
  );
  assert.equal(
    derived.hashVersion,
    manifest.canonicalHashVersion,
    "B1 must reuse the V2 canonical hash contract."
  );
  assert.deepEqual(derived, {
    schemaVersion: types.CANONICAL_RESEARCH_JOB_SCHEMA_VERSION,
    hashVersion: manifest.canonicalHashVersion,
    ...expectedIdentities.get(fixture.caseId),
    identityCore: identity.createCanonicalResearchIdentityCore(fixture.request)
  });
  assert.equal(
    "requestedAt" in derived.identityCore,
    false,
    "Submission time must not alter logical identity."
  );
}

const driftMatrix = readJson("identity-drift.matrix.json");
const baseStrategyIdentity = await identity.deriveCanonicalResearchJobIdentity(
  safeStrategy.request
);
for (const testCase of driftMatrix.cases) {
  const variant = setPath(
    clone(safeStrategy.request),
    testCase.path,
    testCase.value
  );
  const variantIdentity =
    await identity.deriveCanonicalResearchJobIdentity(variant);
  assert.notEqual(
    variantIdentity.logicalJobId,
    baseStrategyIdentity.logicalJobId,
    testCase.id
  );
}
assert.equal(driftMatrix.cases.length, 7);

const duplicate = await identity.compareCanonicalResearchRequests(
  safeContext.request,
  clone(safeContext.request)
);
assert.equal(duplicate.disposition, "coalesce_idempotently");

const changedSubmissionTime = {
  ...clone(safeContext.request),
  requestedAt: "2026-07-27T14:00:05.000Z"
};
const conflict = await identity.compareCanonicalResearchRequests(
  safeContext.request,
  changedSubmissionTime
);
assert.equal(conflict.disposition, "quarantine_payload_conflict");
assert.equal(conflict.blocker, "logical_job_payload_conflict");

const cancellationMatrix = readJson("cancellation-lease.matrix.json");
for (const testCase of cancellationMatrix.cases) {
  const seal = validation.validateCanonicalResearchSeal(
    testCase.checkpoint,
    testCase.sealAttemptAt
  );
  assert.equal(seal.allowed, false);
  assert.ok(seal.blockers.includes(testCase.expectedBlocker), testCase.id);
}

const forbiddenMatrix = readJson("forbidden-fields.matrix.json");
for (const testCase of forbiddenMatrix.cases) {
  const variant = setPath(
    clone(safeContext.request),
    testCase.path,
    testCase.value
  );
  const result = validation.validateCanonicalResearchJobRequest(variant);
  assert.equal(result.accepted, false, testCase.id);
  assert.ok(
    result.blockers.includes(testCase.expectedBlocker),
    `${testCase.id}: ${result.blockers.join(", ")}`
  );
  assert.equal(
    JSON.stringify(result).includes("forbidden-test-sentinel"),
    false,
    "Rejected validation results must not echo unsafe values."
  );
}

const missingAuthority = clone(safeContext.request);
delete missingAuthority.authority;
assert.ok(
  validation
    .validateCanonicalResearchJobRequest(missingAuthority)
    .blockers.includes("missing_or_invalid_authority")
);

const unknownAuthority = clone(safeContext.request);
unknownAuthority.authority.researchAuthority = "none";
assert.ok(
  validation
    .validateCanonicalResearchJobRequest(unknownAuthority)
    .blockers.includes("unknown_authority_field")
);

const nonNoneAuthorities = [
  ["executionAuthority", "paper", "execution_authority_must_be_none"],
  ["brokerAuthority", "read_only", "broker_authority_must_be_none"],
  [
    "readinessOverrideAuthority",
    "operator",
    "readiness_override_authority_must_be_none"
  ]
];
for (const [field, value, blocker] of nonNoneAuthorities) {
  const variant = clone(safeContext.request);
  variant.authority[field] = value;
  assert.ok(
    validation
      .validateCanonicalResearchJobRequest(variant)
      .blockers.includes(blocker)
  );
}

const explicitSafeCapabilities = clone(safeContext.request);
explicitSafeCapabilities.capabilities = {
  ...authority.CANONICAL_RESEARCH_CAPABILITIES_DISABLED
};
assert.equal(
  validation.validateCanonicalResearchJobRequest(explicitSafeCapabilities)
    .accepted,
  true
);

const missingCapability = clone(explicitSafeCapabilities);
delete missingCapability.capabilities.canCreateTradeIntent;
assert.ok(
  validation
    .validateCanonicalResearchJobRequest(missingCapability)
    .blockers.includes("missing_capability_field")
);

const extraTrueCapability = clone(explicitSafeCapabilities);
extraTrueCapability.capabilities.canStartScheduler = true;
const extraCapabilityResult =
  validation.validateCanonicalResearchJobRequest(extraTrueCapability);
assert.equal(extraCapabilityResult.accepted, false);
assert.ok(extraCapabilityResult.blockers.includes("unknown_capability_field"));

for (const field of Object.keys(
  authority.CANONICAL_RESEARCH_CAPABILITIES_DISABLED
)) {
  const variant = clone(explicitSafeCapabilities);
  variant.capabilities[field] = true;
  assert.ok(
    validation
      .validateCanonicalResearchJobRequest(variant)
      .blockers.includes("capability_must_be_false"),
    field
  );
}

const unorderedFacts = clone(safeContext.request);
unorderedFacts.requiredFacts = [...unorderedFacts.requiredFacts].reverse();
assert.ok(
  validation
    .validateCanonicalResearchJobRequest(unorderedFacts)
    .blockers.includes("required_facts_not_sorted_unique")
);

const duplicateTimeframes = clone(safeContext.request);
duplicateTimeframes.requiredTimeframes.push(
  duplicateTimeframes.requiredTimeframes[0]
);
assert.ok(
  validation
    .validateCanonicalResearchJobRequest(duplicateTimeframes)
    .blockers.includes("required_timeframes_not_sorted_unique")
);

const badCanonicalValues = [
  (() => {
    const value = clone(safeContext.request);
    value.invalidNumber = Number.POSITIVE_INFINITY;
    return value;
  })(),
  (() => {
    const value = clone(safeContext.request);
    value.invalidDate = new Date("2026-07-27T14:00:00.000Z");
    return value;
  })(),
  (() => {
    const value = clone(safeContext.request);
    value.invalidFunction = () => true;
    return value;
  })(),
  (() => {
    const value = clone(safeContext.request);
    value.invalidUndefined = undefined;
    return value;
  })()
];
const cyclic = clone(safeContext.request);
cyclic.cycle = cyclic;
badCanonicalValues.push(cyclic);
for (const value of badCanonicalValues) {
  const result = validation.validateCanonicalResearchJobRequest(value);
  assert.equal(result.accepted, false);
  assert.ok(result.blockers.includes("non_canonical_request_payload"));
}

const safeRejectedSerialization = JSON.stringify(
  validation.validateCanonicalResearchJobRequest({
    ...clone(safeContext.request),
    rawCandles: ["raw-value-must-not-leak"],
    credentials: "secret-value-must-not-leak",
    accountData: "account-value-must-not-leak",
    orderData: "order-value-must-not-leak",
    positionData: "position-value-must-not-leak"
  })
);
for (const forbiddenValue of [
  "raw-value-must-not-leak",
  "secret-value-must-not-leak",
  "account-value-must-not-leak",
  "order-value-must-not-leak",
  "position-value-must-not-leak"
]) {
  assert.equal(safeRejectedSerialization.includes(forbiddenValue), false);
}

const nodeCore = {
  graphSchemaVersion: lineageTypes.CANONICAL_LINEAGE_GRAPH_SCHEMA_VERSION,
  ownerNamespace: "gotrader.b1",
  nodeType: "research_request",
  canonicalArtifactId: baseStrategyIdentity.logicalJobId
};
const nodeKey = await identity.deriveCanonicalLineageNodeKey(nodeCore);
assert.match(nodeKey, /^sha256:[0-9a-f]{64}$/);
assert.equal(
  await identity.deriveCanonicalLineageNodeKey({ ...nodeCore }),
  nodeKey
);

const edgeCore = {
  graphSchemaVersion: lineageTypes.CANONICAL_LINEAGE_GRAPH_SCHEMA_VERSION,
  edgeSchemaVersion: lineageTypes.CANONICAL_LINEAGE_EDGE_SCHEMA_VERSION,
  relationshipType: "triggered",
  relationshipVersion: "1",
  relationshipCategory: "required_causal",
  parentNodeKey:
    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  childNodeKey: nodeKey,
  creationStageId: "b1-contract-test",
  ordinal: 0,
  identityMetadata: { triggerType: "verified_close" },
  integrityStatus: "verified",
  authority: authority.CANONICAL_RESEARCH_AUTHORITY_NONE,
  capabilities: authority.CANONICAL_RESEARCH_CAPABILITIES_DISABLED
};
const edgeIdentity = await identity.deriveCanonicalLineageEdgeIdentity(edgeCore);
assert.match(edgeIdentity.edgeId, /^sha256:[0-9a-f]{64}$/);
assert.match(edgeIdentity.payloadHash, /^sha256:[0-9a-f]{64}$/);
assert.deepEqual(
  await identity.deriveCanonicalLineageEdgeIdentity({ ...edgeCore }),
  edgeIdentity
);
await assert.rejects(
  () =>
    identity.deriveCanonicalLineageEdgeIdentity({
      ...edgeCore,
      childNodeKey: edgeCore.parentNodeKey
    }),
  (error) =>
    error instanceof identity.CanonicalResearchValidationError &&
    error.blockers.includes("lineage_self_edge_forbidden")
);

const runtimeRegistryCandidates = [
  "scripts/gotrader-autonomous-scheduler-core.mjs",
  "src/lib/alwaysOnRuntime/alwaysOnRuntimeProfile.ts"
];
for (const relativePath of runtimeRegistryCandidates) {
  const candidate = path.join(workspace, relativePath);
  if (!fs.existsSync(candidate)) continue;
  const text = fs.readFileSync(candidate, "utf8");
  assert.equal(text.includes("canonical_research_context_lineage"), false);
  assert.equal(text.includes("always_on_canonical_research_shadow"), false);
}

fs.rmSync(outRoot, { recursive: true, force: true });

console.log(
  JSON.stringify(
    {
      status: "passed",
      milestone: "B1.0",
      acceptedFixtures: expectedIdentities.size,
      exactFixtureIdentityParity: true,
      identityDriftCases: driftMatrix.cases.length,
      duplicateDisposition: duplicate.disposition,
      conflictDisposition: conflict.disposition,
      sealBlockers: cancellationMatrix.cases.length,
      forbiddenCases: forbiddenMatrix.cases.length,
      canonicalValueFailures: badCanonicalValues.length,
      lineageIdentityContracts: "passed",
      runtimeIntegrationAllowed: false,
      schedulerRegistrationAllowed: false,
      evidenceCreationAllowed: false,
      readinessChangeAllowed: false,
      productionAdoptionAllowed: false,
      authority: authority.CANONICAL_RESEARCH_AUTHORITY_NONE,
      capabilities: authority.CANONICAL_RESEARCH_CAPABILITIES_DISABLED
    },
    null,
    2
  )
);
