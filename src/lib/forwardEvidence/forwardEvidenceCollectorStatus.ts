import type { FrozenResearchProfile, ForwardEvidenceProfileId } from "./forwardEvidenceTypes";
import { FORWARD_EVIDENCE_AUTHORITY, forwardEvidenceCollectionCutoff } from "./forwardEvidenceTypes";

export const FORWARD_EVIDENCE_COLLECTOR_STORAGE_KEY = "gotrader.forward-evidence-collector.v1";
export const FORWARD_EVIDENCE_COLLECTOR_UPDATED_EVENT = "gotrader-forward-evidence-collector-updated";

export type ForwardEvidenceCollectorState =
  | "waiting_for_closed_candle"
  | "blocked_source_identity"
  | "insufficient_history"
  | "no_eligible_setup"
  | "observation_recorded"
  | "duplicate_observation"
  | "outcome_updated";

export interface ForwardEvidenceCollectorStatus {
  profileId: ForwardEvidenceProfileId;
  profileVersion: "v3" | "v4";
  state: ForwardEvidenceCollectorState;
  subscriptionActive: boolean;
  processedClosedCandles: number;
  issuedObservations: number;
  resolvedOutcomes: number;
  lastProcessedAt?: string;
  lastCandleTimestamp?: string;
  lastSourceFingerprint?: string;
  lastHistoryCandleCount: number;
  blockerReason?: string;
  authority: typeof FORWARD_EVIDENCE_AUTHORITY;
}

export interface ForwardEvidenceCandleIdentity {
  source?: string;
  brokerSymbol?: string;
  requestedSymbol?: string;
  timeframe?: string;
  timestamp?: string;
  receivedAt?: string;
  sourceFingerprint?: string;
  closed?: boolean;
  executionAuthority?: string;
  brokerAuthority?: string;
  readinessOverrideAuthority?: string;
}

const normalized = (value?: string) => value?.trim().toLowerCase() ?? "";

export const validateForwardEvidenceCandleIdentity = (
  candle: ForwardEvidenceCandleIdentity,
  profile: FrozenResearchProfile
): { valid: true } | { valid: false; reason: string } => {
  if (candle.source !== "mt5") return { valid: false, reason: "source_not_mt5" };
  if (!candle.closed) return { valid: false, reason: "candle_not_closed" };
  if (normalized(candle.brokerSymbol) !== normalized(profile.brokerSymbol)) {
    return { valid: false, reason: "broker_symbol_mismatch" };
  }
  if (normalized(candle.requestedSymbol) !== normalized(profile.requestedSymbol)) {
    return { valid: false, reason: "requested_symbol_mismatch" };
  }
  if (normalized(candle.timeframe) !== normalized(profile.timeframe)) {
    return { valid: false, reason: "timeframe_mismatch" };
  }
  if (!candle.sourceFingerprint?.trim()) {
    return { valid: false, reason: "source_fingerprint_missing" };
  }
  const candleTime = Date.parse(candle.timestamp ?? "");
  const receivedAt = Date.parse(candle.receivedAt ?? "");
  if (!Number.isFinite(candleTime) || !Number.isFinite(receivedAt)) {
    return { valid: false, reason: "candle_timestamp_invalid" };
  }
  if (candleTime <= Date.parse(forwardEvidenceCollectionCutoff(profile))) {
    return { valid: false, reason: "candle_not_after_profile_freeze" };
  }
  if (
    candle.executionAuthority !== "none" ||
    candle.brokerAuthority !== "read_only" ||
    candle.readinessOverrideAuthority !== "none"
  ) {
    return { valid: false, reason: "source_authority_invalid" };
  }
  return { valid: true };
};

export const createForwardEvidenceCollectorStatus = (
  profile: FrozenResearchProfile,
  previous?: ForwardEvidenceCollectorStatus
): ForwardEvidenceCollectorStatus => ({
  profileId: profile.profileId,
  profileVersion: profile.profileVersion,
  state: previous?.state ?? "waiting_for_closed_candle",
  subscriptionActive: previous?.subscriptionActive ?? false,
  processedClosedCandles: previous?.processedClosedCandles ?? 0,
  issuedObservations: previous?.issuedObservations ?? 0,
  resolvedOutcomes: previous?.resolvedOutcomes ?? 0,
  lastProcessedAt: previous?.lastProcessedAt,
  lastCandleTimestamp: previous?.lastCandleTimestamp,
  lastSourceFingerprint: previous?.lastSourceFingerprint,
  lastHistoryCandleCount: previous?.lastHistoryCandleCount ?? 0,
  blockerReason: previous?.blockerReason,
  authority: FORWARD_EVIDENCE_AUTHORITY
});

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const loadForwardEvidenceCollectorStatuses = (): Partial<
  Record<ForwardEvidenceProfileId, ForwardEvidenceCollectorStatus>
> => {
  if (!isBrowser()) return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FORWARD_EVIDENCE_COLLECTOR_STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const saveForwardEvidenceCollectorStatus = (status: ForwardEvidenceCollectorStatus) => {
  if (!isBrowser()) return status;
  const statuses = { ...loadForwardEvidenceCollectorStatuses(), [status.profileId]: status };
  window.localStorage.setItem(FORWARD_EVIDENCE_COLLECTOR_STORAGE_KEY, JSON.stringify(statuses));
  window.dispatchEvent(new CustomEvent(FORWARD_EVIDENCE_COLLECTOR_UPDATED_EVENT, { detail: status }));
  return status;
};
