import { V2_AUTHORITY_NONE } from "../authority/v2Authority";
import { buildV2ContextInputIdentity } from "./v2ContextIdentity";
import { evaluateV2ContextEligibility } from "./v2ContextEligibility";
import { buildV2DealingRangeLiquidityFacts } from "./v2DealingRangeLiquidityFactEngine";
import { buildV2SessionOpeningFacts } from "./v2SessionOpeningFactEngine";
import {
  V2_CONTEXT_POLICY_VERSION,
  V2_CONTEXT_SCHEMA_VERSION,
  V2_CONTEXT_SESSION_CALENDAR_VERSION,
  V2_CONTEXT_STRATEGY_TIMEZONE,
  type V2CanonicalMarketContextBuilder,
  type V2CanonicalMarketState,
  type V2ContextBuildRequest,
  type V2ContextDiagnostics
} from "./v2ContextTypes";

const stableBuiltAt = (value?: string) => {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
};

export async function buildV2CanonicalMarketContext(
  request: V2ContextBuildRequest
): Promise<Readonly<V2CanonicalMarketState>> {
  const normalizedRequest: V2ContextBuildRequest = {
    ...request,
    contextPolicyVersion: request.contextPolicyVersion ?? V2_CONTEXT_POLICY_VERSION,
    sessionCalendarVersion: request.sessionCalendarVersion ?? V2_CONTEXT_SESSION_CALENDAR_VERSION
  };
  const identity = await buildV2ContextInputIdentity(normalizedRequest);
  const eligibility = evaluateV2ContextEligibility(normalizedRequest);
  const sessionOpeningResult = eligibility.status === "blocked"
    ? { facts: Object.freeze([]), warnings: Object.freeze([]), blockers: Object.freeze([]) }
    : await buildV2SessionOpeningFacts({ request: normalizedRequest, identity });
  const rangeLiquidityResult = eligibility.status === "blocked" || sessionOpeningResult.blockers.length
    ? { facts: Object.freeze([]), warnings: Object.freeze([]), blockers: Object.freeze([]) }
    : await buildV2DealingRangeLiquidityFacts({
        request: normalizedRequest,
        identity,
        sourceFacts: sessionOpeningResult.facts
      });
  const facts = Object.freeze([...sessionOpeningResult.facts, ...rangeLiquidityResult.facts]);
  const blockers = Object.freeze([...new Set([
    ...eligibility.blockers,
    ...sessionOpeningResult.blockers,
    ...rangeLiquidityResult.blockers
  ])]);
  const warnings = Object.freeze([...new Set([
    ...eligibility.warnings,
    ...sessionOpeningResult.warnings,
    ...rangeLiquidityResult.warnings
  ])]);
  const status = blockers.length ? "blocked" : warnings.length ? "degraded" : eligibility.status;
  const requestedFactFamilies = normalizedRequest.requestedFactFamilies ?? [];
  const diagnostics: Readonly<V2ContextDiagnostics> = Object.freeze({
    status,
    missingTimeframes: eligibility.missingTimeframes,
    staleWindows: eligibility.staleWindows,
    preVerificationWindows: eligibility.preVerificationWindows,
    futureCandleAttempts: eligibility.futureCandleAttempts,
    unsupportedPolicyRequests: eligibility.unsupportedPolicyRequests,
    timeContractBlockers: eligibility.timeContractBlockers,
    warnings,
    blockers,
    comparisonEligible: eligibility.comparisonEligible && status !== "blocked",
    factEngineStatus: !requestedFactFamilies.length
      ? "not_implemented_phase_2a0"
      : eligibility.status === "blocked"
        ? "blocked_by_context_eligibility"
        : requestedFactFamilies.some((family) => family === "dealing_range" || family === "liquidity")
          ? "range_liquidity_phase_2a4"
          : "session_opening_price_phase_2a3"
  });
  return Object.freeze({
    contextArtifactId: `v2-context:${identity.identityHash.replace(/^sha256:/, "")}`,
    identity,
    facts,
    diagnostics,
    contextSchemaVersion: V2_CONTEXT_SCHEMA_VERSION,
    contextPolicyVersion: normalizedRequest.contextPolicyVersion ?? V2_CONTEXT_POLICY_VERSION,
    sessionCalendarVersion: normalizedRequest.sessionCalendarVersion ?? V2_CONTEXT_SESSION_CALENDAR_VERSION,
    strategySessionTimezone: V2_CONTEXT_STRATEGY_TIMEZONE,
    builtAt: stableBuiltAt(request.builtAt),
    shadowOnly: true,
    authority: V2_AUTHORITY_NONE
  });
}

export function createV2CanonicalMarketContextBuilder(): Readonly<V2CanonicalMarketContextBuilder> {
  return Object.freeze({ build: buildV2CanonicalMarketContext });
}
