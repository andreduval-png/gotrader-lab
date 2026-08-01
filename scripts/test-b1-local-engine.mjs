#!/usr/bin/env node

import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { createCanonicalResearchNodeStorage } from "./support/canonical-research-node-storage.mjs";

const workspace = process.cwd();
const fixtureDir = path.join(workspace, "tests", "fixtures", "v2-research-b1");
const outRoot = path.join(workspace, ".gotrader", "b1-local-engine-modules");
const testRoot = path.join(workspace, ".gotrader", "b1-local-engine-test");
const sourceFiles = [
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/canonicalResearch/contracts/canonicalResearchTypes.ts",
  "src/lib/canonicalResearch/authority/canonicalResearchAuthority.ts",
  "src/lib/canonicalResearch/contracts/canonicalLineageTypes.ts",
  "src/lib/canonicalResearch/contracts/canonicalResearchValidation.ts",
  "src/lib/canonicalResearch/identity/canonicalResearchIdentity.ts",
  "src/lib/canonicalResearch/identity/canonicalResearchArtifactIdentity.ts",
  "src/lib/canonicalResearch/repository/canonicalResearchRepositoryTypes.ts",
  "src/lib/canonicalResearch/repository/canonicalResearchFileRepository.ts",
  "src/lib/canonicalResearch/engine/canonicalResearchEngine.ts"
].map((file) => path.join(workspace, file));

const readJson = (fileName) =>
  JSON.parse(fs.readFile(path.join(fixtureDir, fileName), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
const fileKey = (identity) => identity.replace(":", "_");

const createClock = (initial = "2026-07-31T14:00:00.000Z") => {
  let current = Date.parse(initial);
  return {
    now() {
      current += 100;
      return new Date(current).toISOString();
    },
    advance(milliseconds) {
      current += milliseconds;
    }
  };
};

const makeContextRequest = (base, marker, overrides = {}) => {
  const markerOffset = Number.parseInt(marker, 16);
  const requestedAt = new Date(
    Date.parse("2026-07-31T14:00:00.000Z") + markerOffset * 60_000
  ).toISOString();
  return {
    ...clone(base),
    requestedAt,
    triggerEventId: `mt5-candle-closed:USTECH:5m:${requestedAt}`,
    triggerCandleIdentity: `sha256:${marker[0].repeat(64)}`,
    contextArtifactId: `v2-context:${marker.at(-1).repeat(64)}`,
    contextIdentity: `sha256:${marker.at(-1).repeat(64)}`,
    ...overrides
  };
};

const walkFiles = async (root) => {
  const output = [];
  const visit = async (directory) => {
    let entries = [];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else output.push(target);
    }
  };
  await visit(root);
  return output;
};

await fs.rm(testRoot, { recursive: true, force: true });
compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) =>
  import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const authority = await load("canonicalResearchAuthority");
const repositoryModule = await load("canonicalResearchFileRepository");
const engineModule = await load("canonicalResearchEngine");

const safeContextFixture = JSON.parse(
  await fs.readFile(
    path.join(fixtureDir, "safe-context-lineage.request.json"),
    "utf8"
  )
);
const safeStrategyFixture = JSON.parse(
  await fs.readFile(
    path.join(fixtureDir, "safe-strategy-shadow.request.json"),
    "utf8"
  )
);

const primaryClock = createClock();
const primaryStorage = createCanonicalResearchNodeStorage({
  root: path.join(testRoot, "primary")
});
const primaryRepository = new repositoryModule.CanonicalResearchFileRepository({
  storage: primaryStorage.adapter,
  profileId: "b1_1_fixture_test",
  now: () => primaryClock.now()
});
const primaryEngine = new engineModule.CanonicalResearchEngine({
  repository: primaryRepository,
  leaseOwner: "b1-worker-primary",
  now: () => primaryClock.now()
});

