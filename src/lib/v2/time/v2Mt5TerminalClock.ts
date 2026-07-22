import { assertV2Authority, V2_AUTHORITY_NONE } from "../authority/v2Authority";
import {
  V2_MT5_TERMINAL_CLOCK_CLASSIFICATION_VERSION,
  V2_MT5_TERMINAL_CLOCK_SCHEMA_ID,
  V2_MT5_TERMINAL_CLOCK_SCHEMA_VERSION,
  type V2Mt5PythonTransportBasis,
  type V2Mt5TerminalClockClassification,
  type V2Mt5TerminalClockComparisonInput,
  type V2Mt5TerminalClockDeltas,
  type V2Mt5TerminalClockObservation,
  type V2Mt5TerminalClockValidationResult,
  type V2Mt5TimestampBasisClassification
} from "./v2Mt5TerminalClockTypes";

const allowedKeys = new Set([
  "schemaId", "version", "observationId", "sequence", "probeInstanceId", "symbol", "timeframe",
  "captureDurationMs", "timeCurrentRaw", "timeTradeServerRaw", "timeGmtRaw", "timeLocalRaw",
  "timeGmtOffsetSeconds", "timeDaylightSavingsSeconds", "symbolTimeRaw", "symbolTimeMscRaw",
  "latestBarOpenRaw", "latestBarIndex", "symbolSynchronized", "tickReadSucceeded", "barReadSucceeded",
  "terminalBuild", "authority", "executionAuthority", "brokerAuthority", "readinessOverrideAuthority"
]);
const sensitiveKey = /(?:account|balance|equity|margin|position|order|deal|credential|password|secret|token|apiKey|login)/i;
const requiredFinite = [
  "sequence", "captureDurationMs", "timeCurrentRaw", "timeTradeServerRaw", "timeGmtRaw", "timeLocalRaw",
  "timeGmtOffsetSeconds", "timeDaylightSavingsSeconds", "symbolTimeRaw", "latestBarOpenRaw", "latestBarIndex"
] as const;

const freezeText = (values: readonly string[]) => Object.freeze([...new Set(values)]);
const toMs = (seconds: number) => Math.round(seconds * 1_000);
const tickMs = (seconds: number, milliseconds?: number) =>
  Number.isFinite(milliseconds) && Number(milliseconds) > 0 ? Math.round(Number(milliseconds)) : toMs(seconds);

const sensitivePaths = (value: unknown, path = "observation", found: string[] = []): string[] => {
  if (!value || typeof value !== "object") return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) => sensitivePaths(item, `${path}[${index}]`, found));
    return found;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const next = `${path}.${key}`;
    if (sensitiveKey.test(key)) found.push(next);
    sensitivePaths(nested, next, found);
  }
  return found;
};

export function validateV2Mt5TerminalClockObservation(input: unknown): Readonly<V2Mt5TerminalClockValidationResult> {
  const blockers: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Object.freeze({ status: "blocked" as const, blockers: Object.freeze(["terminal_observation_missing"]) });
  }
  const observation = input as Partial<V2Mt5TerminalClockObservation>;
  const keys = Object.keys(input as Record<string, unknown>);
  keys.filter((key) => !allowedKeys.has(key)).forEach((key) => blockers.push(`terminal_observation_field_forbidden:${key}`));
  sensitivePaths(input).forEach((path) => blockers.push(`terminal_observation_sensitive_field_forbidden:${path}`));
  if (observation.schemaId !== V2_MT5_TERMINAL_CLOCK_SCHEMA_ID) blockers.push("terminal_observation_schema_invalid");
  if (observation.version !== V2_MT5_TERMINAL_CLOCK_SCHEMA_VERSION) blockers.push("terminal_observation_version_invalid");
  if (typeof observation.observationId !== "string" || !observation.observationId.trim()) blockers.push("terminal_observation_id_missing");
  if (typeof observation.probeInstanceId !== "string" || !/^[a-f0-9]{8}$/i.test(observation.probeInstanceId)) blockers.push("terminal_probe_instance_invalid");
  if (typeof observation.symbol !== "string" || !observation.symbol.trim()) blockers.push("terminal_observation_symbol_missing");
  if (observation.timeframe !== "M5") blockers.push("terminal_observation_timeframe_invalid");
  for (const field of requiredFinite) {
    if (typeof observation[field] !== "number" || !Number.isFinite(observation[field])) {
      blockers.push(`terminal_observation_${field}_invalid`);
    }
  }
  if (
    observation.symbolTimeMscRaw !== undefined &&
    (typeof observation.symbolTimeMscRaw !== "number" || !Number.isFinite(observation.symbolTimeMscRaw))
  ) {
    blockers.push("terminal_observation_symbolTimeMscRaw_invalid");
  }
  if (typeof observation.symbolSynchronized !== "boolean") blockers.push("terminal_observation_sync_status_missing");
  if (typeof observation.tickReadSucceeded !== "boolean") blockers.push("terminal_observation_tick_status_missing");
  if (typeof observation.barReadSucceeded !== "boolean") blockers.push("terminal_observation_bar_status_missing");
  try {
    assertV2Authority(observation.authority);
  } catch {
    blockers.push("terminal_observation_authority_invalid");
  }
  if (
    observation.executionAuthority !== "none" ||
    observation.brokerAuthority !== "none" ||
    observation.readinessOverrideAuthority !== "none"
  ) blockers.push("terminal_observation_top_level_authority_invalid");
  return Object.freeze({
    status: blockers.length ? "blocked" as const : "accepted" as const,
    observation: blockers.length ? undefined : Object.freeze(observation as V2Mt5TerminalClockObservation),
    blockers: freezeText(blockers)
  });
}

