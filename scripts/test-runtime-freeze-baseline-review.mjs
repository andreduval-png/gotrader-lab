#!/usr/bin/env node

import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import {
  RUNTIME_FREEZE_AUTHORITY_NONE,
  RUNTIME_FREEZE_PREPARATION_BOUNDARY,
  RUNTIME_FREEZE_REQUIRED_B1_COMMITS,
  RUNTIME_FREEZE_REQUIRED_PREPARATION_FILES,
  RUNTIME_FREEZE_REQUIRED_RUNTIME_FILES,
  a3AcceptedWithLimitationsEvidenceIsValid,
  buildRuntimeFreezePreparationManifest,
  classifyA3OperationalReport,
  runtimeFreezeCanonicalHash,
  summarizeA3ObserverEvidence,
  summarizeA3OperatorDecision
} from "./support/gotrader-runtime-freeze-manifest.mjs";

const authority = RUNTIME_FREEZE_AUTHORITY_NONE;
const hash = (value = "a") => `sha256:${value.repeat(64).slice(0, 64)}`;
const runtimeHead = "1".repeat(40);

const acceptedEvidencePayload = () => {
  const core = {
    version: 1,
    observationId: "a3_2_acceptance_accepted_fixture",
    status: "operationally_accepted",
    startedAt: "2026-08-03T18:45:00.000Z",
    elapsedSeconds: 14_401,
    verifiedM5CloseCount: 32,
    completedContextCycleCount: 32,
    acceptanceChecks: {
      observationDurationPassed: true,
      marketHourSpanPassed: true,
      verifiedM5CloseCountPassed: true,
      completedContextCycleCountPassed: true,
      marketBreakHandledSafely: true,
      freshProofResumedAfterMarketBreak: true,
      noVerificationFailures: true,
      noObserverTransportFailures: true,
      noManagedRestarts: true,
      hydrationStayedReady: true,
      authorityStayedNone: true
    },
    rawCandlesPersisted: false,
    rawContextFactsPersisted: false,
    productionAdoptionAllowed: false,
    ...authority
  };
  return { ...core, integrityHash: runtimeFreezeCanonicalHash(core) };
};

const acceptedReport = `
# GoTrader Infrastructure Track A3.2 Operational Report

TRACK A3.2 ACCEPTED

Final observer status: \`operationally_accepted\`.
`;

const limitedReport = `
# GoTrader Infrastructure Track A3.2 Operational Report

TRACK A3.2 ACCEPTED WITH LIMITATIONS

The preserved observer status remains \`observation_incomplete\`.

blocked -> accepted_with_limitations
`;

const limitedEvidencePayload = () => {
  const payload = acceptedEvidencePayload();
  payload.status = "observation_incomplete";
  payload.marketHourSpan = 3.917;
  payload.activeMarketSamples = 2010;
  payload.freshActiveMarketProofSamples = 2010;
  payload.proofUptimePercentage = 100;
  payload.marketClosedPauseSamples = 716;
  payload.unsafeMarketClosedSamples = 1;
  payload.freshProofAfterMarketClose = true;
  payload.verificationFailureCount = 0;
  payload.transportFailures = 0;
  payload.observerTransportWarnings = 0;
  payload.hydrationNotReadySamples = 0;
  payload.managedRestartDelta = 0;
  payload.duplicateCloseCount = 0;
  payload.duplicateContextCount = 0;
  payload.payloadConflictCount = 0;
  payload.ledgerGapCount = 0;
  payload.blockedInsufficientContextCount = 0;
  payload.authorityViolationSamples = 0;
  payload.historicalVerificationViolationSamples = 0;
  payload.maximumQueueDepth = 0;
  payload.blockers = [];
  payload.acceptanceChecks.marketBreakHandledSafely = false;
  const { integrityHash: ignoredIntegrity, ...core } = payload;
  return { ...core, integrityHash: runtimeFreezeCanonicalHash(core) };
};

