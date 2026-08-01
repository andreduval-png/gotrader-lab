import crypto from "node:crypto";

export const RUNTIME_FREEZE_MANIFEST_VERSION =
  "gotrader-runtime-freeze-preparation-manifest-v1";

export const RUNTIME_FREEZE_REQUIRED_B1_COMMITS = Object.freeze([
  Object.freeze({
    shortHash: "b583b31",
    subject: "Add canonical research contracts and identity"
  }),
  Object.freeze({
    shortHash: "c096163",
    subject: "Add local canonical research engine"
  }),
  Object.freeze({
    shortHash: "e9ee07f",
    subject: "Prepare B1 shadow context canary"
  }),
  Object.freeze({
    shortHash: "d642887",
    subject: "Prepare B1 shadow canary operations"
  })
]);

export const RUNTIME_FREEZE_REQUIRED_RUNTIME_FILES = Object.freeze([
  "scripts/gotrader-runtime-core.mjs",
  "scripts/gotrader-runtime-io.mjs",
  "scripts/gotrader-runtime-supervisor.mjs",
  "scripts/gotrader-current-live-time-verification-core.mjs",
  "scripts/gotrader-current-live-time-verifier.mjs",
  "scripts/gotrader-continuous-feed-core.mjs",
  "scripts/gotrader-continuous-feed.mjs",
  "scripts/gotrader-autonomous-scheduler-core.mjs",
  "scripts/gotrader-autonomous-scheduler.mjs",
  "scripts/gotrader-shadow-context-core.mjs",
  "scripts/gotrader-historical-context-hydrator-core.mjs",
  "scripts/gotrader-a3-acceptance-core.mjs",
  "scripts/gotrader-observe-a3-acceptance.mjs",
  "scripts/mt5-readonly-upstream.py",
  "scripts/start-mt5-readonly-bridge.mjs",
  "docs/gotrader-runtime/track-a3-2-operational-report.md"
]);

export const RUNTIME_FREEZE_REQUIRED_PREPARATION_FILES = Object.freeze([
  "docs/gotrader-runtime/architecture-index.md",
  "docs/gotrader-runtime/architecture-roadmap.md",
  "docs/gotrader-runtime/architecture-change-control.md",
  "docs/gotrader-runtime/track-b1-implementation-readiness-package.md",
  "docs/gotrader-runtime/track-b1-authority-matrix.md",
  "docs/gotrader-runtime/track-b1-autonomous-research-pipeline-specification.md",
  "docs/gotrader-runtime/track-b1-canonical-lineage-graph-specification.md",
  "docs/gotrader-runtime/track-b1-contract-fixture-spec.md"
]);

export const RUNTIME_FREEZE_AUTHORITY_NONE = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

const expectedRuntimeProfile = Object.freeze({
  profileId: "always_on_shadow_context_operational",
  profileVersion: "track-a3-2-market-aware-hydrated-shadow-context-v1",
  serviceIds: Object.freeze([
    "mt5_terminal",
    "mt5_readonly_upstream",
    "mt5_readonly_bridge",
    "current_live_time_verifier",
    "market_data_feed",
    "autonomous_cycle_scheduler"
  ])
});

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])])
  );
};

export const runtimeFreezeCanonicalHash = (value) =>
  `sha256:${crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")}`;

