#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const fixtureDir = path.join(repoRoot, "tests", "fixtures", "v2-research-b1");

const readJson = (fileName) =>
  JSON.parse(fs.readFileSync(path.join(fixtureDir, fileName), "utf8"));

const clone = (value) => JSON.parse(JSON.stringify(value));

const canonicalize = (value) => {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
};

const canonicalSerialize = (value) => JSON.stringify(canonicalize(value));

const canonicalHash = (value, version) =>
  `sha256:${crypto
    .createHash("sha256")
    .update(`${version}\n${canonicalSerialize(value)}`, "utf8")
    .digest("hex")}`;

const identityFields = [
  "jobType",
  "jobVersion",
  "triggerEventId",
  "triggerCandleIdentity",
  "requestedSymbol",
  "brokerSymbol",
  "primaryTimeframe",
  "contextArtifactId",
  "contextIdentity",
  "strategyId",
  "profileId",
  "profileVersion",
  "parameterHash",
  "costModelId",
  "requiredFacts",
  "requiredTimeframes",
  "sourceFingerprint",
  "timeContractId",
  "schemaVersions"
];

const identityCore = (request) =>
  Object.fromEntries(
    identityFields
      .filter((field) => request[field] !== undefined)
      .map((field) => [field, request[field]])
  );

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

const assertSortedUnique = (values, label) => {
  assert.ok(Array.isArray(values), `${label} must be an array.`);
  assert.deepEqual(
    values,
    [...new Set(values)].sort(),
    `${label} must be unique and lexically sorted before identity hashing.`
  );
};

const authorityBlockers = (request) => {
  const authority = request.authority ?? {};
  return [
    authority.executionAuthority === "none"
      ? undefined
      : "execution_authority_must_be_none",
    authority.brokerAuthority === "none"
      ? undefined
      : "broker_authority_must_be_none",
    authority.readinessOverrideAuthority === "none"
      ? undefined
      : "readiness_override_authority_must_be_none"
  ].filter(Boolean);
};

const forbiddenKeyRules = [
  {
    keys: new Set([
      "rawcandles",
      "candles",
      "candlearrays",
      "importedohlcv",
      "importedohlcvarrays"
    ]),
    blocker: "forbidden_raw_market_data"
  },
  {
    keys: new Set([
      "rawruntimesnapshot",
      "rawsnapshot",
      "screenshot",
      "screenshots",
      "base64"
    ]),
    blocker: "forbidden_raw_runtime_snapshot"
  },
  {
    keys: new Set([
      "credentials",
      "apikey",
      "token",
      "password",
      "mt5credentials",
      "secret",
      "secrets"
    ]),
    blocker: "forbidden_secret_or_credential"
  },
  {
    keys: new Set(["account", "accountdata", "balance", "balancedata"]),
    blocker: "forbidden_account_data"
  },
  {
    keys: new Set(["order", "orders", "orderdata", "pendingorders"]),
    blocker: "forbidden_order_data"
  },
  {
    keys: new Set(["position", "positions", "positiondata"]),
    blocker: "forbidden_position_data"
  },
  {
    keys: new Set([
      "executionrequest",
      "executionintent",
      "placeorder",
      "buymarket",
      "sellmarket",
      "closeposition",
      "brokermutation"
    ]),
    blocker: "forbidden_execution_request"
  },
  {
    keys: new Set(["readinessoverride", "approvereadiness"]),
    blocker: "forbidden_readiness_override"
  },
  {
    keys: new Set([
      "autoapplyallowed",
      "applycalibration",
      "approvecalibrationproposal",
      "activecalibration"
    ]),
    blocker: "forbidden_auto_apply"
  }
];

const collectForbiddenBlockers = (value, blockers = new Set()) => {
  if (Array.isArray(value)) {
    for (const item of value) collectForbiddenBlockers(item, blockers);
    return blockers;
  }
  if (!value || typeof value !== "object") {
    return blockers;
  }
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    for (const rule of forbiddenKeyRules) {
      if (rule.keys.has(normalizedKey)) blockers.add(rule.blocker);
    }
    collectForbiddenBlockers(nested, blockers);
  }
  return blockers;
};