const classifyTransport = ({
  clockToleranceMs,
  deltas,
  observationAgeMs
}: {
  clockToleranceMs: number;
  deltas: V2Mt5TerminalClockDeltas;
  observationAgeMs: number;
}): V2Mt5PythonTransportBasis => {
  const correlationTolerance = Math.max(clockToleranceMs, observationAgeMs + clockToleranceMs);
  if (Math.abs(deltas.pythonTickMinusSymbolTimeMs) <= correlationTolerance) return "matches_symbol_quote_time";
  if (Math.abs(deltas.pythonTickMinusTimeCurrentMs) <= correlationTolerance) return "matches_terminal_server_time";
  if (Math.abs(deltas.pythonTickMinusTimeGmtMs) <= correlationTolerance) return "matches_utc";
  return "unresolved";
};

export function classifyV2Mt5TerminalClock(
  input: Readonly<V2Mt5TerminalClockComparisonInput>
): Readonly<V2Mt5TerminalClockClassification> {
  const validation = validateV2Mt5TerminalClockObservation(input.observation);
  const blockers = [...validation.blockers];
  const warnings: string[] = [];
  const observation = input.observation;
  const clockToleranceMs = input.clockToleranceMs ?? 5_000;
  const maximumObservationAgeMs = input.maximumObservationAgeMs ?? 120_000;
  const maximumQuoteAgeMs = input.maximumQuoteAgeMs ?? 120_000;
  const systemMidpointMs = Math.round((input.systemUtcBeforeMs + input.systemUtcAfterMs) / 2);
  const pythonTickMs = tickMs(input.pythonTickRaw, input.pythonTickMscRaw);
  const symbolTimeMs = tickMs(observation.symbolTimeRaw, observation.symbolTimeMscRaw);
  const deltas: V2Mt5TerminalClockDeltas = Object.freeze({
    pythonTickMinusTimeCurrentMs: pythonTickMs - toMs(observation.timeCurrentRaw),
    pythonTickMinusTimeTradeServerMs: pythonTickMs - toMs(observation.timeTradeServerRaw),
    pythonTickMinusTimeGmtMs: pythonTickMs - toMs(observation.timeGmtRaw),
    pythonTickMinusSymbolTimeMs: pythonTickMs - symbolTimeMs,
    pythonCandleMinusLatestM5BarMs: toMs(input.pythonLatestM5BarRaw - observation.latestBarOpenRaw),
    timeCurrentMinusTimeGmtMs: toMs(observation.timeCurrentRaw - observation.timeGmtRaw),
    timeTradeServerMinusTimeCurrentMs: toMs(observation.timeTradeServerRaw - observation.timeCurrentRaw),
    timeTradeServerMinusTimeGmtMs: toMs(observation.timeTradeServerRaw - observation.timeGmtRaw),
    symbolTimeMinusTimeGmtMs: symbolTimeMs - toMs(observation.timeGmtRaw),
    systemUtcMinusTimeGmtMs: systemMidpointMs - toMs(observation.timeGmtRaw),
    ...(input.wrapperTickRaw === undefined ? {} : { wrapperTickMinusPythonTickMs: toMs(input.wrapperTickRaw) - pythonTickMs }),
    ...(input.wrapperLatestM5BarRaw === undefined ? {} : {
      wrapperCandleMinusPythonCandleMs: toMs(input.wrapperLatestM5BarRaw - input.pythonLatestM5BarRaw)
    })
  });
  const observationAgeMs = Math.max(0, systemMidpointMs - toMs(observation.timeGmtRaw));
  if (input.systemUtcAfterMs < input.systemUtcBeforeMs) blockers.push("system_capture_window_invalid");
  if (input.systemUtcAfterMs - input.systemUtcBeforeMs > 30_000) blockers.push("system_capture_window_too_wide");
  if (observationAgeMs > maximumObservationAgeMs) blockers.push("terminal_observation_stale");
  if (!observation.symbolSynchronized) blockers.push("terminal_symbol_not_synchronized");
  if (!observation.tickReadSucceeded) blockers.push("terminal_tick_unavailable");
  if (!observation.barReadSucceeded) blockers.push("terminal_bar_unavailable");
  if (Math.abs(deltas.timeTradeServerMinusTimeCurrentMs) > maximumQuoteAgeMs) blockers.push("terminal_quote_stale");
  if (Math.abs(deltas.systemUtcMinusTimeGmtMs) > maximumObservationAgeMs) blockers.push("terminal_gmt_not_correlated_with_system_utc");
  if (Math.abs(deltas.pythonCandleMinusLatestM5BarMs) > 300_000) blockers.push("python_terminal_bar_basis_mismatch");

  const pythonTransportBasis = classifyTransport({ clockToleranceMs, deltas, observationAgeMs });
  const currentMatchesQuote = Math.abs(toMs(observation.timeCurrentRaw) - symbolTimeMs) <= 30_000;
  const terminalQuoteFresh = currentMatchesQuote && Math.abs(deltas.timeTradeServerMinusTimeCurrentMs) <= maximumQuoteAgeMs;
  const currentOffsetMs = deltas.timeCurrentMinusTimeGmtMs;
  const pythonOffsetMs = pythonTickMs - systemMidpointMs;
  const offsetAgreement = Math.abs(currentOffsetMs - pythonOffsetMs) <= clockToleranceMs + observationAgeMs;
  const barParity = Math.abs(deltas.pythonCandleMinusLatestM5BarMs) <= 1_000;
  let basisClassification: V2Mt5TimestampBasisClassification = "unknown";

  if (blockers.length) {
    basisClassification = validation.status === "blocked" ? "unknown" : "insufficient_evidence";
  } else if (pythonTransportBasis === "unresolved" || !barParity || !terminalQuoteFresh) {
    basisClassification = "conflicting_terminal_evidence";
    blockers.push("terminal_python_basis_conflict");
  } else if (Math.abs(currentOffsetMs) <= clockToleranceMs && Math.abs(pythonOffsetMs) <= clockToleranceMs) {
    basisClassification = "verified_utc_epoch";
  } else if (currentMatchesQuote && offsetAgreement) {
    basisClassification = "verified_trade_server_wall_clock";
  } else if (offsetAgreement) {
    basisClassification = "current_offset_verified_only";
  } else {
    basisClassification = "verified_symbol_quote_time_basis";
    warnings.push("Python transport matches the symbol quote, but the server-clock normalization basis is not verified.");
  }

  const currentLiveTimeBasisVerified = basisClassification === "verified_utc_epoch" ||
    basisClassification === "verified_trade_server_wall_clock" ||
    basisClassification === "current_offset_verified_only";
  const historicalDstPolicyVerified = currentLiveTimeBasisVerified && input.historicalDstPolicyVerified === true;
  const phase2Eligible = currentLiveTimeBasisVerified && historicalDstPolicyVerified;
  const terminalEvidenceStatus = historicalDstPolicyVerified
    ? "verified_historical" as const
    : currentLiveTimeBasisVerified
      ? "verified_current_live" as const
      : basisClassification === "conflicting_terminal_evidence"
        ? "conflicting" as const
        : basisClassification === "unknown" || basisClassification === "insufficient_evidence"
          ? "missing" as const
          : "candidate" as const;
  const verificationScope = historicalDstPolicyVerified
    ? "historical" as const
    : currentLiveTimeBasisVerified
      ? "current_live" as const
      : "none" as const;
  if (currentLiveTimeBasisVerified && !historicalDstPolicyVerified) {
    warnings.push("Current-live MT5 time basis is verified, but historical DST policy remains unverified.");
  }
  return Object.freeze({
    classificationVersion: V2_MT5_TERMINAL_CLOCK_CLASSIFICATION_VERSION,
    basisClassification,
    pythonTransportBasis,
    terminalEvidenceStatus,
    verificationScope,
    currentLiveTimeBasisVerified,
    historicalDstPolicyVerified,
    phase2Eligible,
    terminalObservedOffsetMinutes: currentLiveTimeBasisVerified ? Math.round(currentOffsetMs / 60_000) : undefined,
    observationAgeMs,
    deltas,
    blockers: freezeText(blockers),
    warnings: freezeText(warnings),
    authority: V2_AUTHORITY_NONE
  });
}
