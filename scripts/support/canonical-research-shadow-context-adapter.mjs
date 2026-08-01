export const CANONICAL_RESEARCH_SHADOW_CONTEXT_ADAPTER_VERSION =
  "gotrader-b1-shadow-context-adapter-preparation-v1";

export const CANONICAL_RESEARCH_AUTHORITY_NONE = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

export const CANONICAL_RESEARCH_CAPABILITIES_DISABLED = Object.freeze({
  productionAdoptionAllowed: false,
  canCreateEvidence: false,
  canApproveReadiness: false,
  canApplyCalibration: false,
  canCreateTradeIntent: false
});

const hashPattern = /^sha256:[0-9a-f]{64}$/;
const contextArtifactPattern = /^v2-context:[0-9a-f]{64}$/;
const requiredTriggerTimeframe = "5m";
const requiredRequestedSymbol = "MNQ";
const requiredBrokerSymbol = "USTECH";

const sortedUnique = (values) =>
  Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right)));

const expectedIdentityFor = (contextArtifactId) =>
  contextArtifactId.replace(/^v2-context:/, "sha256:");

const sameStringSet = (left, right) => {
  const normalizedLeft = sortedUnique(left);
  const normalizedRight = sortedUnique(right);
  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index]);
};

const acceptedContextBoundaryIsSafe = (context) =>
  context.status === "completed" &&
  context.shadowOnly === true &&
  context.rawCandlesPersisted === false &&
  context.rawFactsPersisted === false &&
  context.canCreateEvidence === false &&
  context.evidenceCreated === false &&
  context.readinessChanged === false &&
  context.productionAdoptionAllowed === false &&
  context.executionAuthority === "none" &&
  context.brokerAuthority === "none" &&
  context.readinessOverrideAuthority === "none";

const compactOutcome = (input) =>
  Object.freeze({
    adapterVersion: CANONICAL_RESEARCH_SHADOW_CONTEXT_ADAPTER_VERSION,
    ...input,
    blockers: Object.freeze([...input.blockers]),
    warnings: Object.freeze([...input.warnings]),
    shadowOnly: true,
    rawCandlesPersisted: false,
    rawFactsPersisted: false,
    authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
    capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
  });