const first = await primaryEngine.run(safeContextFixture.request);
assert.equal(first.status, "completed");
assert.equal(first.resumed, false);
assert.equal(first.admissionDisposition, "created");
assert.equal(first.result.classification, "context_lineage_verified");
assert.equal(first.checkpoint.completedStageArtifactIds.length, 7);
assert.deepEqual(first.result.authority, authority.CANONICAL_RESEARCH_AUTHORITY_NONE);
assert.deepEqual(
  first.result.capabilities,
  authority.CANONICAL_RESEARCH_CAPABILITIES_DISABLED
);
assert.equal((await primaryRepository.loadLineageNodes()).length, 3);
assert.equal((await primaryRepository.loadRelationships()).length, 2);
assert.equal(
  (await primaryRepository.loadProjection(first.identity.logicalJobId)).status,
  "completed"
);

const primaryStageDirectory = `stages/${fileKey(first.identity.logicalJobId)}`;
const firstStageFiles = await primaryStorage.adapter.listFiles(primaryStageDirectory);
assert.equal(firstStageFiles.length, 7);

const duplicate = await primaryEngine.run(clone(safeContextFixture.request));
assert.equal(duplicate.status, "completed");
assert.equal(duplicate.admissionDisposition, "coalesced");
assert.equal(duplicate.result.resultArtifactId, first.result.resultArtifactId);
assert.equal(
  (await primaryStorage.adapter.listFiles(primaryStageDirectory)).length,
  7,
  "Exact duplicate must not duplicate stages."
);
assert.equal((await primaryRepository.loadLineageNodes()).length, 3);
assert.equal((await primaryRepository.loadRelationships()).length, 2);

const changedSubmissionTime = {
  ...clone(safeContextFixture.request),
  requestedAt: "2026-07-31T14:00:05.000Z"
};
const conflict = await primaryEngine.run(changedSubmissionTime);
assert.equal(conflict.status, "blocked");
assert.equal(conflict.admissionDisposition, "quarantined_conflict");
assert.deepEqual(conflict.blockers, ["logical_job_payload_conflict"]);
assert.equal(
  (await primaryRepository.loadResult(first.identity.logicalJobId)).resultArtifactId,
  first.result.resultArtifactId,
  "Conflicting request must not replace the completed result."
);
assert.equal(
  (await primaryRepository.loadCheckpoint(first.identity.logicalJobId)).status,
  "completed",
  "Conflicting request must not overwrite the canonical checkpoint."
);
assert.equal((await primaryRepository.listQuarantineRecords()).length, 1);

const strategyResult = await primaryEngine.run(safeStrategyFixture.request);
assert.equal(strategyResult.status, "blocked");
assert.deepEqual(strategyResult.blockers, ["job_type_not_enabled_b1_1"]);
assert.equal(
  await primaryRepository.loadResult(strategyResult.identity.logicalJobId),
  undefined
);

const mismatchRequest = makeContextRequest(safeContextFixture.request, "22", {
  contextIdentity: `sha256:${"3".repeat(64)}`
});
const mismatch = await primaryEngine.run(mismatchRequest);
assert.equal(mismatch.status, "blocked");
assert.deepEqual(mismatch.blockers, ["context_identity_mismatch"]);
assert.equal(
  await primaryRepository.loadResult(mismatch.identity.logicalJobId),
  undefined
);

const cancellationClock = createClock("2026-07-31T15:00:00.000Z");
const cancellationStorage = createCanonicalResearchNodeStorage({
  root: path.join(testRoot, "cancellation")
});
const cancellationRepository = new repositoryModule.CanonicalResearchFileRepository({
  storage: cancellationStorage.adapter,
  profileId: "b1_1_cancellation_test",
  now: () => cancellationClock.now()
});
let cancelOnce = true;
const cancellationEngine = new engineModule.CanonicalResearchEngine({
  repository: cancellationRepository,
  leaseOwner: "b1-worker-cancel",
  now: () => cancellationClock.now(),
  afterStage: async (artifact, engine) => {
    if (cancelOnce && artifact.stageName === "input_verification") {
      cancelOnce = false;
      await engine.cancelJob(artifact.logicalJobId);
    }
  }
});
const cancellation = await cancellationEngine.run(
  makeContextRequest(safeContextFixture.request, "44")
);
assert.equal(cancellation.status, "cancelled");
assert.equal(
  await cancellationRepository.loadResult(cancellation.identity.logicalJobId),
  undefined
);

