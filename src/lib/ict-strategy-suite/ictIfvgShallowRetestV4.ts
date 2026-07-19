import { assessIctIfvgFreshRetestV3 } from "./ictIfvgFreshRetestV3";
import type { IctIfvgCandidate, IctIfvgInput } from "./ictIfvgTypes";

const authority = {
  executionAuthority: "none" as const,
  brokerAuthority: "none" as const,
  readinessOverrideAuthority: "none" as const
};

export const IFVG_V4_MAX_RETEST_PENETRATION = 0.66;

export const ifvgRetestPenetration = (candidate: IctIfvgCandidate) => {
  const bounds = candidate.ifvgBounds;
  const retest = candidate.retestCandle;
  if (!bounds || !retest || candidate.side === "flat") return undefined;
  const size = bounds.high - bounds.low;
  if (!(size > 0)) return undefined;
  const penetration = candidate.side === "long"
    ? (bounds.high - retest.low) / size
    : (retest.high - bounds.low) / size;
  return Number(penetration.toFixed(4));
};

export interface IctIfvgShallowRetestV4Assessment {
  strategyId: "ifvg_fresh_retest_v4_candidate";
  candidate: IctIfvgCandidate;
  baseV3Eligible: boolean;
  retestPenetration?: number;
  maximumRetestPenetration: number;
  shallowRetest: boolean;
  eligible: boolean;
  blockers: string[];
  nextAction: string;
  researchOnly: true;
  paperDemoEligible: false;
  authority: typeof authority;
}

/**
 * Research-only fork of the frozen v3 profile. The single changed condition is
 * a bounded, causal retest-depth filter proven on development data and checked
 * once on the frozen chronological holdout. It cannot mutate or promote v3.
 */
export const assessIctIfvgShallowRetestV4 = (
  input: IctIfvgInput,
  detected?: IctIfvgCandidate
): IctIfvgShallowRetestV4Assessment => {
  const base = assessIctIfvgFreshRetestV3(input, detected);
  const retestPenetration = ifvgRetestPenetration(base.candidate);
  const shallowRetest = Number.isFinite(retestPenetration) &&
    retestPenetration! <= IFVG_V4_MAX_RETEST_PENETRATION;
  const blockers = [
    ...base.blockers,
    shallowRetest ? undefined : "shallow_retest_depth_required"
  ].filter((item): item is string => Boolean(item));

  return {
    strategyId: "ifvg_fresh_retest_v4_candidate",
    candidate: base.candidate,
    baseV3Eligible: base.eligible,
    retestPenetration,
    maximumRetestPenetration: IFVG_V4_MAX_RETEST_PENETRATION,
    shallowRetest,
    eligible: blockers.length === 0,
    blockers: Array.from(new Set(blockers)),
    nextAction: blockers.length
      ? "Wait for a fresh clean IFVG retest that does not penetrate beyond 66% of the zone."
      : "Record replay and forward-only evidence for the v4 candidate; do not promote readiness automatically.",
    researchOnly: true,
    paperDemoEligible: false,
    authority
  };
};
