import { assertV2Authority, V2_AUTHORITY_NONE } from "../authority/v2Authority";
import { canonicalHash } from "../serialization/canonicalSerialization";
import { validateV2Mt5UpstreamTimeContract } from "./v2Mt5UpstreamTimeContract";
import type { V2Mt5ReadOnlyTimeContract } from "./v2Mt5UpstreamTimeContractTypes";
import {
  V2_MT5_OFFSET_REGIME_DEFAULT_MAX_GAP_MS,
  V2_MT5_OFFSET_REGIME_LEDGER_SCHEMA,
  V2_MT5_OFFSET_REGIME_LEDGER_VERSION,
  V2_MT5_OFFSET_REGIME_MAX_SUMMARIES,
  V2_MT5_OFFSET_REGIME_POLICY_VERSION,
  type V2Mt5OffsetRegimeAppendResult,
  type V2Mt5OffsetRegimeCoverage,
  type V2Mt5OffsetRegimeLedger,
  type V2Mt5OffsetRegimeObservation,
  type V2Mt5OffsetRegimeSummary,
  type V2Mt5OffsetRegimeTerminationReason
} from "./v2Mt5OffsetRegimeTypes";

const unique = (values: readonly string[]) => Object.freeze([...new Set(values)]);
const isoMs = (value: string | undefined) => {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : undefined;
};
const freezeRegimes = (regimes: readonly Readonly<V2Mt5OffsetRegimeSummary>[]) =>
  Object.freeze(regimes.map((regime) => Object.freeze(regime)));

export function createV2Mt5OffsetRegimeLedger({
  brokerSymbol,
  maximumGapMs = V2_MT5_OFFSET_REGIME_DEFAULT_MAX_GAP_MS
}: {
  brokerSymbol: string;
  maximumGapMs?: number;
}): Readonly<V2Mt5OffsetRegimeLedger> {
  if (!brokerSymbol.trim()) throw new Error("An MT5 broker symbol is required for offset-regime continuity.");
  if (!Number.isFinite(maximumGapMs) || maximumGapMs < 30_000 || maximumGapMs > V2_MT5_OFFSET_REGIME_DEFAULT_MAX_GAP_MS) {
    throw new Error("MT5 offset-regime maximum gap must be between 30 and 120 seconds.");
  }
  return Object.freeze({
    schemaId: V2_MT5_OFFSET_REGIME_LEDGER_SCHEMA,
    version: V2_MT5_OFFSET_REGIME_LEDGER_VERSION,
    policyVersion: V2_MT5_OFFSET_REGIME_POLICY_VERSION,
    brokerSymbol,
    maximumGapMs,
    regimes: Object.freeze([]),
    processedObservationCount: 0,
    compactedRegimeCount: 0,
    warnings: Object.freeze([]),
    blockers: Object.freeze([]),
    shadowOnly: true,
    authority: V2_AUTHORITY_NONE
  });
}

export function v2Mt5OffsetRegimeObservationFromContract({
  brokerSymbol,
  contract
}: {
  brokerSymbol: string;
  contract: unknown;
}): Readonly<V2Mt5OffsetRegimeObservation> {
  const validation = validateV2Mt5UpstreamTimeContract(contract);
  const normalized = validation.contract;
  const blockers = [
    ...validation.blockers,
    ...(normalized?.blockers ?? []),
    ...(normalized?.terminalProbeBlockers ?? [])
  ];
  if (!brokerSymbol.trim()) blockers.push("offset_regime_broker_symbol_missing");
  if (!normalized?.terminalProbeObservationId?.trim()) blockers.push("offset_regime_observation_id_missing");
  if (!normalized?.terminalProbeInstanceId?.match(/^[a-f0-9]{8}$/i)) blockers.push("offset_regime_probe_instance_missing");
  if (isoMs(normalized?.terminalProbeCapturedAt) === undefined) blockers.push("offset_regime_capture_time_invalid");
  if (normalized?.currentLiveTimeBasisVerified !== true) blockers.push("offset_regime_current_live_verification_missing");
  if (!normalized || !["epoch_utc", "mt5_server_wall_clock"].includes(normalized.providerTimeBasis)) {
    blockers.push("offset_regime_provider_basis_unsupported");
  }
  const observedOffsetMinutes = normalized?.providerTimeBasis === "epoch_utc"
    ? 0
    : normalized?.terminalObservedOffsetMinutes;
  if (!Number.isInteger(observedOffsetMinutes)) blockers.push("offset_regime_observed_offset_missing");
  try {
    assertV2Authority(normalized?.authority);
  } catch {
    blockers.push("offset_regime_authority_invalid");
  }
  return Object.freeze({
    observationId: normalized?.terminalProbeObservationId ?? "unavailable",
    probeInstanceId: normalized?.terminalProbeInstanceId ?? "unavailable",
    brokerSymbol,
    capturedAtUtc: normalized?.terminalProbeCapturedAt ?? "invalid",
    providerTimeBasis: normalized?.providerTimeBasis ?? "unknown",
    observedOffsetMinutes: Number.isInteger(observedOffsetMinutes) ? Number(observedOffsetMinutes) : 0,
    ...(normalized?.terminalBuild === undefined ? {} : { terminalBuild: normalized.terminalBuild }),
    basisClassification: normalized?.terminalBasisClassification ?? "unknown",
    pythonTransportBasis: normalized?.pythonTransportBasis ?? "unresolved",
    accepted: blockers.length === 0,
    blockers: unique(blockers),
    warnings: unique(validation.warnings),
    authority: V2_AUTHORITY_NONE
  });
}