const recoveryClock = createClock("2026-07-31T16:00:00.000Z");
const recoveryStorage = createCanonicalResearchNodeStorage({
  root: path.join(testRoot, "recovery")
});
const recoveryRepository = new repositoryModule.CanonicalResearchFileRepository({
  storage: recoveryStorage.adapter,
  profileId: "b1_1_recovery_test",
  now: () => recoveryClock.now()
});
let crashOnce = true;
const crashingEngine = new engineModule.CanonicalResearchEngine({
  repository: recoveryRepository,
  leaseOwner: "b1-worker-before-crash",
  leaseDurationMs: 2_000,
  now: () => recoveryClock.now(),
  afterStage: (artifact) => {
    if (crashOnce && artifact.stageName === "context_rebuild") {
      crashOnce = false;
      throw new Error("Injected process interruption after immutable stage write.");
    }
  }
});
const recoveryRequest = makeContextRequest(safeContextFixture.request, "55");
await assert.rejects(
  () => crashingEngine.run(recoveryRequest),
  /Injected process interruption/
);
const blockedByLiveLeaseEngine = new engineModule.CanonicalResearchEngine({
  repository: recoveryRepository,
  leaseOwner: "b1-worker-after-crash",
  leaseDurationMs: 2_000,
  now: () => recoveryClock.now()
});
const liveLeaseBlock = await blockedByLiveLeaseEngine.run(recoveryRequest);
assert.equal(liveLeaseBlock.status, "blocked");
assert.deepEqual(liveLeaseBlock.blockers, ["job_lease_held_by_other_worker"]);
recoveryClock.advance(5_000);
const recovered = await blockedByLiveLeaseEngine.run(recoveryRequest);
assert.equal(recovered.status, "completed");
assert.equal(recovered.resumed, true);
assert.equal(recovered.checkpoint.retryCount, 1);
assert.equal(
  (await recoveryRepository.loadStages(recovered.identity.logicalJobId)).length,
  7,
  "Recovery must not rerun completed deterministic stages."
);

await recoveryRepository.removeCheckpointForRecoveryTest(
  recovered.identity.logicalJobId
);
await recoveryRepository.removeProjectionForRecoveryTest(
  recovered.identity.logicalJobId
);
const rebuilt = await blockedByLiveLeaseEngine.rebuildCheckpoint(
  recovered.identity.logicalJobId
);
assert.equal(rebuilt.status, "completed");
assert.equal(rebuilt.completedStageArtifactIds.length, 7);
assert.equal(
  (await recoveryRepository.loadProjection(recovered.identity.logicalJobId)).status,
  "completed"
);