export const runtimeFreezeContentHash = (value) =>
  `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;

const authorityIsNone = (value) =>
  value?.executionAuthority === "none" &&
  value?.brokerAuthority === "none" &&
  value?.readinessOverrideAuthority === "none";

const unique = (values) => [...new Set(values.filter(Boolean))];

export function classifyA3OperationalReport(text) {
  const content = String(text ?? "");
  const explicitlyBlocked = /TRACK A3\.2 BLOCKED|OPERATIONAL ACCEPTANCE INCOMPLETE/i.test(
    content
  );
  const acceptedStatus = /`?operationally_accepted`?/i.test(content);
  const acceptedHeading = /TRACK A3\.2 (?:OPERATIONALLY )?ACCEPTED|A3\.2 OPERATIONAL ACCEPTANCE PASSED/i.test(
    content
  );
  return explicitlyBlocked
    ? "incomplete"
    : acceptedStatus && acceptedHeading
      ? "accepted"
      : /observation_incomplete/i.test(content)
        ? "incomplete"
        : "unknown";
}

export function summarizeA3ObserverEvidence(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Object.freeze({
      present: false,
      integrityValid: false,
      status: "missing",
      acceptanceChecksAllPassed: false,
      safetyBoundaryValid: false
    });
  }
  const { integrityHash, ...core } = payload;
  const acceptanceChecks = core.acceptanceChecks;
  const acceptanceChecksAllPassed =
    Boolean(acceptanceChecks) &&
    Object.keys(acceptanceChecks).length > 0 &&
    Object.values(acceptanceChecks).every((value) => value === true);
  const safetyBoundaryValid =
    authorityIsNone(core) &&
    core.rawCandlesPersisted === false &&
    core.rawContextFactsPersisted === false &&
    core.productionAdoptionAllowed === false;
  return Object.freeze({
    present: true,
    integrityValid:
      typeof integrityHash === "string" &&
      integrityHash === runtimeFreezeCanonicalHash(core),
    status: String(core.status ?? "unknown"),
    observationId: core.observationId,
    startedAt: core.startedAt,
    elapsedSeconds: Number(core.elapsedSeconds ?? 0),
    verifiedM5CloseCount: Number(core.verifiedM5CloseCount ?? 0),
    completedContextCycleCount: Number(core.completedContextCycleCount ?? 0),
    acceptanceChecksAllPassed,
    safetyBoundaryValid,
    authority: RUNTIME_FREEZE_AUTHORITY_NONE
  });
}

const hashRecordIsValid = (record) =>
  typeof record?.path === "string" &&
  /^sha256:[a-f0-9]{64}$/.test(record?.contentHash ?? "");

const profileBlockers = (profile) => {
  const blockers = [];
  if (profile?.profileId !== expectedRuntimeProfile.profileId) {
    blockers.push("runtime_profile_id_mismatch");
  }
  if (profile?.profileVersion !== expectedRuntimeProfile.profileVersion) {
    blockers.push("runtime_profile_version_mismatch");
  }
  if (profile?.validation?.valid !== true) {
    blockers.push("runtime_profile_validation_failed");
  }
  if (!authorityIsNone(profile?.authority)) blockers.push("runtime_authority_drift");
  if (
    profile?.strategySchedulerEnabled !== false ||
    profile?.paperDemoEnabled !== false ||
    profile?.executionEnabled !== false ||
    profile?.aiSupervisorEnabled !== false ||
    profile?.productionAdoptionAllowed !== false
  ) {
    blockers.push("runtime_capability_boundary_invalid");
  }
  const serviceIds = (profile?.services ?? []).map((service) => service.serviceId);
  for (const serviceId of expectedRuntimeProfile.serviceIds) {
    if (!serviceIds.includes(serviceId)) blockers.push(`runtime_service_missing:${serviceId}`);
  }
  for (const service of profile?.services ?? []) {
    if (!authorityIsNone(service.authority)) {
      blockers.push(`runtime_service_authority_drift:${service.serviceId ?? "unknown"}`);
    }
  }
  return blockers;
};

const b1CompatibilityBlockers = (preparation) => {
  const blockers = [];
  const commits = preparation?.requiredCommits ?? [];
  for (const required of RUNTIME_FREEZE_REQUIRED_B1_COMMITS) {
    const found = commits.find((commit) => commit.shortHash === required.shortHash);
    if (!found?.present || !found?.ancestorOfHead) {
      blockers.push(`b1_required_commit_missing:${required.shortHash}`);
    }
    if (found?.subject !== required.subject) {
      blockers.push(`b1_required_commit_subject_mismatch:${required.shortHash}`);
    }
  }
  if (preparation?.requiredCommitOrderValid !== true) {
    blockers.push("b1_required_commit_order_invalid");
  }
  return blockers;
};

export function buildRuntimeFreezePreparationManifest(input) {
  const runtime = input?.runtime ?? {};
  const preparation = input?.preparation ?? {};
  const report = runtime.operationalReport ?? {};
  const evidence = runtime.observerEvidence ?? summarizeA3ObserverEvidence();
  const blockers = [];

  if (runtime.clean !== true) blockers.push("runtime_repository_not_clean");
  if (preparation.clean !== true) blockers.push("preparation_repository_not_clean");
  if (!/^[a-f0-9]{40}$/.test(runtime.headCommit ?? "")) {
    blockers.push("runtime_head_commit_invalid");
  }
  if (
    input?.expectedRuntimeHead &&
    runtime.headCommit !== input.expectedRuntimeHead
  ) {
    blockers.push("runtime_head_commit_mismatch");
  }
  blockers.push(...profileBlockers(runtime.profile));

  const fileHashes = runtime.fileHashes ?? [];
  for (const requiredPath of RUNTIME_FREEZE_REQUIRED_RUNTIME_FILES) {
    const record = fileHashes.find((item) => item.path === requiredPath);
    if (!hashRecordIsValid(record)) blockers.push(`runtime_file_hash_missing:${requiredPath}`);
  }
  if (!hashRecordIsValid(report)) blockers.push("a3_2_operational_report_hash_missing");
  if (report.status !== "accepted") blockers.push("a3_2_operational_report_not_accepted");
  if (!evidence.present) blockers.push("a3_2_observer_evidence_missing");
  else {
    if (!evidence.integrityValid) blockers.push("a3_2_observer_evidence_integrity_invalid");
    if (evidence.status !== "operationally_accepted") {
      blockers.push("a3_2_observer_evidence_not_accepted");
    }
    if (!evidence.acceptanceChecksAllPassed) {
      blockers.push("a3_2_observer_acceptance_checks_incomplete");
    }
    if (!evidence.safetyBoundaryValid) {
      blockers.push("a3_2_observer_safety_boundary_invalid");
    }
  }
  blockers.push(...b1CompatibilityBlockers(preparation));
  const preparationFileHashes = preparation.fileHashes ?? [];
  for (const requiredPath of RUNTIME_FREEZE_REQUIRED_PREPARATION_FILES) {
    const record = preparationFileHashes.find((item) => item.path === requiredPath);
    if (!hashRecordIsValid(record)) {
      blockers.push(`preparation_file_hash_missing:${requiredPath}`);
    }
  }

  const compactBlockers = unique(blockers);
  const onlyAcceptancePending = compactBlockers.every((blocker) =>
    blocker.startsWith("a3_2_operational_report_not_accepted") ||
    blocker.startsWith("a3_2_observer_evidence_not_accepted") ||
    blocker.startsWith("a3_2_observer_acceptance_checks_incomplete")
  );
  const status = compactBlockers.length === 0
    ? "ready_for_baseline_review"
    : onlyAcceptancePending
      ? "blocked_pending_a3_2_acceptance"
      : "blocked_baseline_mismatch";

  const core = {
    manifestVersion: RUNTIME_FREEZE_MANIFEST_VERSION,
    generatedAt: input?.generatedAt,
    status,
    runtimeFrozen: false,
    baselineAccepted: false,
    nextAction: status === "ready_for_baseline_review"
      ? "Conduct the explicit baseline review; this manifest does not freeze or accept the runtime."
      : status === "blocked_pending_a3_2_acceptance"
        ? "Complete the corrected A3.2 operational observation, commit the accepted report, then rerun this read-only review."
        : "Resolve the reported baseline mismatch without modifying accepted runtime evidence.",
    blockers: compactBlockers,
    runtime: {
      repositoryRoot: runtime.repositoryRoot,
      branch: runtime.branch,
      headCommit: runtime.headCommit,
      clean: runtime.clean === true,
      profile: runtime.profile,
      fileHashes,
      operationalReport: report,
      observerEvidence: evidence
    },
    preparation: {
      repositoryRoot: preparation.repositoryRoot,
      branch: preparation.branch,
      headCommit: preparation.headCommit,
      clean: preparation.clean === true,
      requiredCommits: preparation.requiredCommits ?? [],
      requiredCommitOrderValid: preparation.requiredCommitOrderValid === true,
      fileHashes: preparationFileHashes
    },
    authority: RUNTIME_FREEZE_AUTHORITY_NONE,
    capabilities: {
      writesTargetRepository: false,
      startsRuntimeServices: false,
      stopsRuntimeServices: false,
      mutatesRuntimeLedgers: false,
      enablesStrategy: false,
      createsEvidence: false,
      changesReadiness: false,
      enablesPaperDemo: false,
      enablesBroker: false,
      enablesExecution: false
    }
  };
  return Object.freeze({
    ...core,
    manifestHash: runtimeFreezeCanonicalHash(core)
  });
}

export const RUNTIME_FREEZE_PREPARATION_BOUNDARY = Object.freeze({
  preparationOnly: true,
  canDeclareRuntimeFrozen: false,
  canAcceptBaseline: false,
  targetRepositoryReadOnly: true,
  formalA3AcceptanceRequired: true,
  authority: RUNTIME_FREEZE_AUTHORITY_NONE
});
