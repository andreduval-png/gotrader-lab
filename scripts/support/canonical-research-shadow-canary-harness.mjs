import {
  CANONICAL_RESEARCH_AUTHORITY_NONE,
  CANONICAL_RESEARCH_CAPABILITIES_DISABLED
} from "./canonical-research-shadow-context-adapter.mjs";

export const B1_2_SHADOW_CANARY_PREPARATION_PROFILE_ID =
  "b1_2_shadow_context_canary_preparation";
export const B1_2_SHADOW_CANARY_STATE_VERSION =
  "gotrader-b1-shadow-canary-preparation-state-v1";
export const B1_2_SHADOW_CANARY_CONTROL_VERSION =
  "gotrader-b1-shadow-canary-preparation-control-v1";

const stateFile = "state.json";
const maximumAuditEntries = 100;
const controlFields = new Set([
  "controlVersion",
  "revision",
  "desiredMode",
  "requestedAt",
  "reason",
  "operatorAcknowledged",
  "authority"
]);

const emptyCounters = () => ({
  received: 0,
  disabled: 0,
  blocked: 0,
  completed: 0,
  coalesced: 0,
  identityMismatches: 0,
  controlsApplied: 0,
  controlsRejected: 0,
  rollbacksApplied: 0,
  restarts: 0
});

const isCanonicalTimestamp = (value) => {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
};

const authorityIsNone = (value) =>
  value?.executionAuthority === "none" &&
  value?.brokerAuthority === "none" &&
  value?.readinessOverrideAuthority === "none";

const compactOutcome = ({ status, blockers, nextAction }) => Object.freeze({
  status,
  blockers: Object.freeze([...blockers]),
  warnings: Object.freeze([]),
  nextAction,
  resumed: false,
  shadowOnly: true,
  rawCandlesPersisted: false,
  rawFactsPersisted: false,
  authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
  capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
});

export class CanonicalResearchShadowCanaryPreparationHarness {
  #storage;
  #adapter;
  #canonicalHash;
  #now;
  #state;
  #integrityBlocked = false;
  #initialized = false;

  constructor({ storage, adapter, canonicalHash, now = () => new Date().toISOString() }) {
    if (!storage?.readText || !storage?.writeTextAtomic) {
      throw new Error("The B1.2 preparation harness requires bounded storage.");
    }
    if (!adapter?.run || !adapter?.status || typeof canonicalHash !== "function") {
      throw new Error("The B1.2 preparation harness requires a recorded-test adapter and canonical hash.");
    }
    const adapterStatus = adapter.status();
    if (
      adapterStatus.mode !== "recorded_artifact_test" ||
      adapterStatus.runtimeRegistered !== false ||
      adapterStatus.schedulerRegistered !== false ||
      adapterStatus.liveConsumptionEnabled !== false ||
      !authorityIsNone(adapterStatus.authority)
    ) {
      throw new Error("The B1.2 preparation harness rejected an adapter outside the recorded-test boundary.");
    }
    this.#storage = storage;
    this.#adapter = adapter;
    this.#canonicalHash = canonicalHash;
    this.#now = now;
  }