const limitedDecisionPayload = (evidence) => {
  const core = {
    version: "gotrader-a3-2-operator-acceptance-decision-v1",
    changeId: "A3.2-ACCEPTANCE-2026-08-03",
    decision: "accepted_with_limitations",
    statusTransition: { from: "blocked", to: "accepted_with_limitations" },
    runtimeObservedCommit: "0".repeat(40),
    acceptedRuntimeCandidateCommit: runtimeHead,
    observerEvidence: {
      observationId: evidence.observationId,
      integrityHash: evidence.integrityHash,
      status: evidence.status,
      onlyFailedAcceptanceCheck: "marketBreakHandledSafely",
      unsafeMarketClosedSamples: 1
    },
    acceptanceBasis: {
      elapsedSeconds: evidence.elapsedSeconds,
      verifiedM5CloseCount: evidence.verifiedM5CloseCount,
      completedContextCycleCount: evidence.completedContextCycleCount,
      proofUptimePercentage: evidence.proofUptimePercentage,
      marketClosedPauseSamples: evidence.marketClosedPauseSamples,
      verificationFailureCount: 0,
      transportFailures: 0,
      hydrationNotReadySamples: 0,
      managedRestartDelta: 0,
      duplicateCloseCount: 0,
      duplicateContextCount: 0,
      payloadConflictCount: 0,
      ledgerGapCount: 0,
      finalBlockers: []
    },
    limitations: ["one bounded observer transition sample"],
    operationalGate: {
      runtimeFreezeAuthorized: true,
      baselineReviewAuthorized: true,
      b1RuntimeAuthorized: false,
      productionAdoptionAllowed: false
    },
    authority,
    capabilities: {
      canCreateEvidence: false,
      canApproveReadiness: false,
      canApplyCalibration: false,
      canCreateTradeIntent: false,
      paperDemoEnabled: false,
      brokerEnabled: false,
      executionEnabled: false
    }
  };
  return { ...core, integrityHash: runtimeFreezeCanonicalHash(core) };
};

const baseInput = () => ({
  generatedAt: "2026-08-03T23:00:00.000Z",
  expectedRuntimeHead: runtimeHead,
  runtime: {
    repositoryRoot: "C:/runtime",
    branch: "codex/gotrader-infrastructure-track-a3-2",
    headCommit: runtimeHead,
    clean: true,
    profile: {
      profileId: "always_on_shadow_context_operational",
      profileVersion: "track-a3-2-market-aware-hydrated-shadow-context-v1",
      strategySchedulerEnabled: false,
      paperDemoEnabled: false,
      executionEnabled: false,
      aiSupervisorEnabled: false,
      productionAdoptionAllowed: false,
      services: [
        "mt5_terminal",
        "mt5_readonly_upstream",
        "mt5_readonly_bridge",
        "current_live_time_verifier",
        "market_data_feed",
        "autonomous_cycle_scheduler"
      ].map((serviceId) => ({ serviceId, authority })),
      validation: { valid: true, errors: [] },
      authority
    },
    fileHashes: RUNTIME_FREEZE_REQUIRED_RUNTIME_FILES.map((path) => ({
      path,
      contentHash: hash("a"),
      byteLength: 10
    })),
    operationalReport: {
      path: "docs/gotrader-runtime/track-a3-2-operational-report.md",
      contentHash: hash("b"),
      byteLength: acceptedReport.length,
      status: classifyA3OperationalReport(acceptedReport)
    },
    observerEvidence: summarizeA3ObserverEvidence(acceptedEvidencePayload())
  },
  preparation: {
    repositoryRoot: "C:/preparation",
    branch: "codex/gotrader-runtime-freeze-harness-prep",
    headCommit: "2".repeat(40),
    clean: true,
    requiredCommits: RUNTIME_FREEZE_REQUIRED_B1_COMMITS.map((commit) => ({
      ...commit,
      fullHash: `${commit.shortHash}${"0".repeat(40 - commit.shortHash.length)}`,
      present: true,
      ancestorOfHead: true
    })),
    requiredCommitOrderValid: true,
    fileHashes: RUNTIME_FREEZE_REQUIRED_PREPARATION_FILES.map((path) => ({
      path,
      contentHash: hash("c"),
      byteLength: 10
    }))
  }
});

assert.equal(classifyA3OperationalReport(acceptedReport), "accepted");
assert.equal(
  classifyA3OperationalReport(limitedReport),
  "accepted_with_limitations"
);
assert.equal(
  classifyA3OperationalReport("TRACK A3.2 BLOCKED - OPERATIONAL ACCEPTANCE INCOMPLETE"),
  "incomplete"
);