export class CanonicalResearchShadowContextAdapter {
  #engine;
  #mode;
  #contextBuilder;
  #canonicalHash;
  #jobSchemaVersion;
  #counters = {
    received: 0,
    disabled: 0,
    blocked: 0,
    completed: 0,
    coalesced: 0,
    identityMismatches: 0
  };

  constructor({
    engine,
    mode = "disabled",
    contextBuilder,
    canonicalHash,
    jobSchemaVersion
  }) {
    if (typeof contextBuilder !== "function" || typeof canonicalHash !== "function") {
      throw new Error("The B1.2 preparation adapter requires injected deterministic dependencies.");
    }
    this.#engine = engine;
    this.#mode = mode;
    this.#contextBuilder = contextBuilder;
    this.#canonicalHash = canonicalHash;
    this.#jobSchemaVersion = jobSchemaVersion;
  }

  status() {
    return Object.freeze({
      adapterVersion: CANONICAL_RESEARCH_SHADOW_CONTEXT_ADAPTER_VERSION,
      mode: this.#mode,
      runtimeRegistered: false,
      schedulerRegistered: false,
      liveConsumptionEnabled: false,
      counters: Object.freeze({ ...this.#counters }),
      authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
      capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
    });
  }

  async run(input) {
    this.#counters.received += 1;
    if (this.#mode !== "recorded_artifact_test") {
      this.#counters.disabled += 1;
      return compactOutcome({
        status: "disabled",
        mode: this.#mode,
        blockers: ["b1_2_shadow_adapter_not_activated"],
        warnings: [],
        nextAction: "Wait for formal A3.2 acceptance before authorizing an isolated live canary.",
        resumed: false
      });
    }

    const blockers = this.#validateBoundary(input);
    if (blockers.length) return this.#blocked(blockers);

    const rebuiltContext = await this.#contextBuilder(input.contextRequest);
    if (rebuiltContext.diagnostics.status === "blocked") {
      return this.#blocked([
        "canonical_context_rebuild_blocked",
        ...rebuiltContext.diagnostics.blockers.map((blocker) => `context:${blocker}`)
      ]);
    }

    const expectedIdentity = expectedIdentityFor(input.acceptedContext.contextArtifactId);
    const rebuiltWindowHashes = rebuiltContext.identity.inputWindows.map(
      (window) => window.identityHash
    );
    const mismatchBlockers = [];
    if (
      rebuiltContext.contextArtifactId !== input.acceptedContext.contextArtifactId ||
      rebuiltContext.identity.identityHash !== expectedIdentity
    ) {
      mismatchBlockers.push("accepted_context_identity_mismatch");
    }
    if (
      !sameStringSet(
        rebuiltWindowHashes,
        input.acceptedContext.inputWindowIdentityHashes
      )
    ) {
      mismatchBlockers.push("accepted_context_window_identity_mismatch");
    }
    if (
      rebuiltContext.contextSchemaVersion !== input.acceptedContext.contextSchemaVersion
    ) {
      mismatchBlockers.push("accepted_context_schema_version_mismatch");
    }
    if (mismatchBlockers.length) {
      this.#counters.identityMismatches += 1;
      return this.#blocked(mismatchBlockers, rebuiltContext.contextArtifactId);
    }

    const requiredFacts = sortedUnique(
      input.contextRequest.requestedFactFamilies?.length
        ? input.contextRequest.requestedFactFamilies
        : ["context_identity"]
    );
    const request = Object.freeze({
      jobType: "context_lineage",
      jobVersion: CANONICAL_RESEARCH_SHADOW_CONTEXT_ADAPTER_VERSION,
      requestedAt: input.event.receivedAt,
      triggerEventId: input.event.eventId,
      triggerCandleIdentity: await this.#canonicalReferenceHash(
        "gotrader.a3.verified-close",
        input.event.candleIdentity
      ),
      requestedSymbol: input.event.requestedSymbol,
      brokerSymbol: input.event.brokerSymbol,
      primaryTimeframe: input.event.timeframe,
      contextArtifactId: rebuiltContext.contextArtifactId,
      contextIdentity: rebuiltContext.identity.identityHash,
      requiredFacts,
      requiredTimeframes: sortedUnique(input.contextRequest.requiredTimeframes),
      sourceFingerprint: await this.#canonicalReferenceHash(
        "gotrader.a3.source-fingerprint",
        input.event.sourceFingerprint
      ),
      timeContractId: await this.#canonicalReferenceHash(
        "gotrader.a3.time-verification-artifact",
        input.event.timeVerificationArtifactId
      ),
      schemaVersions: Object.freeze({
        candle: "gotrader-v2-canonical-candle-v1",
        context: rebuiltContext.contextSchemaVersion,
        job: this.#jobSchemaVersion
      }),
      shadowOnly: true,
      authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
      capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
    });
    const engineResult = await this.#engine.run(request);
    if (engineResult.status !== "completed" || !engineResult.result) {
      return this.#blocked(
        engineResult.blockers.length
          ? engineResult.blockers
          : ["canonical_research_context_lineage_not_completed"],
        rebuiltContext.contextArtifactId
      );
    }

    this.#counters.completed += 1;
    if (engineResult.admissionDisposition === "coalesced") {
      this.#counters.coalesced += 1;
    }
    return compactOutcome({
      status: "completed",
      mode: this.#mode,
      blockers: [],
      warnings: [
        "recorded_artifact_test_only",
        "live_runtime_registration_requires_formal_a3_2_acceptance"
      ],
      nextAction: "Retain compact parity evidence; do not register the live canary yet.",
      contextArtifactId: rebuiltContext.contextArtifactId,
      contextIdentity: rebuiltContext.identity.identityHash,
      logicalJobId: engineResult.identity.logicalJobId,
      resultArtifactId: engineResult.result.resultArtifactId,
      admissionDisposition: engineResult.admissionDisposition,
      resumed: engineResult.resumed
    });
  }

  #validateBoundary({ event, contextRequest, acceptedContext }) {
    const blockers = [];
    if (event.type !== "candle_closed") blockers.push("verified_close_event_required");
    if (
      event.requestedSymbol !== requiredRequestedSymbol ||
      event.brokerSymbol !== requiredBrokerSymbol ||
      event.timeframe !== requiredTriggerTimeframe ||
      event.sourceProvider !== "mt5_read_only"
    ) {
      blockers.push("b1_2_trigger_scope_invalid");
    }
    if (!event.currentLiveEligible) {
      blockers.push("current_live_time_verification_not_eligible");
    }
    if (event.verificationProofState !== "fresh") {
      blockers.push("current_live_time_verification_not_fresh");
    }
    if (!acceptedContextBoundaryIsSafe(acceptedContext)) {
      blockers.push("accepted_context_safety_boundary_invalid");
    }
    if (!contextArtifactPattern.test(acceptedContext.contextArtifactId)) {
      blockers.push("accepted_context_artifact_id_invalid");
    }
    if (
      acceptedContext.triggerEventId !== event.eventId ||
      acceptedContext.triggerCloseId !== event.candleIdentity
    ) {
      blockers.push("accepted_context_trigger_mismatch");
    }
    if (
      acceptedContext.requestedSymbol !== event.requestedSymbol ||
      acceptedContext.brokerSymbol !== event.brokerSymbol ||
      acceptedContext.triggerTimeframe !== event.timeframe
    ) {
      blockers.push("accepted_context_scope_mismatch");
    }
    if (
      acceptedContext.sourceFingerprint !== event.sourceFingerprint ||
      acceptedContext.timeVerificationArtifactId !== event.timeVerificationArtifactId
    ) {
      blockers.push("accepted_context_source_identity_mismatch");
    }
    if (
      contextRequest.purpose !== "current_live_shadow" ||
      contextRequest.requestedSymbol !== event.requestedSymbol ||
      contextRequest.brokerSymbol !== event.brokerSymbol ||
      contextRequest.source.sourceKind !== "mt5_read_only" ||
      contextRequest.source.provider !== event.sourceProvider ||
      contextRequest.source.sourceFingerprint !== event.sourceFingerprint
    ) {
      blockers.push("context_rebuild_request_identity_mismatch");
    }
    return sortedUnique(blockers);
  }

  async #canonicalReferenceHash(namespace, value) {
    return hashPattern.test(value)
      ? value
      : this.#canonicalHash(Object.freeze({ namespace, value }));
  }

  #blocked(blockers, contextArtifactId) {
    this.#counters.blocked += 1;
    return compactOutcome({
      status: "blocked",
      mode: this.#mode,
      blockers: sortedUnique(blockers),
      warnings: [],
      nextAction: "Preserve the compact mismatch diagnostic and do not create downstream research artifacts.",
      ...(contextArtifactId ? { contextArtifactId } : {}),
      resumed: false
    });
  }
}

export const CANONICAL_RESEARCH_B1_2_PREPARATION_BOUNDARY = Object.freeze({
  defaultMode: "disabled",
  testMode: "recorded_artifact_test",
  formalA3_2AcceptanceRequired: true,
  runtimeRegistrationAllowed: false,
  schedulerRegistrationAllowed: false,
  liveEventConsumptionAllowed: false,
  acceptedRuntimeLedgerMutationAllowed: false,
  strategyExecutionAllowed: false,
  evidenceCreationAllowed: false,
  readinessChangeAllowed: false,
  paperDemoAllowed: false,
  memoryProjectionAllowed: false,
  brokerAccessAllowed: false,
  productionAdoptionAllowed: false,
  authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
  capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
});
