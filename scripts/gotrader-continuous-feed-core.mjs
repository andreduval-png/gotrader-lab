import crypto from "node:crypto";

export const continuousFeedAuthority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

export const continuousFeedCapability = Object.freeze({
  marketDataCapability: "read_only"
});

export const CONTINUOUS_FEED_SERVICE_VERSION = "gotrader-continuous-feed-v1";
export const RUNTIME_MARKET_EVENT_VERSION = "gotrader-runtime-market-event-v1";

export const defaultRollingStoreCapacities = Object.freeze({
  "1m": 2_000,
  "5m": 2_000,
  "15m": 1_500,
  "1h": 1_000,
  "4h": 750,
  "1d": 500,
  "1w": 260
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

export const stableHash = (value) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");

const finiteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

export function normalizeRuntimeTimeframe(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const aliases = {
    m1: "1m",
    m5: "5m",
    m15: "15m",
    h1: "1h",
    h4: "4h",
    d1: "1d",
    w1: "1w"
  };
  return aliases[normalized] ?? normalized;
}

export function runtimeTimeframeMilliseconds(value) {
  const timeframe = normalizeRuntimeTimeframe(value);
  const match = timeframe.match(/^(\d+)(m|h|d|w)$/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const multiplier =
    match[2] === "m"
      ? 60_000
      : match[2] === "h"
        ? 3_600_000
        : match[2] === "d"
          ? 86_400_000
          : 604_800_000;
  return amount * multiplier;
}

const isoTime = (value) => {
  const parsed =
    typeof value === "number"
      ? new Date(value > 10_000_000_000 ? value : value * 1_000)
      : new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
};

export function buildRuntimeSourceIdentity({
  sourceProvider = "mt5_read_only",
  requestedSymbol,
  brokerSymbol,
  timeframe,
  timeContractVersion
}) {
  return `sha256:${stableHash({
    sourceProvider,
    requestedSymbol,
    brokerSymbol,
    timeframe: timeframe ? normalizeRuntimeTimeframe(timeframe) : undefined,
    timeContractVersion: timeContractVersion || "unknown"
  })}`;
}

export function buildRuntimeCandleIdentity({
  sourceIdentity,
  requestedSymbol,
  brokerSymbol,
  timeframe,
  candleOpenTime,
  candleCloseTime
}) {
  return `sha256:${stableHash({
    sourceIdentity,
    requestedSymbol,
    brokerSymbol,
    timeframe: normalizeRuntimeTimeframe(timeframe),
    candleOpenTime,
    candleCloseTime
  })}`;
}

export function buildRuntimeCandlePayloadHash(candle) {
  return `sha256:${stableHash({
    open: finiteNumber(candle?.open),
    high: finiteNumber(candle?.high),
    low: finiteNumber(candle?.low),
    close: finiteNumber(candle?.close),
    volume: finiteNumber(candle?.volume),
    tickVolume: finiteNumber(candle?.tickVolume),
    spread: finiteNumber(candle?.spread)
  })}`;
}

export function evaluateRuntimeTimeContract(
  contract,
  {
    requireVerificationArtifact = false,
    nowUtc = new Date().toISOString()
  } = {}
) {
  const version = String(contract?.version ?? contract?.wrapperContractVersion ?? "unknown");
  const artifactId = String(contract?.timeVerificationArtifactId ?? "");
  const generatedAtUtc =
    contract?.timeVerificationGeneratedAtUtc ?? contract?.terminalProbeCapturedAt;
  const expiresAtUtc = contract?.timeVerificationExpiresAtUtc;
  const generatedMs = Date.parse(generatedAtUtc ?? "");
  const nowMs = Date.parse(nowUtc);
  const proofAgeSeconds =
    Number.isFinite(generatedMs) && Number.isFinite(nowMs)
      ? Math.max(0, Math.round((nowMs - generatedMs) / 1_000))
      : undefined;
  const derivedProofState =
    proofAgeSeconds === undefined || nowMs < generatedMs - 5_000
      ? "conflicting"
      : proofAgeSeconds <= 120
        ? "fresh"
        : proofAgeSeconds <= 180
          ? "expiring"
          : "stale";
  const proofState = contract?.timeVerificationProofState ?? derivedProofState;
  const currentLiveVerified =
    contract?.currentLiveTimeBasisVerified === true ||
    (contract?.verificationStatus === "verified" &&
      contract?.providerTimeBasis &&
      contract.providerTimeBasis !== "unknown");
  const stale =
    contract?.terminalEvidenceStatus === "stale" ||
    (Array.isArray(contract?.terminalProbeBlockers) &&
      contract.terminalProbeBlockers.some((item) => String(item).includes("stale")));
  const blockers = [];
  if (!currentLiveVerified) blockers.push("current_live_time_basis_not_verified");
  if (stale) blockers.push("terminal_time_evidence_stale");
  if (requireVerificationArtifact) {
    if (!artifactId) blockers.push("current_live_verification_artifact_missing");
    if (contract?.timeVerificationScope !== "current_live") {
      blockers.push("current_live_verification_scope_invalid");
    }
    if (proofState !== "fresh") blockers.push(`current_live_proof_${proofState}`);
    if (
      !generatedAtUtc ||
      !expiresAtUtc ||
      !Number.isFinite(Date.parse(expiresAtUtc))
    ) {
      blockers.push("current_live_verification_expiry_missing");
    }
  }
  return {
    eligible: currentLiveVerified && !stale && blockers.length === 0,
    version,
    artifactId: artifactId || undefined,
    verificationScope: contract?.timeVerificationScope ?? "none",
    generatedAtUtc,
    expiresAtUtc,
    proofState,
    proofAgeSeconds,
    terminalClockClassificationVersion:
      contract?.terminalClockClassificationVersion,
    providerTimeBasis: contract?.providerTimeBasis ?? "unknown",
    observedOffsetMinutes: finiteNumber(
      contract?.terminalObservedOffsetMinutes ?? contract?.observedOffsetMinutes
    ),
    blockers
  };
}

export function normalizeRuntimeQuote(payload, receivedAt = new Date().toISOString()) {
  const requestedSymbol = String(payload?.requestedSymbol ?? "MNQ");
  const brokerSymbol = String(payload?.brokerSymbol ?? payload?.symbol ?? "USTECH");
  const observedMarketTime =
    isoTime(payload?.timestamp ?? payload?.serverTimestamp ?? payload?.rawTime) ?? receivedAt;
  const bid = finiteNumber(payload?.bid);
  const ask = finiteNumber(payload?.ask);
  const mid =
    finiteNumber(payload?.mid) ??
    (bid !== undefined && ask !== undefined ? Number(((bid + ask) / 2).toFixed(8)) : undefined);
  return {
    requestedSymbol,
    brokerSymbol,
    observedMarketTime,
    bid,
    ask,
    mid,
    spread: finiteNumber(payload?.spread),
    receivedAt
  };
}

export function normalizeRuntimeCandleResponse(payload, receivedAt = new Date().toISOString()) {
  const requestedSymbol = String(payload?.requestedSymbol ?? "MNQ");
  const brokerSymbol = String(payload?.brokerSymbol ?? payload?.symbol ?? "USTECH");
  const timeframe = normalizeRuntimeTimeframe(payload?.timeframe ?? payload?.requestedTimeframe);
  const durationMs = runtimeTimeframeMilliseconds(timeframe);
  if (!durationMs) {
    return {
      requestedSymbol,
      brokerSymbol,
      timeframe,
      candles: [],
      blockers: ["unsupported_timeframe"]
    };
  }
  const candles = (Array.isArray(payload?.candles) ? payload.candles : [])
    .map((candle) => {
      const candleOpenTime = isoTime(candle?.timestamp ?? candle?.time ?? candle?.rawTime);
      const open = finiteNumber(candle?.open);
      const high = finiteNumber(candle?.high);
      const low = finiteNumber(candle?.low);
      const close = finiteNumber(candle?.close);
      if (
        !candleOpenTime ||
        open === undefined ||
        high === undefined ||
        low === undefined ||
        close === undefined ||
        high < Math.max(open, close) ||
        low > Math.min(open, close)
      ) {
        return undefined;
      }
      return {
        candleOpenTime,
        candleCloseTime: new Date(Date.parse(candleOpenTime) + durationMs).toISOString(),
        open,
        high,
        low,
        close,
        volume: finiteNumber(candle?.volume),
        tickVolume: finiteNumber(candle?.tickVolume),
        spread: finiteNumber(candle?.spread),
        receivedAt
      };
    })
    .filter(Boolean)
    .sort((left, right) => Date.parse(left.candleOpenTime) - Date.parse(right.candleOpenTime));
  return {
    requestedSymbol,
    brokerSymbol,
    timeframe,
    candles,
    blockers: candles.length ? [] : ["candle_data_unavailable"]
  };
}

const boundedUnique = (values, maximum) =>
  [...new Set(values.filter(Boolean))].slice(-Math.max(1, maximum));

const seriesKeyFor = ({ requestedSymbol, brokerSymbol, timeframe }) =>
  `${requestedSymbol}:${brokerSymbol}:${normalizeRuntimeTimeframe(timeframe)}`;

const eventBase = ({
  eventId,
  type,
  sourceIdentity,
  requestedSymbol,
  brokerSymbol,
  timeframe,
  observedMarketTime,
  receivedAt,
  timeContractVersion,
  timeVerificationArtifactId
}) => ({
  eventId,
  eventVersion: RUNTIME_MARKET_EVENT_VERSION,
  type,
  sourceProvider: "mt5_read_only",
  sourceIdentity,
  requestedSymbol,
  brokerSymbol,
  ...(timeframe ? { timeframe } : {}),
  observedMarketTime,
  receivedAt,
  sourceFingerprint: sourceIdentity,
  timeContractVersion,
  ...(timeVerificationArtifactId ? { timeVerificationArtifactId } : {}),
  ...continuousFeedCapability,
  ...continuousFeedAuthority
});

export function createContinuousFeedEngine({
  capacities = defaultRollingStoreCapacities,
  checkpoint,
  knownEvents = [],
  maximumCloseEventIds = 5_000,
  maximumCatchUpCandles = 24,
  requireVerificationArtifact = false
} = {}) {
  const stores = new Map();
  const formingHashes = new Map();
  const knownEventIds = new Set([
    ...(checkpoint?.emittedCloseEventIds ?? []),
    ...knownEvents
      .filter((event) => event?.type === "candle_closed")
      .map((event) => event.eventId)
  ]);
  const closedPayloadHashes = new Map(
    Object.entries(checkpoint?.closedPayloadHashesByIdentity ?? {})
  );
  const conflictingIdentities = new Set(checkpoint?.conflictingCandleIdentities ?? []);
  const rejectedCloseIdentities = new Set(
    checkpoint?.rejectedCloseIdentities ?? []
  );
  const establishedSeries = new Set(checkpoint?.establishedSeries ?? []);
  const lastClosedBySeries = new Map(
    Object.entries(checkpoint?.lastClosedBySeries ?? {})
  );
  let quote;
  let lastEligibility = checkpoint?.lastTimeContractEligible === true;
  let timeContractStateObserved = checkpoint?.timeContractStateObserved === true;
  let stale = checkpoint?.feedStale === true;
  let emittedCloseEventCount = Number(checkpoint?.emittedCloseEventCount ?? 0);
  let duplicateCloseEventCount = Number(checkpoint?.duplicateCloseEventCount ?? 0);
  let conflictingCandleCount = Number(checkpoint?.conflictingCandleCount ?? 0);
  let recoveredEventCount = Number(checkpoint?.recoveredEventCount ?? 0);
  let quoteUpdateCount = Number(checkpoint?.quoteUpdateCount ?? 0);
  let formingCandleUpdateCount = Number(
    checkpoint?.formingCandleUpdateCount ?? 0
  );
  let rejectedCloseEventCount = Number(
    checkpoint?.rejectedCloseEventCount ?? 0
  );
  let lastRejectedClose;
  let lastFormingCandleUpdate;
  let lastClosedCandleEvent;
  let latestTimeContract = evaluateRuntimeTimeContract(undefined, {
    requireVerificationArtifact
  });
  const blockers = new Set();
  const warnings = new Set();

  const status = () => ({
    serviceVersion: CONTINUOUS_FEED_SERVICE_VERSION,
    state: stale
      ? "stale"
      : blockers.size
        ? "blocked"
        : latestTimeContract.eligible
          ? "healthy"
          : "degraded",
    activeSymbols: boundedUnique(
      [...stores.keys()].map((key) => key.split(":")[1]),
      32
    ),
    activeTimeframes: boundedUnique(
      [...stores.keys()].map((key) => key.split(":")[2]),
      32
    ),
    lastQuoteTime: quote?.observedMarketTime,
    lastFormingCandleUpdate,
    lastClosedCandleEvent,
    rollingStoreCounts: Object.fromEntries(
      [...stores.entries()].map(([key, candles]) => [key, candles.length])
    ),
    emittedCloseEventCount,
    duplicateCloseEventCount,
    conflictingCandleCount,
    recoveredEventCount,
    quoteUpdateCount,
    formingCandleUpdateCount,
    rejectedCloseEventCount,
    lastRejectedClose,
    timeContractEligible: latestTimeContract.eligible,
    timeContractVersion: latestTimeContract.version,
    verificationArtifactRequired: requireVerificationArtifact,
    verificationArtifactId: latestTimeContract.artifactId,
    verificationScope: latestTimeContract.verificationScope,
    verificationGeneratedAtUtc: latestTimeContract.generatedAtUtc,
    verificationExpiresAtUtc: latestTimeContract.expiresAtUtc,
    verificationProofState: latestTimeContract.proofState,
    verificationProofAgeSeconds: latestTimeContract.proofAgeSeconds,
    providerTimeBasis: latestTimeContract.providerTimeBasis,
    observedOffsetMinutes: latestTimeContract.observedOffsetMinutes,
    terminalClockClassificationVersion:
      latestTimeContract.terminalClockClassificationVersion,
    blockers: [...blockers],
    warnings: [...warnings],
    ...continuousFeedCapability,
    ...continuousFeedAuthority
  });

  const checkpointSnapshot = () => ({
    version: 1,
    establishedSeries: [...establishedSeries],
    lastClosedBySeries: Object.fromEntries(lastClosedBySeries),
    emittedCloseEventIds: boundedUnique([...knownEventIds], maximumCloseEventIds),
    closedPayloadHashesByIdentity: Object.fromEntries(
      [...closedPayloadHashes.entries()].slice(-maximumCloseEventIds)
    ),
    conflictingCandleIdentities: boundedUnique(
      [...conflictingIdentities],
      maximumCloseEventIds
    ),
    rejectedCloseIdentities: boundedUnique(
      [...rejectedCloseIdentities],
      maximumCloseEventIds
    ),
    lastTimeContractEligible: latestTimeContract.eligible,
    lastTimeVerificationArtifactId: latestTimeContract.artifactId,
    timeContractStateObserved,
    feedStale: stale,
    emittedCloseEventCount,
    duplicateCloseEventCount,
    conflictingCandleCount,
    recoveredEventCount,
    quoteUpdateCount,
    formingCandleUpdateCount,
    rejectedCloseEventCount,
    checkpointedAt: new Date().toISOString(),
    ...continuousFeedAuthority
  });

  const createStateEvent = ({
    type,
    reason,
    receivedAt,
    sourceIdentity,
    requestedSymbol = "MNQ",
    brokerSymbol = "USTECH",
    timeframe
  }) => {
    const observedMarketTime = quote?.observedMarketTime ?? receivedAt;
    const eventId = `runtime_${type}_${stableHash({
      type,
      reason,
      sourceIdentity,
      requestedSymbol,
      brokerSymbol,
      timeframe,
      eligibility: latestTimeContract.eligible
    })}`;
    return {
      ...eventBase({
        eventId,
        type,
        sourceIdentity,
        requestedSymbol,
        brokerSymbol,
        timeframe,
        observedMarketTime,
        receivedAt,
        timeContractVersion: latestTimeContract.version,
        timeVerificationArtifactId: latestTimeContract.artifactId
      }),
      reason
    };
  };

  const processPoll = ({
    quotePayload,
    candlePayloads = [],
    timeContract,
    receivedAt = new Date().toISOString()
  }) => {
    const eligibilityBeforePoll = latestTimeContract.eligible;
    latestTimeContract = evaluateRuntimeTimeContract(timeContract, {
      requireVerificationArtifact,
      nowUtc: receivedAt
    });
    const eligibilityRecoveredThisPoll =
      latestTimeContract.eligible &&
      timeContractStateObserved &&
      !eligibilityBeforePoll;
    const events = [];
    const nextQuote = normalizeRuntimeQuote(quotePayload, receivedAt);
    const quoteChanged =
      !quote ||
      quote.observedMarketTime !== nextQuote.observedMarketTime ||
      quote.bid !== nextQuote.bid ||
      quote.ask !== nextQuote.ask;
    quote = nextQuote;
    const quoteSourceIdentity = buildRuntimeSourceIdentity({
      requestedSymbol: quote.requestedSymbol,
      brokerSymbol: quote.brokerSymbol,
      timeContractVersion: latestTimeContract.version
    });
    if (quoteChanged) {
      quoteUpdateCount += 1;
      events.push({
        ...eventBase({
          eventId: `runtime_quote_${stableHash({
            sourceIdentity: quoteSourceIdentity,
            observedMarketTime: quote.observedMarketTime,
            bid: quote.bid,
            ask: quote.ask
          })}`,
          type: "quote_updated",
          sourceIdentity: quoteSourceIdentity,
          requestedSymbol: quote.requestedSymbol,
          brokerSymbol: quote.brokerSymbol,
          observedMarketTime: quote.observedMarketTime,
          receivedAt,
          timeContractVersion: latestTimeContract.version,
          timeVerificationArtifactId: latestTimeContract.artifactId
        }),
        bid: quote.bid,
        ask: quote.ask,
        mid: quote.mid
      });
    }

    if (!latestTimeContract.eligible) {
      for (const blocker of latestTimeContract.blockers) blockers.add(blocker);
      warnings.add("closed_candle_events_paused_until_time_contract_is_verified");
      if (!timeContractStateObserved || lastEligibility) {
        events.push(
          createStateEvent({
            type: "source_blocked",
            reason: latestTimeContract.blockers.join(","),
            receivedAt,
            sourceIdentity: quoteSourceIdentity
          })
        );
      }
    } else {
      for (const blocker of latestTimeContract.blockers) blockers.delete(blocker);
      blockers.delete("current_live_time_basis_not_verified");
      blockers.delete("terminal_time_evidence_stale");
      warnings.delete("closed_candle_events_paused_until_time_contract_is_verified");
      if (!lastEligibility) {
        recoveredEventCount += 1;
        events.push(
          createStateEvent({
            type: "feed_recovered",
            reason: "current_live_time_contract_verified",
            receivedAt,
            sourceIdentity: quoteSourceIdentity
          })
        );
      }
    }
    lastEligibility = latestTimeContract.eligible;
    timeContractStateObserved = true;

    for (const payload of candlePayloads) {
      const normalized = normalizeRuntimeCandleResponse(payload, receivedAt);
      if (!normalized.timeframe || normalized.blockers.length) {
        for (const blocker of normalized.blockers) blockers.add(blocker);
        continue;
      }
      const key = seriesKeyFor(normalized);
      const capacity = Number(capacities[normalized.timeframe] ?? 500);
      const existing = stores.get(key) ?? [];
      const mergedByOpenTime = new Map(
        [...existing, ...normalized.candles].map((candle) => [
          candle.candleOpenTime,
          candle
        ])
      );
      const merged = [...mergedByOpenTime.values()]
        .sort((left, right) => Date.parse(left.candleOpenTime) - Date.parse(right.candleOpenTime))
        .slice(-Math.max(1, capacity));
      stores.set(key, merged);

      const sourceIdentity = buildRuntimeSourceIdentity({
        requestedSymbol: normalized.requestedSymbol,
        brokerSymbol: normalized.brokerSymbol,
        timeframe: normalized.timeframe,
        timeContractVersion: latestTimeContract.version
      });
      const marketReferenceMs = Date.parse(quote.observedMarketTime);
      const eligibleByMarketTime = merged.filter(
        (candle) =>
          Date.parse(candle.candleCloseTime) <= marketReferenceMs &&
          Date.parse(candle.candleOpenTime) <= marketReferenceMs
      );
      const closed = latestTimeContract.eligible
        ? eligibleByMarketTime
        : [];
      if (!latestTimeContract.eligible) {
        for (const candle of eligibleByMarketTime.slice(-maximumCatchUpCandles)) {
          const rejectedIdentity = `${key}:${candle.candleOpenTime}`;
          if (rejectedCloseIdentities.has(rejectedIdentity)) continue;
          rejectedCloseIdentities.add(rejectedIdentity);
          rejectedCloseEventCount += 1;
          lastRejectedClose = {
            candleOpenTime: candle.candleOpenTime,
            candleCloseTime: candle.candleCloseTime,
            timeframe: normalized.timeframe,
            reason: latestTimeContract.blockers.join(",")
          };
        }
      }
      const conflictEvents = [];
      for (const candle of closed) {
        const candleIdentity = buildRuntimeCandleIdentity({
          sourceIdentity,
          requestedSymbol: normalized.requestedSymbol,
          brokerSymbol: normalized.brokerSymbol,
          timeframe: normalized.timeframe,
          candleOpenTime: candle.candleOpenTime,
          candleCloseTime: candle.candleCloseTime
        });
        const payloadHash = buildRuntimeCandlePayloadHash(candle);
        const existingHash = closedPayloadHashes.get(candleIdentity);
        if (
          existingHash &&
          existingHash !== payloadHash &&
          !conflictingIdentities.has(candleIdentity)
        ) {
          conflictingIdentities.add(candleIdentity);
          conflictingCandleCount += 1;
          blockers.add("conflicting_closed_candle");
          conflictEvents.push(
            createStateEvent({
              type: "source_blocked",
              reason: "conflicting_closed_candle",
              receivedAt,
              sourceIdentity,
              requestedSymbol: normalized.requestedSymbol,
              brokerSymbol: normalized.brokerSymbol,
              timeframe: normalized.timeframe
            })
          );
        }
      }
      events.push(...conflictEvents);
      const forming = merged.find(
        (candle) => Date.parse(candle.candleCloseTime) > marketReferenceMs
      );

      if (forming) {
        const payloadHash = buildRuntimeCandlePayloadHash(forming);
        if (formingHashes.get(key) !== payloadHash) {
          formingCandleUpdateCount += 1;
          formingHashes.set(key, payloadHash);
          lastFormingCandleUpdate = receivedAt;
          events.push({
            ...eventBase({
              eventId: `runtime_forming_${stableHash({
                sourceIdentity,
                candleOpenTime: forming.candleOpenTime,
                payloadHash
              })}`,
              type: "forming_candle_updated",
              sourceIdentity,
              requestedSymbol: normalized.requestedSymbol,
              brokerSymbol: normalized.brokerSymbol,
              timeframe: normalized.timeframe,
              observedMarketTime: quote.observedMarketTime,
              receivedAt,
              timeContractVersion: latestTimeContract.version,
              timeVerificationArtifactId: latestTimeContract.artifactId
            }),
            candleOpenTime: forming.candleOpenTime,
            candleCloseTime: forming.candleCloseTime,
            payloadHash
          });
        }
      }

      if (!latestTimeContract.eligible || !closed.length) continue;

      if (!establishedSeries.has(key) || eligibilityRecoveredThisPoll) {
        const baseline = closed.at(-1);
        establishedSeries.add(key);
        lastClosedBySeries.set(key, baseline.candleOpenTime);
        for (const candle of closed.slice(-maximumCatchUpCandles)) {
          const candleIdentity = buildRuntimeCandleIdentity({
            sourceIdentity,
            requestedSymbol: normalized.requestedSymbol,
            brokerSymbol: normalized.brokerSymbol,
            timeframe: normalized.timeframe,
            candleOpenTime: candle.candleOpenTime,
            candleCloseTime: candle.candleCloseTime
          });
          closedPayloadHashes.set(
            candleIdentity,
            buildRuntimeCandlePayloadHash(candle)
          );
        }
        continue;
      }

      const previousOpenTime = lastClosedBySeries.get(key);
      const candidates = closed
        .filter(
          (candle) =>
            !previousOpenTime ||
            Date.parse(candle.candleOpenTime) > Date.parse(previousOpenTime)
        )
        .slice(-maximumCatchUpCandles);
      for (const candle of candidates) {
        const candleIdentity = buildRuntimeCandleIdentity({
          sourceIdentity,
          requestedSymbol: normalized.requestedSymbol,
          brokerSymbol: normalized.brokerSymbol,
          timeframe: normalized.timeframe,
          candleOpenTime: candle.candleOpenTime,
          candleCloseTime: candle.candleCloseTime
        });
        const payloadHash = buildRuntimeCandlePayloadHash(candle);
        if (conflictingIdentities.has(candleIdentity)) continue;
        const existingHash = closedPayloadHashes.get(candleIdentity);
        if (existingHash && existingHash !== payloadHash) {
          conflictingCandleCount += 1;
          blockers.add("conflicting_closed_candle");
          events.push(
            createStateEvent({
              type: "source_blocked",
              reason: "conflicting_closed_candle",
              receivedAt,
              sourceIdentity,
              requestedSymbol: normalized.requestedSymbol,
              brokerSymbol: normalized.brokerSymbol,
              timeframe: normalized.timeframe
            })
          );
          continue;
        }
        closedPayloadHashes.set(candleIdentity, payloadHash);
        const eventId = `runtime_close_${stableHash({ candleIdentity })}`;
        if (knownEventIds.has(eventId)) {
          duplicateCloseEventCount += 1;
          continue;
        }
        knownEventIds.add(eventId);
        emittedCloseEventCount += 1;
        lastClosedCandleEvent = receivedAt;
        events.push({
          ...eventBase({
            eventId,
            type: "candle_closed",
            sourceIdentity,
            requestedSymbol: normalized.requestedSymbol,
            brokerSymbol: normalized.brokerSymbol,
            timeframe: normalized.timeframe,
            observedMarketTime: candle.candleCloseTime,
            receivedAt,
            timeContractVersion: latestTimeContract.version,
            timeVerificationArtifactId: latestTimeContract.artifactId
          }),
          candleOpenTime: candle.candleOpenTime,
          candleCloseTime: candle.candleCloseTime,
          candleIdentity,
          payloadHash
        });
        lastClosedBySeries.set(key, candle.candleOpenTime);
      }
    }

    if (stale && latestTimeContract.eligible) {
      stale = false;
      recoveredEventCount += 1;
      events.push(
        createStateEvent({
          type: "feed_recovered",
          reason: "market_data_transport_recovered",
          receivedAt,
          sourceIdentity: quoteSourceIdentity
        })
      );
    }
    return {
      events,
      status: status(),
      checkpoint: checkpointSnapshot()
    };
  };

  const markFeedStale = ({
    reason = "market_data_transport_stale",
    receivedAt = new Date().toISOString()
  } = {}) => {
    stale = true;
    warnings.add(reason);
    const sourceIdentity = buildRuntimeSourceIdentity({
      requestedSymbol: quote?.requestedSymbol ?? "MNQ",
      brokerSymbol: quote?.brokerSymbol ?? "USTECH",
      timeContractVersion: latestTimeContract.version
    });
    const event = createStateEvent({
      type: "feed_stale",
      reason,
      receivedAt,
      sourceIdentity,
      requestedSymbol: quote?.requestedSymbol,
      brokerSymbol: quote?.brokerSymbol
    });
    return {
      events: [event],
      status: status(),
      checkpoint: checkpointSnapshot()
    };
  };

  return {
    processPoll,
    markFeedStale,
    status,
    checkpoint: checkpointSnapshot,
    rollingStoreSnapshot() {
      return Object.freeze(
        Object.fromEntries(
          [...stores.entries()].map(([key, candles]) => [
            key,
            Object.freeze(candles.map((candle) => Object.freeze({ ...candle })))
          ])
        )
      );
    }
  };
}

export function compactDurableMarketEvent(event) {
  const {
    bid: _bid,
    ask: _ask,
    mid: _mid,
    ...compact
  } = event;
  return compact;
}
