import { canonicalFingerprint } from "@/lib/ictCanonical/canonicalIctIdentity";
import { selectCanonicalTarget } from "@/lib/tradeGeometry/targetSelection";
import {
  TRADE_GEOMETRY_SCHEMA_VERSION,
  TRADE_GEOMETRY_VERSION,
  type BuildCanonicalTradeGeometryInput,
  type CanonicalGeometryProjection,
  type CanonicalTradeGeometry,
  type TradeDirection,
  type TradeGeometryStatus
} from "@/lib/tradeGeometry/tradeGeometryTypes";

const NONE_AUTHORITY = Object.freeze({ execution: "none", broker: "none", production: "none" } as const);

const finitePositive = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value > 0;

export const directionalRiskDistance = (direction: TradeDirection, entry: number, stop: number) =>
  direction === "LONG" ? entry - stop : stop - entry;

export const directionalRewardDistance = (direction: TradeDirection, entry: number, target: number) =>
  direction === "LONG" ? target - entry : entry - target;

export const calculateTheoreticalRR = (direction: TradeDirection, entry: number, stop: number, target: number) => {
  const risk = directionalRiskDistance(direction, entry, stop);
  const reward = directionalRewardDistance(direction, entry, target);
  if (!finitePositive(entry) || !finitePositive(stop) || !finitePositive(target) || risk <= 0 || reward <= 0) {
    return undefined;
  }
  const result = reward / risk;
  return Number.isFinite(result) ? result : undefined;
};

const geometryMaterial = (input: BuildCanonicalTradeGeometryInput, selectedTarget?: { targetId: string; price: number }) => ({
  schemaVersion: TRADE_GEOMETRY_SCHEMA_VERSION,
  geometryVersion: TRADE_GEOMETRY_VERSION,
  strategyId: input.strategyId,
  strategyVersion: input.strategyVersion,
  profileId: input.profileId,
  profileVersion: input.profileVersion,
  parameterHash: input.parameterHash,
  candidateId: input.candidateId,
  direction: input.direction,
  entry: {
    model: input.entry.model,
    intendedPrice: input.entry.intendedPrice,
    sourceFactId: input.entry.sourceFactId,
    ownerTimeframe: input.entry.ownerTimeframe,
    validFrom: input.entry.validFrom,
    expiresAt: input.entry.expiresAt
  },
  stop: input.stop,
  selectedTarget,
  targetPolicy: input.targetPolicy,
  nearestLiquidityId: input.nearestLiquidityId,
  primaryDrawOnLiquidityId: input.primaryDrawOnLiquidityId,
  minimumRequiredRR: input.minimumRequiredRR,
  sourceFingerprint: input.sourceFingerprint
});

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
};

const invalidResult = (
  base: Omit<CanonicalTradeGeometry, "geometryValid" | "actionable" | "status" | "blockers" | "warnings">,
  status: TradeGeometryStatus,
  blocker: string,
  warnings: readonly string[] = []
) => deepFreeze({ ...base, geometryValid: false, actionable: false, status, blockers: [blocker], warnings });