const validateRequest = (request) => {
  const blockers = new Set(authorityBlockers(request));
  if (request.shadowOnly !== true) blockers.add("shadow_only_boundary_required");
  for (const blocker of collectForbiddenBlockers(request)) blockers.add(blocker);
  return [...blockers].sort();
};

const assertSafeRequest = (fixture, manifest) => {
  assert.equal(fixture.fixtureVersion, manifest.fixtureVersion);
  assert.equal(fixture.expected.accepted, true);
  assert.equal(fixture.request.shadowOnly, true);
  assert.deepEqual(fixture.request.authority, manifest.expected.authority);
  assertSortedUnique(fixture.request.requiredFacts, `${fixture.caseId}.requiredFacts`);
  assertSortedUnique(
    fixture.request.requiredTimeframes,
    `${fixture.caseId}.requiredTimeframes`
  );
  assert.deepEqual(validateRequest(fixture.request), []);
  assert.equal(fixture.expected.canCreateEvidence, false);
  assert.equal(fixture.expected.readinessChanged, false);
  assert.equal(fixture.expected.productionAdoptionAllowed, false);

  const firstIdentity = canonicalHash(
    identityCore(fixture.request),
    manifest.canonicalHashVersion
  );
  const secondIdentity = canonicalHash(
    identityCore(clone(fixture.request)),
    manifest.canonicalHashVersion
  );
  const firstPayload = canonicalHash(
    fixture.request,
    manifest.canonicalHashVersion
  );
  const secondPayload = canonicalHash(
    clone(fixture.request),
    manifest.canonicalHashVersion
  );
  assert.equal(firstIdentity, secondIdentity, "Logical job identity must be deterministic.");
  assert.equal(firstPayload, secondPayload, "Request payload hash must be deterministic.");
  return {
    caseId: fixture.caseId,
    logicalJobId: firstIdentity,
    payloadHash: firstPayload
  };
};

const manifest = readJson("manifest.json");
assert.equal(manifest.schemaVersion, "gotrader-b1-contract-fixture-manifest-v1");
assert.equal(manifest.runtimeIntegrationAllowed, false);
assert.equal(manifest.schedulerRegistrationAllowed, false);
assert.equal(manifest.evidenceCreationAllowed, false);
assert.equal(manifest.readinessChangeAllowed, false);
assert.equal(manifest.productionAdoptionAllowed, false);

for (const fileName of manifest.files) {
  assert.ok(
    fs.existsSync(path.join(fixtureDir, fileName)),
    `Missing fixture ${fileName}.`
  );
  const fixture = readJson(fileName);
  assert.equal(
    fixture.fixtureVersion,
    manifest.fixtureVersion,
    `${fileName} fixture version must match the manifest.`
  );
}

const safeContext = readJson("safe-context-lineage.request.json");
const safeStrategy = readJson("safe-strategy-shadow.request.json");
const accepted = [
  assertSafeRequest(safeContext, manifest),
  assertSafeRequest(safeStrategy, manifest)
];
assert.equal(accepted.length, manifest.expected.acceptedRequestCount);

const driftMatrix = readJson("identity-drift.matrix.json");
const driftBase = clone(safeStrategy.request);
const driftBaseId = canonicalHash(
  identityCore(driftBase),
  manifest.canonicalHashVersion
);
for (const testCase of driftMatrix.cases) {
  const variant = setPath(clone(driftBase), testCase.path, testCase.value);
  const variantId = canonicalHash(
    identityCore(variant),
    manifest.canonicalHashVersion
  );
  assert.equal(testCase.expectedRelationship, "different_logical_job");
  assert.notEqual(
    variantId,
    driftBaseId,
    `${testCase.id} must produce a different logical job ID.`
  );
}
assert.equal(driftMatrix.cases.length, manifest.expected.identityDriftCaseCount);