const observationCore = (observation: Readonly<V2Mt5OffsetRegimeObservation>) => ({
  observationId: observation.observationId,
  probeInstanceId: observation.probeInstanceId,
  brokerSymbol: observation.brokerSymbol,
  capturedAtUtc: new Date(observation.capturedAtUtc).toISOString(),
  providerTimeBasis: observation.providerTimeBasis,
  observedOffsetMinutes: observation.observedOffsetMinutes,
  terminalBuild: observation.terminalBuild ?? null,
  basisClassification: observation.basisClassification,
  pythonTransportBasis: observation.pythonTransportBasis
});

const createRegime = async (
  observation: Readonly<V2Mt5OffsetRegimeObservation>
): Promise<Readonly<V2Mt5OffsetRegimeSummary>> => {
  const core = observationCore(observation);
  const continuityHash = await canonicalHash({ policyVersion: V2_MT5_OFFSET_REGIME_POLICY_VERSION, observation: core });
  const regimeId = await canonicalHash({
    policyVersion: V2_MT5_OFFSET_REGIME_POLICY_VERSION,
    brokerSymbol: observation.brokerSymbol,
    probeInstanceId: observation.probeInstanceId,
    providerTimeBasis: observation.providerTimeBasis,
    observedOffsetMinutes: observation.observedOffsetMinutes,
    startedAtUtc: core.capturedAtUtc,
    firstObservationId: observation.observationId
  });
  return Object.freeze({
    regimeId: `v2-mt5-offset-regime:${regimeId.replace(/^sha256:/, "")}`,
    status: "active",
    brokerSymbol: observation.brokerSymbol,
    probeInstanceId: observation.probeInstanceId,
    providerTimeBasis: observation.providerTimeBasis,
    observedOffsetMinutes: observation.observedOffsetMinutes,
    ...(observation.terminalBuild === undefined ? {} : { terminalBuild: observation.terminalBuild }),
    startedAtUtc: core.capturedAtUtc,
    lastObservedAtUtc: core.capturedAtUtc,
    observationCount: 1,
    firstObservationId: observation.observationId,
    lastObservationId: observation.observationId,
    continuityHash
  });
};

const terminate = (
  regime: Readonly<V2Mt5OffsetRegimeSummary>,
  reason: V2Mt5OffsetRegimeTerminationReason,
  terminatedAtUtc: string
): Readonly<V2Mt5OffsetRegimeSummary> => Object.freeze({
  ...regime,
  status: "terminated",
  terminatedAtUtc,
  terminationReason: reason
});

const rejectedObservationReason = (
  observation: Readonly<V2Mt5OffsetRegimeObservation>
): V2Mt5OffsetRegimeTerminationReason => {
  if (observation.blockers.includes("terminal_quote_stale")) return "stale_quote";
  if (
    observation.blockers.includes("terminal_python_basis_conflict") ||
    observation.basisClassification === "conflicting_terminal_evidence"
  ) return "terminal_evidence_conflict";
  return "observation_rejected";
};

