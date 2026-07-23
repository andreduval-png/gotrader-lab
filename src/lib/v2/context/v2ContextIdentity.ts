import { canonicalHash } from "../serialization/canonicalSerialization";
import { normalizeV2Timeframe } from "../candles/v2Timeframe";
import type { V2MarketFact } from "./v2ContextTypes";
import {
  V2_CONTEXT_DEALING_RANGE_FACT_POLICY_VERSION,
  V2_CONTEXT_IDENTITY_VERSION,
  V2_CONTEXT_LIQUIDITY_FACT_POLICY_VERSION,
  V2_CONTEXT_OPENING_PRICE_FACT_POLICY_VERSION,
  V2_CONTEXT_POLICY_VERSION,
  V2_CONTEXT_SESSION_FACT_POLICY_VERSION,
  V2_CONTEXT_SESSION_CALENDAR_VERSION,
  type V2ContextBuildRequest,
  type V2ContextFactFamily,
  type V2ContextInputIdentity,
  type V2ContextWindowIdentityRef
} from "./v2ContextTypes";

const factPolicyVersionFor = (family: V2ContextFactFamily) => {
  switch (family) {
    case "session": return V2_CONTEXT_SESSION_FACT_POLICY_VERSION;
    case "opening_price": return V2_CONTEXT_OPENING_PRICE_FACT_POLICY_VERSION;
    case "dealing_range": return V2_CONTEXT_DEALING_RANGE_FACT_POLICY_VERSION;
    case "liquidity": return V2_CONTEXT_LIQUIDITY_FACT_POLICY_VERSION;
  }
};

const windowTimeframe = (requestWindow: V2ContextBuildRequest["windows"][number]) => {
  const timeframes = Object.keys(requestWindow.identity.candleCountByTimeframe);
  if (timeframes.length !== 1) {
    throw new Error("A Phase 2A.0 context input window must contain exactly one timeframe identity.");
  }
  return normalizeV2Timeframe(timeframes[0]);
};

const refFor = (window: V2ContextBuildRequest["windows"][number]): Readonly<V2ContextWindowIdentityRef> => {
  const timeframe = windowTimeframe(window);
  return Object.freeze({
    timeframe,
    identityHash: window.identity.identityHash,
    sourceFingerprint: window.identity.source.sourceFingerprint,
    dataWindowStart: window.identity.dataWindowStart,
    dataWindowEnd: window.identity.dataWindowEnd,
    lastClosedCandle: window.identity.lastClosedCandle,
    candleCount: window.identity.candleCountByTimeframe[timeframe] ?? window.candles.length,
    ...(window.timeEligibility?.offsetRegimeId ? { offsetRegimeId: window.timeEligibility.offsetRegimeId } : {})
  });
};

export async function buildV2ContextInputIdentity(
  request: V2ContextBuildRequest
): Promise<Readonly<V2ContextInputIdentity>> {
  const requiredTimeframes = Object.freeze([...new Set(request.requiredTimeframes.map(normalizeV2Timeframe))].sort());
  const inputWindows = Object.freeze(request.windows.map(refFor).sort((left, right) =>
    left.timeframe.localeCompare(right.timeframe) || left.identityHash.localeCompare(right.identityHash)
  ));
  const requestedFactFamilies = Object.freeze([...new Set(request.requestedFactFamilies ?? [])].sort());
  const factPolicyVersions = Object.freeze(requestedFactFamilies.map(factPolicyVersionFor));
  const core = {
    identityVersion: V2_CONTEXT_IDENTITY_VERSION,
    source: request.source,
    purpose: request.purpose,
    asOfMarketTime: new Date(request.asOfMarketTime).toISOString(),
    requiredTimeframes,
    inputWindows,
    contextPolicyVersion: request.contextPolicyVersion ?? V2_CONTEXT_POLICY_VERSION,
    sessionCalendarVersion: request.sessionCalendarVersion ?? V2_CONTEXT_SESSION_CALENDAR_VERSION,
    ...(requestedFactFamilies.length ? { requestedFactFamilies, factPolicyVersions } : {})
  } as const;
  return Object.freeze({ ...core, identityHash: await canonicalHash(core) });
}

export async function buildV2MarketFactId(fact: Omit<V2MarketFact, "factId" | "providerTime" | "receivedAt">) {
  return canonicalHash(fact);
}

export function v2ContextWindowTimeframe(window: V2ContextBuildRequest["windows"][number]) {
  return windowTimeframe(window);
}