const staleClock = createClock("2026-07-31T17:00:00.000Z");
const staleStorage = createCanonicalResearchNodeStorage({
  root: path.join(testRoot, "stale-lease")
});
const staleRepository = new repositoryModule.CanonicalResearchFileRepository({
  storage: staleStorage.adapter,
  profileId: "b1_1_stale_lease_test",
  now: () => staleClock.now()
});
let expireBeforeSeal = true;
const staleEngine = new engineModule.CanonicalResearchEngine({
  repository: staleRepository,
  leaseOwner: "b1-worker-stale",
  leaseDurationMs: 2_000,
  now: () => staleClock.now(),
  afterStage: (artifact) => {
    if (expireBeforeSeal && artifact.stageName === "result_validation") {
      expireBeforeSeal = false;
      staleClock.advance(10_000);
    }
  }
});
const stale = await staleEngine.run(
  makeContextRequest(safeContextFixture.request, "66")
);
assert.equal(stale.status, "expired");
assert.ok(stale.blockers.includes("job_lease_expired_before_seal"));
assert.equal(
  await staleRepository.loadResult(stale.identity.logicalJobId),
  undefined,
  "An expired lease must never seal a result."
);
const resumedAfterFreshLease = await staleEngine.run(
  makeContextRequest(safeContextFixture.request, "66")
);
assert.equal(resumedAfterFreshLease.status, "completed");
assert.equal(resumedAfterFreshLease.resumed, true);
assert.equal(resumedAfterFreshLease.checkpoint.completedStageArtifactIds.length, 7);
assert.equal(
  (await staleRepository.loadStages(stale.identity.logicalJobId)).length,
  8,
  "The expired seal attempt remains immutable audit history while a fresh lease reseals."
);

const transientClock = createClock("2026-07-31T18:00:00.000Z");
const transientStorage = createCanonicalResearchNodeStorage({
  root: path.join(testRoot, "transient")
});
const transientRepository = new repositoryModule.CanonicalResearchFileRepository({
  storage: transientStorage.adapter,
  profileId: "b1_1_transient_test",
  now: () => transientClock.now(),
  atomicWriteRetries: 1
});
transientStorage.failNextWrites(1);
const transientAdmission = await transientRepository.admitRequest(
  makeContextRequest(safeContextFixture.request, "77")
);
assert.equal(transientAdmission.accepted, true);

const capacityStorage = createCanonicalResearchNodeStorage({
  root: path.join(testRoot, "capacity")
});
const capacityRepository = new repositoryModule.CanonicalResearchFileRepository({
  storage: capacityStorage.adapter,
  profileId: "b1_1_capacity_test",
  maxLogicalJobs: 1
});
assert.equal(
  (await capacityRepository.admitRequest(
    makeContextRequest(safeContextFixture.request, "88")
  )).accepted,
  true
);
const capacityBlock = await capacityRepository.admitRequest(
  makeContextRequest(safeContextFixture.request, "99")
);
assert.equal(capacityBlock.accepted, false);
assert.deepEqual(capacityBlock.blockers, ["repository_job_limit_reached"]);

const smallStorage = createCanonicalResearchNodeStorage({
  root: path.join(testRoot, "size-bound")
});
const smallRepository = new repositoryModule.CanonicalResearchFileRepository({
  storage: smallStorage.adapter,
  profileId: "b1_1_size_test",
  maxArtifactBytes: 512
});
await assert.rejects(
  () =>
    smallRepository.admitRequest(
      makeContextRequest(safeContextFixture.request, "aa")
    ),
  (error) =>
    error instanceof repositoryModule.CanonicalResearchRepositoryError &&
    error.blockers.includes("repository_artifact_too_large")
);

await assert.rejects(
  () => primaryStorage.adapter.writeTextAtomic("../escape.json", "{}"),
  /path is invalid|escaped its root/
);

const tamperClock = createClock("2026-07-31T19:00:00.000Z");
const tamperStorage = createCanonicalResearchNodeStorage({
  root: path.join(testRoot, "tamper")
});
const tamperRepository = new repositoryModule.CanonicalResearchFileRepository({
  storage: tamperStorage.adapter,
  profileId: "b1_1_tamper_test",
  now: () => tamperClock.now()
});
const tamperEngine = new engineModule.CanonicalResearchEngine({
  repository: tamperRepository,
  leaseOwner: "b1-worker-tamper",
  now: () => tamperClock.now()
});
const tamperRun = await tamperEngine.run(
  makeContextRequest(safeContextFixture.request, "bb")
);
const tamperDirectory = `stages/${fileKey(tamperRun.identity.logicalJobId)}`;
const [tamperFile] = await tamperStorage.adapter.listFiles(tamperDirectory);
const tamperRelativePath = `${tamperDirectory}/${tamperFile}`;
const tamperEnvelope = JSON.parse(
  await tamperStorage.adapter.readText(tamperRelativePath)
);
tamperEnvelope.payload.outputSummary = { tampered: true };
await fs.writeFile(
  tamperStorage.resolveSafe(tamperRelativePath),
  JSON.stringify(tamperEnvelope),
  "utf8"
);
await assert.rejects(
  () => tamperRepository.loadStages(tamperRun.identity.logicalJobId),
  (error) =>
    error instanceof repositoryModule.CanonicalResearchRepositoryError &&
    error.blockers.includes("repository_artifact_integrity_mismatch")
);
assert.ok((await tamperRepository.listQuarantineRecords()).length >= 1);