const compactLedger = ({
  base,
  regimes,
  activeRegimeId,
  warnings = [],
  blockers = [],
  processedIncrement = 1
}: {
  base: Readonly<V2Mt5OffsetRegimeLedger>;
  regimes: readonly Readonly<V2Mt5OffsetRegimeSummary>[];
  activeRegimeId?: string;
  warnings?: readonly string[];
  blockers?: readonly string[];
  processedIncrement?: number;
}): Readonly<V2Mt5OffsetRegimeLedger> => {
  const overflow = Math.max(0, regimes.length - V2_MT5_OFFSET_REGIME_MAX_SUMMARIES);
  const compacted = overflow ? regimes.slice(overflow) : regimes;
  return Object.freeze({
    ...base,
    regimes: freezeRegimes(compacted),
    ...(activeRegimeId ? { activeRegimeId } : { activeRegimeId: undefined }),
    processedObservationCount: base.processedObservationCount + processedIncrement,
    compactedRegimeCount: base.compactedRegimeCount + overflow,
    warnings: unique([...warnings, ...(overflow ? ["offset_regime_history_compacted"] : [])]),
    blockers: unique(blockers),
    authority: V2_AUTHORITY_NONE
  });
};

const activeRegime = (ledger: Readonly<V2Mt5OffsetRegimeLedger>) =>
  ledger.regimes.find((regime) => regime.regimeId === ledger.activeRegimeId && regime.status === "active");

const restartReason = (
  active: Readonly<V2Mt5OffsetRegimeSummary>,
  observation: Readonly<V2Mt5OffsetRegimeObservation>,
  gapMs: number,
  maximumGapMs: number
): V2Mt5OffsetRegimeTerminationReason | undefined => {
  if (gapMs > maximumGapMs) return "observation_gap";
  if (active.probeInstanceId !== observation.probeInstanceId) return "terminal_instance_changed";
  if (active.terminalBuild !== observation.terminalBuild) return "terminal_build_changed";
  if (active.providerTimeBasis !== observation.providerTimeBasis) return "provider_basis_changed";
  if (active.observedOffsetMinutes !== observation.observedOffsetMinutes) return "provider_offset_changed";
  return undefined;
};

export async function appendV2Mt5OffsetRegimeObservation({
  ledger,
  observation
}: {
  ledger: Readonly<V2Mt5OffsetRegimeLedger>;
  observation: Readonly<V2Mt5OffsetRegimeObservation>;
}): Promise<Readonly<V2Mt5OffsetRegimeAppendResult>> {
  assertV2Authority(ledger.authority);
  assertV2Authority(observation.authority);
  if (ledger.schemaId !== V2_MT5_OFFSET_REGIME_LEDGER_SCHEMA || ledger.version !== V2_MT5_OFFSET_REGIME_LEDGER_VERSION) {
    throw new Error("Unsupported MT5 offset-regime ledger contract.");
  }
  if (observation.brokerSymbol !== ledger.brokerSymbol) {
    return Object.freeze({
      action: "rejected",
      ledger,
      activeRegime: activeRegime(ledger),
      blockers: Object.freeze(["offset_regime_broker_symbol_mismatch"]),
      warnings: Object.freeze([])
    });
  }
  const active = activeRegime(ledger);
  if (active?.lastObservationId === observation.observationId) {
    return Object.freeze({
      action: "idempotent",
      ledger,
      activeRegime: active,
      blockers: Object.freeze([]),
      warnings: Object.freeze([])
    });
  }
  const capturedMs = isoMs(observation.capturedAtUtc);
  if (!observation.accepted || capturedMs === undefined) {
    const regimes = active
      ? ledger.regimes.map((regime) => regime.regimeId === active.regimeId
        ? terminate(regime, rejectedObservationReason(observation), capturedMs === undefined ? active.lastObservedAtUtc : observation.capturedAtUtc)
        : regime)
      : ledger.regimes;
    const next = compactLedger({
      base: ledger,
      regimes,
      warnings: observation.warnings,
      blockers: observation.blockers.length ? observation.blockers : ["offset_regime_observation_rejected"]
    });
    return Object.freeze({
      action: active ? "terminated" : "rejected",
      ledger: next,
      blockers: next.blockers,
      warnings: next.warnings
    });
  }
  if (!active) {
    const created = await createRegime(observation);
    const next = compactLedger({
      base: ledger,
      regimes: [...ledger.regimes, created],
      activeRegimeId: created.regimeId,
      warnings: observation.warnings
    });
    return Object.freeze({ action: "created", ledger: next, activeRegime: created, blockers: Object.freeze([]), warnings: next.warnings });
  }
  const lastMs = isoMs(active.lastObservedAtUtc) ?? Number.POSITIVE_INFINITY;
  const gapMs = capturedMs - lastMs;
  if (gapMs <= 0) {
    return Object.freeze({
      action: "rejected",
      ledger,
      activeRegime: active,
      blockers: Object.freeze(["offset_regime_observation_out_of_order"]),
      warnings: Object.freeze([])
    });
  }
  const reason = restartReason(active, observation, gapMs, ledger.maximumGapMs);
  if (reason) {
    const closed = terminate(active, reason, observation.capturedAtUtc);
    const created = await createRegime(observation);
    const regimes = ledger.regimes.map((regime) => regime.regimeId === active.regimeId ? closed : regime);
    regimes.push(created);
    const next = compactLedger({
      base: ledger,
      regimes,
      activeRegimeId: created.regimeId,
      warnings: [...observation.warnings, `offset_regime_restarted:${reason}`]
    });
    return Object.freeze({ action: "restarted", ledger: next, activeRegime: created, blockers: Object.freeze([]), warnings: next.warnings });
  }
  const continuityHash = await canonicalHash({ previous: active.continuityHash, observation: observationCore(observation) });
  const extended = Object.freeze({
    ...active,
    lastObservedAtUtc: new Date(capturedMs).toISOString(),
    observationCount: active.observationCount + 1,
    lastObservationId: observation.observationId,
    continuityHash
  });
  const regimes = ledger.regimes.map((regime) => regime.regimeId === active.regimeId ? extended : regime);
  const next = compactLedger({
    base: ledger,
    regimes,
    activeRegimeId: extended.regimeId,
    warnings: observation.warnings
  });
  return Object.freeze({ action: "extended", ledger: next, activeRegime: extended, blockers: Object.freeze([]), warnings: next.warnings });
}