  async initialize() {
    if (this.#initialized) return this.status();
    this.#initialized = true;
    const text = await this.#storage.readText(stateFile);
    if (!text) {
      this.#state = this.#newState();
      await this.#recordAudit("profile_initialized", "disabled", [], {});
      await this.#persist();
      return this.status();
    }

    try {
      const envelope = JSON.parse(text);
      const expectedHash = await this.#canonicalHash({
        stateVersion: B1_2_SHADOW_CANARY_STATE_VERSION,
        state: envelope.state
      });
      if (
        envelope.stateVersion !== B1_2_SHADOW_CANARY_STATE_VERSION ||
        envelope.integrityHash !== expectedHash ||
        !this.#stateIsSafe(envelope.state)
      ) {
        throw new Error("state_integrity_invalid");
      }
      this.#state = envelope.state;
      this.#state.counters.restarts += 1;
      await this.#recordAudit("profile_restarted", this.#state.mode, [], {});
      await this.#persist();
    } catch {
      this.#integrityBlocked = true;
      this.#state = this.#newState();
      this.#state.blockers = ["b1_2_preparation_state_integrity_failed"];
    }
    return this.status();
  }

  status() {
    this.#assertInitialized();
    return Object.freeze({
      profileId: B1_2_SHADOW_CANARY_PREPARATION_PROFILE_ID,
      stateVersion: B1_2_SHADOW_CANARY_STATE_VERSION,
      state: this.#integrityBlocked
        ? "blocked"
        : this.#state.mode === "disabled"
          ? "disabled"
          : "ready_for_recorded_test",
      mode: this.#state.mode,
      appliedControlRevision: this.#state.appliedControlRevision,
      blockers: Object.freeze([...this.#state.blockers]),
      counters: Object.freeze({ ...this.#state.counters }),
      lastOutcome: this.#state.lastOutcome
        ? Object.freeze({ ...this.#state.lastOutcome })
        : undefined,
      recentAudit: Object.freeze(this.#state.recentAudit.map((entry) => Object.freeze({ ...entry }))),
      runtimeRegistered: false,
      schedulerRegistered: false,
      liveConsumptionEnabled: false,
      acceptedRuntimeLedgerMutationAllowed: false,
      strategyExecutionAllowed: false,
      evidenceCreationAllowed: false,
      readinessChangeAllowed: false,
      productionAdoptionAllowed: false,
      authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
      capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
    });
  }

  async applyControl(control) {
    this.#assertInitialized();
    if (this.#integrityBlocked) {
      return Object.freeze({
        applied: false,
        disposition: "blocked_integrity",
        blockers: Object.freeze(["b1_2_preparation_state_integrity_failed"]),
        status: this.status()
      });
    }

    const blockers = this.#validateControl(control);
    if (blockers.length) {
      this.#state.counters.controlsRejected += 1;
      await this.#recordAudit("control_rejected", this.#state.mode, blockers, {
        revision: Number.isInteger(control?.revision) ? control.revision : undefined
      });
      await this.#persist();
      return Object.freeze({
        applied: false,
        disposition: "rejected",
        blockers: Object.freeze(blockers),
        status: this.status()
      });
    }
    if (control.revision <= this.#state.appliedControlRevision) {
      await this.#recordAudit("control_stale_ignored", this.#state.mode, [], {
        revision: control.revision
      });
      await this.#persist();
      return Object.freeze({
        applied: false,
        disposition: "stale_ignored",
        blockers: Object.freeze([]),
        status: this.status()
      });
    }

    const previousMode = this.#state.mode;
    this.#state.mode = control.desiredMode;
    this.#state.appliedControlRevision = control.revision;
    this.#state.counters.controlsApplied += 1;
    if (previousMode !== "disabled" && control.desiredMode === "disabled") {
      this.#state.counters.rollbacksApplied += 1;
    }
    const reasonHash = await this.#canonicalHash({
      namespace: "gotrader.b1.2.control-reason",
      reason: control.reason
    });
    await this.#recordAudit("control_applied", control.desiredMode, [], {
      revision: control.revision,
      reasonHash
    });
    await this.#persist();
    return Object.freeze({
      applied: true,
      disposition: "applied",
      blockers: Object.freeze([]),
      status: this.status()
    });
  }

  async rollback({ revision, requestedAt = this.#now(), reason }) {
    return this.applyControl({
      controlVersion: B1_2_SHADOW_CANARY_CONTROL_VERSION,
      revision,
      desiredMode: "disabled",
      requestedAt,
      reason: reason || "Operator rollback to the fail-closed preparation state.",
      operatorAcknowledged: true,
      authority: CANONICAL_RESEARCH_AUTHORITY_NONE
    });
  }

  async handleRecordedContext(input) {
    this.#assertInitialized();
    if (this.#integrityBlocked) {
      return compactOutcome({
        status: "blocked",
        blockers: ["b1_2_preparation_state_integrity_failed"],
        nextAction: "Quarantine the corrupt preparation state; do not run the canary."
      });
    }

    this.#state.counters.received += 1;
    if (this.#state.mode !== "recorded_artifact_test") {
      this.#state.counters.disabled += 1;
      const outcome = compactOutcome({
        status: "disabled",
        blockers: ["b1_2_shadow_canary_preparation_disabled"],
        nextAction: "Use an explicit acknowledged recorded-test control before fixture validation."
      });
      await this.#recordOutcome(outcome);
      await this.#persist();
      return outcome;
    }

    let outcome;
    try {
      outcome = await this.#adapter.run(input);
    } catch {
      outcome = compactOutcome({
        status: "blocked",
        blockers: ["b1_2_recorded_adapter_failed_closed"],
        nextAction: "Inspect the isolated test adapter; no live retry is authorized."
      });
    }
    if (outcome.status === "completed") this.#state.counters.completed += 1;
    else if (outcome.status === "disabled") this.#state.counters.disabled += 1;
    else this.#state.counters.blocked += 1;
    if (outcome.admissionDisposition === "coalesced") {
      this.#state.counters.coalesced += 1;
    }
    if (outcome.blockers?.some((blocker) => blocker.includes("identity_mismatch"))) {
      this.#state.counters.identityMismatches += 1;
    }
    await this.#recordOutcome(outcome);
    await this.#persist();
    return outcome;
  }

  #newState() {
    return {
      profileId: B1_2_SHADOW_CANARY_PREPARATION_PROFILE_ID,
      mode: "disabled",
      appliedControlRevision: 0,
      blockers: [],
      counters: emptyCounters(),
      recentAudit: [],
      updatedAt: this.#now(),
      authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
      capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
    };
  }

  #stateIsSafe(state) {
    return state?.profileId === B1_2_SHADOW_CANARY_PREPARATION_PROFILE_ID &&
      (state.mode === "disabled" || state.mode === "recorded_artifact_test") &&
      Number.isInteger(state.appliedControlRevision) &&
      authorityIsNone(state.authority) &&
      state.capabilities?.productionAdoptionAllowed === false &&
      state.capabilities?.canCreateEvidence === false &&
      state.capabilities?.canApproveReadiness === false &&
      state.capabilities?.canApplyCalibration === false &&
      state.capabilities?.canCreateTradeIntent === false &&
      Array.isArray(state.blockers) &&
      Array.isArray(state.recentAudit) &&
      state.counters &&
      Object.keys(emptyCounters()).every((key) => Number.isInteger(state.counters[key]));
  }

  #validateControl(control) {
    const blockers = [];
    if (!control || typeof control !== "object" || Array.isArray(control)) {
      return ["b1_2_control_invalid"];
    }
    if (Object.keys(control).some((key) => !controlFields.has(key))) {
      blockers.push("b1_2_control_field_not_allowlisted");
    }
    if (control.controlVersion !== B1_2_SHADOW_CANARY_CONTROL_VERSION) {
      blockers.push("b1_2_control_version_invalid");
    }
    if (!Number.isInteger(control.revision) || control.revision <= 0) {
      blockers.push("b1_2_control_revision_invalid");
    }
    if (
      control.desiredMode !== "disabled" &&
      control.desiredMode !== "recorded_artifact_test"
    ) {
      blockers.push("b1_2_control_mode_not_allowlisted");
    }
    if (!isCanonicalTimestamp(control.requestedAt)) {
      blockers.push("b1_2_control_timestamp_invalid");
    }
    if (
      typeof control.reason !== "string" ||
      !control.reason.trim() ||
      control.reason.length > 512
    ) {
      blockers.push("b1_2_control_reason_required");
    }
    if (control.operatorAcknowledged !== true) {
      blockers.push("b1_2_control_operator_acknowledgement_required");
    }
    if (!authorityIsNone(control.authority)) {
      blockers.push("b1_2_control_authority_invalid");
    }
    return [...new Set(blockers)].sort();
  }

  async #recordOutcome(outcome) {
    const compact = {
      status: outcome.status,
      recordedAt: this.#now(),
      blockers: [...(outcome.blockers ?? [])].slice(0, 20),
      contextArtifactId: outcome.contextArtifactId,
      logicalJobId: outcome.logicalJobId,
      resultArtifactId: outcome.resultArtifactId,
      admissionDisposition: outcome.admissionDisposition
    };
    this.#state.lastOutcome = Object.fromEntries(
      Object.entries(compact).filter(([, value]) => value !== undefined)
    );
    await this.#recordAudit("recorded_context_outcome", outcome.status, compact.blockers, {
      contextArtifactId: compact.contextArtifactId,
      logicalJobId: compact.logicalJobId,
      resultArtifactId: compact.resultArtifactId
    });
  }

  async #recordAudit(eventType, status, blockers, metadata) {
    const recordedAt = this.#now();
    const compactMetadata = Object.fromEntries(
      Object.entries(metadata).filter(([, value]) =>
        value === undefined || value === null
          ? false
          : typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      )
    );
    const auditCore = {
      eventType,
      recordedAt,
      status,
      blockers: [...blockers].slice(0, 20),
      metadata: compactMetadata,
      authority: CANONICAL_RESEARCH_AUTHORITY_NONE
    };
    const auditId = await this.#canonicalHash({
      profileId: B1_2_SHADOW_CANARY_PREPARATION_PROFILE_ID,
      auditCore
    });
    this.#state.recentAudit.push({ auditId, ...auditCore });
    this.#state.recentAudit = this.#state.recentAudit.slice(-maximumAuditEntries);
    this.#state.updatedAt = recordedAt;
  }

  async #persist() {
    if (this.#integrityBlocked) return;
    const integrityHash = await this.#canonicalHash({
      stateVersion: B1_2_SHADOW_CANARY_STATE_VERSION,
      state: this.#state
    });
    await this.#storage.writeTextAtomic(
      stateFile,
      `${JSON.stringify({
        stateVersion: B1_2_SHADOW_CANARY_STATE_VERSION,
        integrityHash,
        state: this.#state
      }, null, 2)}\n`
    );
  }

  #assertInitialized() {
    if (!this.#initialized || !this.#state) {
      throw new Error("Initialize the B1.2 preparation harness before use.");
    }
  }
}

export const B1_2_SHADOW_CANARY_PREPARATION_BOUNDARY = Object.freeze({
  profileId: B1_2_SHADOW_CANARY_PREPARATION_PROFILE_ID,
  defaultMode: "disabled",
  onlyTestMode: "recorded_artifact_test",
  formalA3_2AcceptanceRequired: true,
  runtimeRegistrationAllowed: false,
  schedulerRegistrationAllowed: false,
  liveEventConsumptionAllowed: false,
  acceptedRuntimeLedgerMutationAllowed: false,
  strategyExecutionAllowed: false,
  evidenceCreationAllowed: false,
  readinessChangeAllowed: false,
  paperDemoAllowed: false,
  productionAdoptionAllowed: false,
  authority: CANONICAL_RESEARCH_AUTHORITY_NONE,
  capabilities: CANONICAL_RESEARCH_CAPABILITIES_DISABLED
});
