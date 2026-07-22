import { createV2SourceIdentity } from "../identity/v2Identity";
import type { V2SourceIdentity } from "../identity/v2IdentityTypes";
import {
  createV2TimeNormalizationPolicy,
  normalizeMt5ProviderTime,
  proveV2CandleClosure,
  validateV2TrustedReferenceClock
} from "../time/v2TimeNormalization";
import {
  policyFromCurrentLiveV2Mt5TimeContract,
  validateV2Mt5UpstreamTimeContract
} from "../time/v2Mt5UpstreamTimeContract";
import type { V2Mt5ReadOnlyTimeContract } from "../time/v2Mt5UpstreamTimeContractTypes";
import type {
  V2TimeDiagnosticCode,
  V2TimeNormalizationAudit,
  V2TimeNormalizationPolicy
} from "../time/v2TimeNormalizationTypes";
import {
  V2CandleRepositoryError,
  type V2CandleRepository,
  type V2LegacyCandleLike,
  type V2LegacyCandleSourceSnapshot,
  type V2SourceTimeEligibility
} from "./v2CandleTypes";
import { createV2StaticCandleRepository } from "./v2StaticCandleRepository";
import { v2TimeframeMilliseconds } from "./v2Timeframe";

export const V2_MT5_TIME_NORMALIZED_ADAPTER_ID = "mt5-read-only-time-normalized-snapshot";
export const V2_MT5_TIME_NORMALIZED_ADAPTER_VERSION = "gotrader-v2-mt5-time-normalized-adapter-v1";
const CURRENT_LIVE_OBSERVATION_MAX_AGE_MS = 120_000;

export interface V2Mt5TimeNormalizedFeedSnapshot {
  feedId: string;
  requestedSymbol: string;
  brokerSymbol?: string;
  symbol: string;
  timeframe: string;
  candleFingerprint?: string;
  candles: readonly V2LegacyCandleLike[];
  connectionStatus: "connected" | "degraded" | "disconnected" | "error" | "planned";
  receivedAt?: string;
  providerClockUtc?: string;
  warnings?: readonly string[];
  timeContract?: Readonly<V2Mt5ReadOnlyTimeContract>;
  timePolicy?: V2TimeNormalizationPolicy;
}

const freezeCodes = (values: readonly V2TimeDiagnosticCode[]) =>
  Object.freeze([...new Set(values)]);

const freezeText = (values: readonly string[]) => Object.freeze([...new Set(values)]);

export function createV2SourceIdentityFromTimeNormalizedMt5Feed(
  feed: V2Mt5TimeNormalizedFeedSnapshot
): Readonly<V2SourceIdentity> {
  if (!feed.candleFingerprint) {
    throw new V2CandleRepositoryError(
      "source_identity_mismatch",
      "Time-normalized MT5 V2 snapshot requires the unchanged compatibility candle fingerprint."
    );
  }
  return createV2SourceIdentity({
    sourceId: feed.feedId,
    provider: "mt5_read_only",
    requestedSymbol: feed.requestedSymbol,
    brokerSymbol: feed.brokerSymbol ?? feed.symbol,
    sourceFingerprint: feed.candleFingerprint,
    sourceKind: "mt5_read_only"
  });
}