await assert.rejects(
  () =>
    primaryRepository.admitRequest({
      ...clone(safeContextFixture.request),
      rawCandles: ["must-never-persist"],
      credentials: "must-never-persist-secret"
    }),
  (error) =>
    error instanceof Error &&
    !error.message.includes("must-never-persist")
);

const persistedFiles = await walkFiles(testRoot);
const persistedText = (
  await Promise.all(persistedFiles.map((file) => fs.readFile(file, "utf8")))
).join("\n");
for (const forbiddenValue of [
  "must-never-persist",
  "must-never-persist-secret",
  "rawCandles",
  "accountData",
  "orderData",
  "positionData"
]) {
  assert.equal(persistedText.includes(forbiddenValue), false, forbiddenValue);
}

for (const relativePath of [
  "scripts/gotrader-autonomous-scheduler-core.mjs",
  "src/lib/alwaysOnRuntime/alwaysOnRuntimeProfile.ts"
]) {
  const source = await fs.readFile(path.join(workspace, relativePath), "utf8");
  assert.equal(source.includes("canonical_research_context_lineage"), false);
  assert.equal(source.includes("always_on_canonical_research_shadow"), false);
}

assert.deepEqual(
  engineModule.CANONICAL_RESEARCH_B1_1_BOUNDARY.authority,
  authority.CANONICAL_RESEARCH_AUTHORITY_NONE
);
assert.equal(
  engineModule.CANONICAL_RESEARCH_B1_1_BOUNDARY.runtimeIntegrationAllowed,
  false
);
assert.equal(
  engineModule.CANONICAL_RESEARCH_B1_1_BOUNDARY.schedulerRegistrationAllowed,
  false
);
assert.equal(
  engineModule.CANONICAL_RESEARCH_B1_1_BOUNDARY.strategyExecutionAllowed,
  false
);

await fs.rm(outRoot, { recursive: true, force: true });
await fs.rm(testRoot, { recursive: true, force: true });

console.log(
  JSON.stringify(
    {
      status: "passed",
      milestone: "B1.1",
      fixtureOnly: true,
      completedStageCount: firstStageFiles.length,
      duplicateCoalesced: true,
      conflictQuarantined: true,
      compactLineagePersisted: true,
      cancellationBlockedSeal: true,
      foreignLeaseBlocked: true,
      staleLeaseBlockedSeal: true,
      crashRecoveryResumed: true,
      checkpointRebuilt: true,
      projectionRebuilt: true,
      transientAtomicWriteRetried: true,
      tamperQuarantined: true,
      pathTraversalBlocked: true,
      sizeAndJobBoundsEnforced: true,
      rawDataPersisted: false,
      runtimeIntegrationAllowed: false,
      schedulerRegistrationAllowed: false,
      liveEventConsumptionAllowed: false,
      strategyExecutionAllowed: false,
      evidenceCreationAllowed: false,
      readinessChangeAllowed: false,
      productionAdoptionAllowed: false,
      authority: authority.CANONICAL_RESEARCH_AUTHORITY_NONE
    },
    null,
    2
  )
);