const acceptedEvidence = summarizeA3ObserverEvidence(acceptedEvidencePayload());
assert.equal(acceptedEvidence.integrityValid, true);
assert.equal(acceptedEvidence.acceptanceChecksAllPassed, true);
assert.equal(acceptedEvidence.safetyBoundaryValid, true);

const ready = buildRuntimeFreezePreparationManifest(baseInput());
assert.equal(ready.status, "ready_for_baseline_review");
assert.equal(ready.runtimeFrozen, false);
assert.equal(ready.baselineAccepted, false);
assert.deepEqual(ready.authority, authority);
assert.equal(ready.capabilities.writesTargetRepository, false);
assert.equal(ready.capabilities.startsRuntimeServices, false);
assert.equal(ready.capabilities.enablesExecution, false);
assert.match(ready.manifestHash, /^sha256:[a-f0-9]{64}$/);

const limitedEvidencePayloadValue = limitedEvidencePayload();
const limitedEvidence = summarizeA3ObserverEvidence(limitedEvidencePayloadValue);
assert.equal(a3AcceptedWithLimitationsEvidenceIsValid(limitedEvidence), true);
const limitedDecision = {
  ...summarizeA3OperatorDecision(
    limitedDecisionPayload(limitedEvidencePayloadValue)
  ),
  acceptedRuntimeCandidateAncestorOfHead: true
};
assert.equal(limitedDecision.integrityValid, true);
assert.equal(limitedDecision.boundaryValid, true);
const limitedInput = baseInput();
limitedInput.runtime.operationalReport = {
  ...limitedInput.runtime.operationalReport,
  byteLength: limitedReport.length,
  status: classifyA3OperationalReport(limitedReport)
};
limitedInput.runtime.observerEvidence = limitedEvidence;
limitedInput.runtime.operatorDecision = limitedDecision;
const readyWithLimitations = buildRuntimeFreezePreparationManifest(limitedInput);
assert.equal(readyWithLimitations.status, "ready_for_baseline_review");
assert.equal(
  readyWithLimitations.runtime.acceptanceMode,
  "accepted_with_limitations"
);

const incomplete = baseInput();
incomplete.runtime.operationalReport.status = "incomplete";
const incompletePayload = acceptedEvidencePayload();
incompletePayload.status = "observation_incomplete";
incompletePayload.acceptanceChecks.marketBreakHandledSafely = false;
const { integrityHash: ignoredIntegrity, ...incompleteCore } = incompletePayload;
incompletePayload.integrityHash = runtimeFreezeCanonicalHash(incompleteCore);
incomplete.runtime.observerEvidence = summarizeA3ObserverEvidence(incompletePayload);
const pending = buildRuntimeFreezePreparationManifest(incomplete);
assert.equal(pending.status, "blocked_pending_a3_2_acceptance");
assert.ok(pending.blockers.includes("a3_2_operational_report_not_accepted"));
assert.ok(pending.blockers.includes("a3_2_observer_evidence_not_accepted"));
assert.ok(pending.blockers.includes("a3_2_observer_acceptance_checks_incomplete"));

const dirty = baseInput();
dirty.runtime.clean = false;
assert.equal(
  buildRuntimeFreezePreparationManifest(dirty).status,
  "blocked_baseline_mismatch"
);

const wrongHead = baseInput();
wrongHead.runtime.headCommit = "3".repeat(40);
assert.ok(
  buildRuntimeFreezePreparationManifest(wrongHead).blockers.includes(
    "runtime_head_commit_mismatch"
  )
);

const authorityDrift = baseInput();
authorityDrift.runtime.profile.authority = { ...authority, brokerAuthority: "read_write" };
assert.ok(
  buildRuntimeFreezePreparationManifest(authorityDrift).blockers.includes(
    "runtime_authority_drift"
  )
);

const missingCommit = baseInput();
missingCommit.preparation.requiredCommits[2].ancestorOfHead = false;
assert.ok(
  buildRuntimeFreezePreparationManifest(missingCommit).blockers.includes(
    "b1_required_commit_missing:e9ee07f"
  )
);

