import {
  buildRuntimeCandlePayloadHash,
  buildRuntimeSourceIdentity,
  continuousFeedAuthority,
  normalizeRuntimeCandleResponse,
  normalizeRuntimeTimeframe,
  stableHash
} from "./gotrader-continuous-feed-core.mjs";

export const HISTORICAL_CONTEXT_HYDRATOR_VERSION =
  "gotrader-historical-context-hydrator-v1";

export const defaultHistoricalContextHydrationPolicy = Object.freeze({
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  requiredTimeframes: Object.freeze(["5m", "15m", "1h", "4h", "1d"]),
  minimumClosedCandlesByTimeframe: Object.freeze({
    "5m": 5,
    "15m": 5,
    "1h": 5,
    "4h": 5,
    "1d": 5
  }),
  maximumCandlesPerTimeframe: 300
});

const unique = (values) => [...new Set(values.filter(Boolean))];

export function buildHistoricalContextHydrationArtifact({
  candlePayloads = [],
  asOfUtc,
  timeContractVersion = "unknown",
  timeContractIdentityVersion,
  timeContract,
  policy = defaultHistoricalContextHydrationPolicy,
  generatedAtUtc = new Date().toISOString()
} = {}) {
  const asOfMs = Date.parse(String(asOfUtc ?? ""));
  const blockers = [];
  if (!Number.isFinite(asOfMs)) blockers.push("hydration_as_of_time_invalid");
  const payloadsByTimeframe = new Map(
    candlePayloads.map((payload) => [
      normalizeRuntimeTimeframe(
        payload?.timeframe ?? payload?.requestedTimeframe
      ),
      payload
    ])
  );
  const summaries = [];
  for (const timeframe of policy.requiredTimeframes) {
    const payload = payloadsByTimeframe.get(timeframe);
    const normalized = normalizeRuntimeCandleResponse(
      payload,
      generatedAtUtc,
      timeContract
    );
    const maximum = Math.max(
      1,
      Number(policy.maximumCandlesPerTimeframe ?? 300)
    );
    const closedCandles = normalized.candles
      .filter(
        (candle) =>
          Number.isFinite(asOfMs) &&
          Date.parse(candle.candleCloseTime) <= asOfMs
      )
      .slice(-maximum);
    const required = Math.max(
      1,
      Number(policy.minimumClosedCandlesByTimeframe?.[timeframe] ?? 1)
    );
    if (closedCandles.length < required) {
      blockers.push(
        `historical_context_hydration_insufficient:${timeframe}:${closedCandles.length}/${required}`
      );
    }
    const sourceFingerprint = buildRuntimeSourceIdentity({
      sourceProvider: "mt5_read_only",
      requestedSymbol: policy.requestedSymbol,
      brokerSymbol: policy.brokerSymbol,
      timeframe,
      timeContractVersion:
        timeContractIdentityVersion ?? timeContractVersion
    });
    const checksum = `sha256:${stableHash(
      closedCandles.map((candle) => ({
        candleOpenTime: candle.candleOpenTime,
        candleCloseTime: candle.candleCloseTime,
        payloadHash: buildRuntimeCandlePayloadHash(candle)
      }))
    )}`;
    summaries.push(
      Object.freeze({
        timeframe,
        sourceProvider: "mt5_read_only",
        requestedSymbol: policy.requestedSymbol,
        brokerSymbol: policy.brokerSymbol,
        sourceFingerprint,
        candleCount: closedCandles.length,
        requiredCandleCount: required,
        firstCandleTime: closedCandles.at(0)?.candleOpenTime,
        lastCandleTime: closedCandles.at(-1)?.candleCloseTime,
        checksum,
        ready: closedCandles.length >= required
      })
    );
  }
  const compactBlockers = unique(blockers);
  const deterministicCore = {
    version: HISTORICAL_CONTEXT_HYDRATOR_VERSION,
    status: compactBlockers.length ? "blocked" : "ready",
    asOfUtc,
    sourceProvider: "mt5_read_only",
    requestedSymbol: policy.requestedSymbol,
    brokerSymbol: policy.brokerSymbol,
    timeContractVersion,
    timeContractIdentityVersion:
      timeContractIdentityVersion ?? timeContractVersion,
    timeframeSummaries: summaries,
    blockers: compactBlockers,
    historicalEligible: false,
    boundedHistoricalContextEligible: compactBlockers.length === 0,
    historicalDstPolicyVerified: false,
    rawCandlesPersisted: false,
    productionAdoptionAllowed: false,
    ...continuousFeedAuthority
  };
  return Object.freeze({
    ...deterministicCore,
    hydrationFingerprint: `sha256:${stableHash(deterministicCore)}`,
    generatedAtUtc
  });
}

export function validateHistoricalContextHydrationArtifact(artifact) {
  const errors = [];
  if (artifact?.version !== HISTORICAL_CONTEXT_HYDRATOR_VERSION) {
    errors.push("hydration_version_invalid");
  }
  if (!["ready", "blocked"].includes(artifact?.status)) {
    errors.push("hydration_status_invalid");
  }
  if (artifact?.historicalEligible !== false) {
    errors.push("historical_eligibility_must_remain_false");
  }
  if (artifact?.historicalDstPolicyVerified !== false) {
    errors.push("historical_dst_policy_must_remain_unverified");
  }
  if (artifact?.rawCandlesPersisted !== false) {
    errors.push("raw_candle_persistence_must_be_false");
  }
  if (
    artifact?.executionAuthority !== "none" ||
    artifact?.brokerAuthority !== "none" ||
    artifact?.readinessOverrideAuthority !== "none"
  ) {
    errors.push("hydration_authority_not_none");
  }
  const serialized = JSON.stringify(artifact).toLowerCase();
  for (const forbidden of [
    "\"candles\"",
    "\"account\"",
    "\"order\"",
    "\"position\"",
    "\"password\"",
    "\"token\""
  ]) {
    if (serialized.includes(forbidden)) {
      errors.push(`hydration_forbidden_field:${forbidden}`);
    }
  }
  return Object.freeze({
    valid: errors.length === 0,
    errors: unique(errors)
  });
}