const idempotencyMatrix = readJson("idempotency-conflict.matrix.json");
const idempotencyBase = clone(safeContext.request);
const idempotencyBaseId = canonicalHash(
  identityCore(idempotencyBase),
  manifest.canonicalHashVersion
);
const idempotencyBasePayload = canonicalHash(
  idempotencyBase,
  manifest.canonicalHashVersion
);
let duplicateCount = 0;
let conflictCount = 0;
for (const testCase of idempotencyMatrix.cases) {
  const variant = clone(idempotencyBase);
  for (const [key, value] of Object.entries(testCase.overrides)) {
    setPath(variant, key, value);
  }
  const variantId = canonicalHash(
    identityCore(variant),
    manifest.canonicalHashVersion
  );
  const variantPayload = canonicalHash(
    variant,
    manifest.canonicalHashVersion
  );
  if (testCase.expectedDisposition === "coalesce_idempotently") {
    duplicateCount += 1;
    assert.equal(variantId, idempotencyBaseId);
    assert.equal(variantPayload, idempotencyBasePayload);
  } else {
    conflictCount += 1;
    assert.equal(testCase.expectedDisposition, "quarantine_payload_conflict");
    assert.equal(testCase.expectedBlocker, "logical_job_payload_conflict");
    assert.equal(variantId, idempotencyBaseId);
    assert.notEqual(variantPayload, idempotencyBasePayload);
  }
}
assert.equal(duplicateCount, manifest.expected.idempotencyCaseCount);
assert.equal(conflictCount, manifest.expected.payloadConflictCaseCount);

const cancellationMatrix = readJson("cancellation-lease.matrix.json");
for (const testCase of cancellationMatrix.cases) {
  const attemptAt = Date.parse(testCase.sealAttemptAt);
  const leaseExpiresAt = Date.parse(testCase.checkpoint.leaseExpiresAt);
  const blocker =
    testCase.checkpoint.status === "cancelled"
      ? "job_cancelled_before_seal"
      : attemptAt > leaseExpiresAt
        ? "job_lease_expired_before_seal"
        : undefined;
  assert.equal(testCase.expectedSealAllowed, false);
  assert.equal(blocker, testCase.expectedBlocker);
}
assert.equal(
  cancellationMatrix.cases.length,
  manifest.expected.sealBlockerCaseCount
);

const forbiddenMatrix = readJson("forbidden-fields.matrix.json");
for (const testCase of forbiddenMatrix.cases) {
  const variant = setPath(
    clone(safeContext.request),
    testCase.path,
    testCase.value
  );
  const blockers = validateRequest(variant);
  assert.equal(testCase.expectedAccepted, false);
  assert.ok(
    blockers.includes(testCase.expectedBlocker),
    `${testCase.id} must report ${testCase.expectedBlocker}; received ${blockers.join(", ")}.`
  );
}
assert.equal(forbiddenMatrix.cases.length, manifest.expected.forbiddenCaseCount);

const runtimeRegistryCandidates = [
  path.join(repoRoot, "scripts", "gotrader-autonomous-scheduler-core.mjs"),
  path.join(
    repoRoot,
    "src",
    "lib",
    "alwaysOnRuntime",
    "alwaysOnRuntimeProfile.ts"
  )
];
for (const candidate of runtimeRegistryCandidates) {
  if (!fs.existsSync(candidate)) continue;
  const text = fs.readFileSync(candidate, "utf8");
  assert.equal(
    text.includes("canonical_research_context_lineage"),
    false,
    `${path.relative(repoRoot, candidate)} must not register B1 runtime work during planning.`
  );
  assert.equal(
    text.includes("always_on_canonical_research_shadow"),
    false,
    `${path.relative(repoRoot, candidate)} must not enable a B1 runtime profile during planning.`
  );
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      planningOnly: true,
      planningBaseline: manifest.planningBaseline,
      acceptedRequests: accepted,
      identityDriftCases: driftMatrix.cases.length,
      idempotentDuplicates: duplicateCount,
      payloadConflicts: conflictCount,
      sealBlockers: cancellationMatrix.cases.length,
      forbiddenCases: forbiddenMatrix.cases.length,
      runtimeIntegrationAllowed: manifest.runtimeIntegrationAllowed,
      schedulerRegistrationAllowed: manifest.schedulerRegistrationAllowed,
      evidenceCreationAllowed: manifest.evidenceCreationAllowed,
      readinessChangeAllowed: manifest.readinessChangeAllowed,
      productionAdoptionAllowed: manifest.productionAdoptionAllowed,
      authority: manifest.expected.authority
    },
    null,
    2
  )
);