const missingHash = baseInput();
missingHash.runtime.fileHashes = missingHash.runtime.fileHashes.slice(1);
assert.ok(
  buildRuntimeFreezePreparationManifest(missingHash).blockers.some((blocker) =>
    blocker.startsWith("runtime_file_hash_missing:")
  )
);

const missingSpecification = baseInput();
missingSpecification.preparation.fileHashes =
  missingSpecification.preparation.fileHashes.slice(1);
assert.ok(
  buildRuntimeFreezePreparationManifest(missingSpecification).blockers.some((blocker) =>
    blocker.startsWith("preparation_file_hash_missing:")
  )
);

const tamperedEvidence = acceptedEvidencePayload();
tamperedEvidence.verifiedM5CloseCount = 999;
assert.equal(summarizeA3ObserverEvidence(tamperedEvidence).integrityValid, false);

const unsafeEvidence = acceptedEvidencePayload();
unsafeEvidence.executionAuthority = "trade";
const { integrityHash: unsafeIgnored, ...unsafeCore } = unsafeEvidence;
unsafeEvidence.integrityHash = runtimeFreezeCanonicalHash(unsafeCore);
assert.equal(summarizeA3ObserverEvidence(unsafeEvidence).safetyBoundaryValid, false);

const excessiveTransitionInput = structuredClone(limitedInput);
const excessiveTransitionPayload = limitedEvidencePayload();
excessiveTransitionPayload.unsafeMarketClosedSamples = 2;
const { integrityHash: transitionIntegrity, ...transitionCore } =
  excessiveTransitionPayload;
excessiveTransitionPayload.integrityHash = runtimeFreezeCanonicalHash(transitionCore);
excessiveTransitionInput.runtime.observerEvidence = summarizeA3ObserverEvidence(
  excessiveTransitionPayload
);
assert.equal(
  buildRuntimeFreezePreparationManifest(excessiveTransitionInput).status,
  "blocked_baseline_mismatch"
);

const tamperedDecisionInput = structuredClone(limitedInput);
tamperedDecisionInput.runtime.operatorDecision.integrityValid = false;
assert.ok(
  buildRuntimeFreezePreparationManifest(tamperedDecisionInput).blockers.includes(
    "a3_2_operator_decision_integrity_invalid"
  )
);

const unrelatedRuntimeInput = structuredClone(limitedInput);
unrelatedRuntimeInput.runtime.operatorDecision.acceptedRuntimeCandidateAncestorOfHead =
  false;
assert.ok(
  buildRuntimeFreezePreparationManifest(unrelatedRuntimeInput).blockers.includes(
    "a3_2_operator_decision_runtime_lineage_invalid"
  )
);

assert.deepEqual(RUNTIME_FREEZE_PREPARATION_BOUNDARY.authority, authority);
assert.equal(RUNTIME_FREEZE_PREPARATION_BOUNDARY.canDeclareRuntimeFrozen, false);
assert.equal(RUNTIME_FREEZE_PREPARATION_BOUNDARY.canAcceptBaseline, false);

const helperSource = await fs.readFile(
  "scripts/support/gotrader-runtime-freeze-manifest.mjs",
  "utf8"
);
const collectorSource = await fs.readFile(
  "scripts/prepare-runtime-freeze-baseline-review.mjs",
  "utf8"
);
assert.doesNotMatch(helperSource + collectorSource, /writeFile|appendFile|mkdir|rm\(|unlink|rename\(/);
assert.doesNotMatch(helperSource + collectorSource, /spawn\(|gotrader:runtime:start|gotrader:runtime:stop/);
assert.doesNotMatch(helperSource + collectorSource, /placeOrder|buyMarket|sellMarket|enableLiveTrading/);

console.log("Runtime Freeze and Baseline Review preparation harness tests passed.");
console.log(`- ready fixture: ${ready.status}`);
console.log(`- accepted-with-limitations fixture: ${readyWithLimitations.status}`);
console.log(`- current incomplete evidence behavior: ${pending.status}`);
console.log("- target repository access is read-only; no service or ledger mutation exists");
console.log("- runtimeFrozen=false; baselineAccepted=false; authority none/none/none");