export function resolveV2Mt5OffsetRegimeCoverage({
  ledger,
  brokerSymbol,
  contract,
  systemUtc
}: {
  ledger: Readonly<V2Mt5OffsetRegimeLedger> | undefined;
  brokerSymbol: string;
  contract: Readonly<V2Mt5ReadOnlyTimeContract> | undefined;
  systemUtc: string;
}): Readonly<V2Mt5OffsetRegimeCoverage> {
  if (!ledger) return Object.freeze({ eligible: false, blockers: Object.freeze(["offset_regime_ledger_missing"]), warnings: Object.freeze([]) });
  const blockers: string[] = [];
  if (ledger.brokerSymbol !== brokerSymbol) blockers.push("offset_regime_broker_symbol_mismatch");
  const active = activeRegime(ledger);
  if (!active) blockers.push("offset_regime_active_coverage_missing");
  const observation = v2Mt5OffsetRegimeObservationFromContract({ brokerSymbol, contract });
  blockers.push(...observation.blockers);
  if (active && active.lastObservationId !== observation.observationId) blockers.push("offset_regime_contract_not_latest_observation");
  if (active && active.probeInstanceId !== observation.probeInstanceId) blockers.push("offset_regime_terminal_instance_mismatch");
  if (active && active.providerTimeBasis !== observation.providerTimeBasis) blockers.push("offset_regime_provider_basis_mismatch");
  if (active && active.observedOffsetMinutes !== observation.observedOffsetMinutes) blockers.push("offset_regime_provider_offset_mismatch");
  const systemMs = isoMs(systemUtc);
  const lastMs = isoMs(active?.lastObservedAtUtc);
  if (systemMs === undefined) blockers.push("offset_regime_system_time_invalid");
  if (systemMs !== undefined && lastMs !== undefined) {
    if (systemMs < lastMs - 5_000) blockers.push("offset_regime_system_time_precedes_observation");
    if (systemMs > lastMs + ledger.maximumGapMs) blockers.push("offset_regime_coverage_expired");
  }
  const validUntilUtc = lastMs === undefined ? undefined : new Date(lastMs + ledger.maximumGapMs).toISOString();
  return Object.freeze({
    eligible: blockers.length === 0,
    ...(active ? {
      regimeId: active.regimeId,
      regimeStartUtc: active.startedAtUtc,
      lastObservedAtUtc: active.lastObservedAtUtc
    } : {}),
    ...(validUntilUtc ? { validUntilUtc } : {}),
    blockers: unique(blockers),
    warnings: unique([...ledger.warnings, ...observation.warnings])
  });
}