export function mt5TimeNormalizedFeedToV2Snapshot({
  feed,
  systemUtc
}: {
  feed: V2Mt5TimeNormalizedFeedSnapshot;
  systemUtc: string;
}): V2LegacyCandleSourceSnapshot {
  const contractValidation = validateV2Mt5UpstreamTimeContract(feed.timeContract);
  const contract = contractValidation.contract;
  const capturedAtMs = Date.parse(contract?.terminalProbeCapturedAt ?? "invalid");
  const systemUtcMs = Date.parse(systemUtc);
  const currentLiveObservationFresh = Number.isFinite(capturedAtMs) &&
    Number.isFinite(systemUtcMs) &&
    systemUtcMs >= capturedAtMs - 5_000 &&
    systemUtcMs - capturedAtMs <= CURRENT_LIVE_OBSERVATION_MAX_AGE_MS;
  const currentLiveEligible = contractValidation.status === "accepted" &&
    contract?.currentLiveTimeBasisVerified === true &&
    currentLiveObservationFresh;
  const currentLivePolicy = currentLiveEligible && contract
    ? policyFromCurrentLiveV2Mt5TimeContract(contract)
    : undefined;
  const policy = contractValidation.policy ?? currentLivePolicy ?? createV2TimeNormalizationPolicy({
    policyId: feed.timeContract?.contractId ?? "gotrader-v2-mt5-upstream-time-contract-unverified",
    version: feed.timeContract?.version ?? "0",
    provider: "mt5_read_only",
    basis: "unknown",
    outputTimezone: "UTC",
    discoveryMethod: "unknown",
    dstPolicy: "unknown",
    maximumClockSkewMs: 60_000,
    closureToleranceMs: 1_000
  });
  const receivedAt = feed.receivedAt ?? systemUtc;
  const trustedClock = validateV2TrustedReferenceClock({
    maximumClockSkewMs: policy.maximumClockSkewMs,
    providerUtc: feed.providerClockUtc,
    receivedAtUtc: receivedAt,
    systemUtc
  });
  const timeframeMs = v2TimeframeMilliseconds(feed.timeframe);
  let blockedNormalizationCount = 0;
  let unclosedCount = 0;
  const candles = feed.candles.map((candle): V2LegacyCandleLike => {
    const rawProviderOpenTime = candle.rawProviderTime ?? candle.openTime ?? candle.timestamp ?? "missing";
    const rawProviderCloseTime = candle.rawProviderCloseTime;
    const normalizedOpen = normalizeMt5ProviderTime(rawProviderOpenTime, policy);
    const normalizedProviderClose = rawProviderCloseTime === undefined
      ? undefined
      : normalizeMt5ProviderTime(rawProviderCloseTime, policy);
    const closure = proveV2CandleClosure({
      closureToleranceMs: policy.closureToleranceMs,
      explicitProviderClosed: candle.isClosed ?? candle.closed,
      normalizedOpenTimeUtc: normalizedOpen.normalizedTimeUtc,
      timeframeMs,
      trustedClock
    });
    const warnings = [...normalizedOpen.warnings, ...(normalizedProviderClose?.warnings ?? [])];
    const blockers = [
      ...normalizedOpen.blockers,
      ...(normalizedProviderClose?.blockers ?? []),
      ...closure.blockers
    ];
    if (
      normalizedProviderClose?.normalizedTimeUtc &&
      closure.normalizedCloseTimeUtc &&
      normalizedProviderClose.normalizedTimeUtc !== closure.normalizedCloseTimeUtc
    ) {
      blockers.push("policy_mismatch");
    }
    const hardTimeBlock = normalizedOpen.status === "blocked" ||
      normalizedProviderClose?.status === "blocked" ||
      trustedClock.status === "blocked" ||
      blockers.includes("policy_mismatch");
    if (hardTimeBlock) blockedNormalizationCount += 1;
    if (closure.status !== "closed") unclosedCount += 1;
    const timeAudit: Readonly<V2TimeNormalizationAudit> = Object.freeze({
      rawProviderOpenTime,
      rawProviderCloseTime,
      normalizedOpenTimeUtc: normalizedOpen.normalizedTimeUtc,
      normalizedCloseTimeUtc: closure.normalizedCloseTimeUtc,
      providerTimeBasis: policy.basis,
      timeNormalizationPolicyId: policy.policyId,
      timeNormalizationPolicyVersion: policy.version,
      sourceTimezone: policy.sourceTimezone,
      offsetAppliedMinutes: normalizedOpen.offsetAppliedMinutes,
      rawToUtcDeltaMs: normalizedOpen.rawToUtcDeltaMs,
      dstState: normalizedOpen.dstState,
      receivedAt,
      closureStatus: closure.status,
      warnings: freezeText(warnings),
      blockers: freezeCodes(blockers)
    });
    return Object.freeze({
      openTime: normalizedOpen.normalizedTimeUtc ?? "invalid",
      closeTime: closure.normalizedCloseTimeUtc ?? "invalid",
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: candle.volume === undefined ? undefined : Number(candle.volume),
      isClosed: hardTimeBlock
        ? undefined
        : closure.status === "closed"
        ? true
        : closure.status === "blocked"
          ? undefined
          : false,
      providerTime: String(rawProviderOpenTime),
      receivedAt,
      rawProviderTime: rawProviderOpenTime,
      rawProviderCloseTime,
      timeAudit
    });
  });
  const timeWarnings = [
    ...(feed.warnings ?? []),
    ...contractValidation.warnings,
    ...contractValidation.blockers.map((blocker) => `MT5 upstream time contract blocker: ${blocker}.`),
    ...(blockedNormalizationCount
      ? [`${blockedNormalizationCount} MT5 candle timestamp(s) could not be normalized under ${policy.policyId}@${policy.version}.`]
      : []),
    ...(unclosedCount ? [`${unclosedCount} candle(s) did not pass normalized close-time proof.`] : []),
    ...(trustedClock.status === "blocked" ? ["The trusted UTC reference-clock check failed closed."] : [])
  ];
  const timeEligibility: Readonly<V2SourceTimeEligibility> = Object.freeze({
    currentLiveEligible,
    historicalEligible: contractValidation.phase2Eligible,
    verificationScope: contract?.timeVerificationScope ?? "none",
    ...(Number.isFinite(capturedAtMs) ? {
      verifiedAtUtc: new Date(capturedAtMs).toISOString(),
      currentLiveValidUntilUtc: new Date(capturedAtMs + CURRENT_LIVE_OBSERVATION_MAX_AGE_MS).toISOString(),
      offsetRegimeStartUtc: new Date(capturedAtMs).toISOString()
    } : {}),
    blockers: freezeText([
      ...contractValidation.blockers,
      ...(!contractValidation.phase2Eligible && !currentLiveEligible
        ? [currentLiveObservationFresh ? "current_live_time_contract_ineligible" : "current_live_terminal_observation_stale"]
        : [])
    ]),
    warnings: freezeText(contractValidation.warnings)
  });
  return Object.freeze({
    identity: createV2SourceIdentityFromTimeNormalizedMt5Feed(feed),
    timeframe: feed.timeframe,
    candles: Object.freeze(candles),
    closurePolicy: "explicit_closed" as const,
    stale: feed.connectionStatus !== "connected" ||
      trustedClock.status === "blocked" ||
      blockedNormalizationCount > 0 ||
      (!contractValidation.phase2Eligible && !currentLiveEligible),
    warnings: freezeText(timeWarnings),
    providerTimeBasis: policy.basis,
    timeNormalizationPolicyId: policy.policyId,
    timeNormalizationPolicyVersion: policy.version,
    timeContractId: feed.timeContract?.contractId,
    timeContractVersion: feed.timeContract?.version,
    timeContractVerificationStatus: feed.timeContract?.verificationStatus ?? "unknown",
    terminalClockClassificationVersion: feed.timeContract?.terminalClockClassificationVersion,
    timeVerificationScope: feed.timeContract?.timeVerificationScope,
    timeEligibility
  });
}

export function createV2Mt5TimeNormalizedRepository({
  asOf,
  loadFeed
}: {
  asOf?: () => string;
  loadFeed: (source: V2SourceIdentity) => Promise<V2Mt5TimeNormalizedFeedSnapshot | undefined>;
}): V2CandleRepository {
  const systemUtc = asOf ?? (() => new Date().toISOString());
  return createV2StaticCandleRepository({
    adapterId: V2_MT5_TIME_NORMALIZED_ADAPTER_ID,
    adapterVersion: V2_MT5_TIME_NORMALIZED_ADAPTER_VERSION,
    asOf: systemUtc,
    async loadSource(source) {
      const feed = await loadFeed(source);
      return feed ? mt5TimeNormalizedFeedToV2Snapshot({ feed, systemUtc: systemUtc() }) : undefined;
    }
  });
}