export const buildCanonicalTradeGeometry = (input: BuildCanonicalTradeGeometryInput): CanonicalTradeGeometry => {
  const logicalGeometryKey = canonicalFingerprint({
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    profileId: input.profileId,
    profileVersion: input.profileVersion,
    candidateId: input.candidateId
  });
  const preliminaryMaterial = geometryMaterial(input);
  const preliminaryId = canonicalFingerprint(preliminaryMaterial);
  const baseWithoutTarget: Omit<
    CanonicalTradeGeometry,
    "geometryValid" | "actionable" | "status" | "blockers" | "warnings"
  > = {
    schemaVersion: TRADE_GEOMETRY_SCHEMA_VERSION,
    geometryVersion: TRADE_GEOMETRY_VERSION,
    geometryId: preliminaryId,
    logicalGeometryKey,
    strategyId: input.strategyId,
    strategyVersion: input.strategyVersion,
    profileId: input.profileId,
    profileVersion: input.profileVersion,
    parameterHash: input.parameterHash,
    candidateId: input.candidateId,
    direction: input.direction,
    entry: { ...input.entry },
    stop: { ...input.stop },
    targetPolicy: { ...input.targetPolicy, allowedFallbackTargetTypes: [...input.targetPolicy.allowedFallbackTargetTypes] },
    nearestLiquidityId: input.nearestLiquidityId,
    primaryDrawOnLiquidityId: input.primaryDrawOnLiquidityId,
    minimumRequiredRR: input.minimumRequiredRR,
    sourceFingerprint: input.sourceFingerprint,
    authority: NONE_AUTHORITY
  };

  if (!finitePositive(input.entry.intendedPrice)) return invalidResult(baseWithoutTarget, "INVALID_ENTRY", "entry_invalid");
  if (!finitePositive(input.stop.price) || !input.stop.structuralInvalidation) {
    return invalidResult(baseWithoutTarget, "INVALID_STOP", input.stop.structuralInvalidation ? "stop_invalid" : "stop_not_structural");
  }
  if (input.entry.lifecycleStatus === "ENTRY_MISSED") return invalidResult(baseWithoutTarget, "ENTRY_MISSED", "entry_missed");
  if (input.entry.lifecycleStatus === "ENTRY_EXPIRED") return invalidResult(baseWithoutTarget, "ENTRY_EXPIRED", "entry_expired");

  const selection = selectCanonicalTarget({
    direction: input.direction,
    entryPrice: input.entry.intendedPrice,
    stopPrice: input.stop.price,
    asOf: input.asOf,
    candidates: input.targetCandidates,
    policy: input.targetPolicy
  });
  if (!selection.selected) return invalidResult(baseWithoutTarget, selection.failure, selection.blocker);

  const selected = selection.selected;
  const target = {
    model: selected.type,
    price: selected.price,
    sourceFactId: selected.sourceFactId,
    ownerTimeframe: selected.ownerTimeframe,
    targetId: selected.targetId,
    targetType: selected.type,
    liquidityClass: selected.liquidityClass,
    selectionRole: selection.selectionRole,
    policyId: input.targetPolicy.policyId,
    policyVersion: input.targetPolicy.policyVersion
  } as const;
  const material = geometryMaterial(input, { targetId: selected.targetId, price: selected.price });
  const riskDistance = directionalRiskDistance(input.direction, input.entry.intendedPrice, input.stop.price);
  const rewardDistance = directionalRewardDistance(input.direction, input.entry.intendedPrice, selected.price);
  const theoreticalRR = calculateTheoreticalRR(
    input.direction,
    input.entry.intendedPrice,
    input.stop.price,
    selected.price
  );
  const base: Omit<
    CanonicalTradeGeometry,
    "geometryValid" | "actionable" | "status" | "blockers" | "warnings"
  > = {
    ...baseWithoutTarget,
    geometryId: canonicalFingerprint(material),
    target,
    riskDistance,
    rewardDistance,
    theoreticalRR
  };

  if (riskDistance <= 0 || rewardDistance < 0) {
    return invalidResult(base, "GEOMETRY_DIRECTION_INVALID", "geometry_direction_invalid");
  }
  if (rewardDistance === 0) return invalidResult(base, "TARGET_TOO_CLOSE", "target_too_close");
  if (theoreticalRR === undefined) return invalidResult(base, "GEOMETRY_DIRECTION_INVALID", "geometry_direction_invalid");

  if (input.minimumRequiredRR === undefined) {
    return deepFreeze({
      ...base,
      geometryValid: true,
      actionable: false,
      status: "VALID_RESEARCH_ONLY",
      blockers: ["minimum_rr_policy_missing"],
      warnings: []
    });
  }
  if (!Number.isFinite(input.minimumRequiredRR) || input.minimumRequiredRR <= 0) {
    return invalidResult(base, "GEOMETRY_POLICY_MISMATCH", "minimum_rr_policy_invalid");
  }
  if (theoreticalRR < input.minimumRequiredRR) {
    return deepFreeze({
      ...base,
      geometryValid: true,
      actionable: false,
      status: "VALID_BELOW_RR_THRESHOLD",
      blockers: ["rr_below_minimum"],
      warnings: []
    });
  }
  if (input.researchOnly) {
    return deepFreeze({
      ...base,
      geometryValid: true,
      actionable: false,
      status: "VALID_RESEARCH_ONLY",
      blockers: ["research_only"],
      warnings: []
    });
  }
  return deepFreeze({
    ...base,
    geometryValid: true,
    actionable: true,
    status: "VALID_ACTIONABLE",
    blockers: [],
    warnings: []
  });
};

const payload = (geometry: CanonicalTradeGeometry) => ({
  direction: geometry.direction,
  entry: geometry.entry.intendedPrice,
  stop: geometry.stop.price,
  target: geometry.target?.price,
  targetId: geometry.target?.targetId,
  policyId: geometry.targetPolicy.policyId,
  policyVersion: geometry.targetPolicy.policyVersion,
  sourceFingerprint: geometry.sourceFingerprint
});

export const geometryPayloadConflicts = (left: CanonicalTradeGeometry, right: CanonicalTradeGeometry) =>
  left.logicalGeometryKey === right.logicalGeometryKey && canonicalFingerprint(payload(left)) !== canonicalFingerprint(payload(right));

export const projectCanonicalTradeGeometry = (geometry: CanonicalTradeGeometry): CanonicalGeometryProjection | undefined => {
  if (!geometry.target || geometry.theoreticalRR === undefined) return undefined;
  return {
    geometryId: geometry.geometryId,
    intendedEntry: geometry.entry.intendedPrice,
    intendedStop: geometry.stop.price,
    intendedTarget: geometry.target.price,
    theoreticalRR: geometry.theoreticalRR,
    minimumRequiredRR: geometry.minimumRequiredRR,
    geometryValid: geometry.geometryValid,
    actionable: geometry.actionable,
    status: geometry.status,
    displayKind: geometry.actionable ? "ACTIONABLE_GEOMETRY" : "RESEARCH_GEOMETRY"
  };
};
