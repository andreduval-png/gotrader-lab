import { V2_AUTHORITY_NONE } from "../authority/v2Authority";
import { buildV2ContextInputIdentity } from "./v2ContextIdentity";
import { evaluateV2ContextEligibility } from "./v2ContextEligibility";
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
  const diagnostics: Readonly<V2ContextDiagnostics> = Object.freeze({
    status: eligibility.status,
    missingTimeframes: eligibility.missingTimeframes,
    staleWindows: eligibility.staleWindows,
    preVerificationWindows: eligibility.preVerificationWindows,
    futureCandleAttempts: eligibility.futureCandleAttempts,
    unsupportedPolicyRequests: eligibility.unsupportedPolicyRequests,
    timeContractBlockers: eligibility.timeContractBlockers,
    warnings: eligibility.warnings,
    blockers: eligibility.blockers,
    comparisonEligible: eligibility.comparisonEligible,
    factEngineStatus: "not_implemented_phase_2a0"
  });
  return Object.freeze({
    contextArtifactId: `v2-context:${identity.identityHash.replace(/^sha256:/, "")}`,
    identity,
    facts: Object.freeze([]),
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
