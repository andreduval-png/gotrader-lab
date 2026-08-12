import { canonicalHash } from "../canonical/canonicalValueSerialization";
import { validateCanonicalOpportunity } from "../backtestSimulation/simulationContracts";
import { SIMULATION_AUTHORITY_NONE, SIMULATION_CAPABILITIES_DISABLED } from "../backtestSimulation/simulationAuthority";
import type { CanonicalOpportunity, SimulationDirection } from "../backtestSimulation/simulationTypes";

export interface NativeTargetGeometryMeasure {
  readonly ordinal: number;
  readonly targetPrice: number;
  readonly rewardPriceDistance: number;
  readonly rewardRiskMultiple: number;
}

export interface NativeGeometryAssessmentCore {
  readonly schemaVersion: "gotrader-bt3-native-geometry-assessment-v1";
  readonly assessmentVersion: "bt3-instrument-neutral-structural-risk-v1";
  readonly opportunityId: string;
  readonly strategyId: string;
  readonly requestedSymbol: string;
  readonly brokerSymbol: string;
  readonly direction: SimulationDirection;
  readonly geometryMode: "native_strategy_geometry";
  readonly entryPrice: number;
  readonly stopPrice: number;
  readonly signalPrice: number;
  readonly targetPrices: readonly number[];
  readonly riskPriceDistance: number;
  readonly signalEntryPriceDistance: number;
  readonly signalEntryState: "aligned" | "displaced";
  readonly targetSequenceState: "single" | "monotonic_outward" | "non_monotonic";
  readonly targetMeasures: readonly Readonly<NativeTargetGeometryMeasure>[];
  readonly measureSpace: "price_distance_and_dimensionless_r";
  readonly instrumentSpecificationRequiredForUnitConversion: true;
  readonly nativeGeometryMutationAllowed: false;
  readonly standardizedRrExperimentAllowed: false;
  readonly positionSizingAllowed: false;
  readonly currentLiveGeometryAuthoritative: true;
  readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
  readonly capabilities: Readonly<typeof SIMULATION_CAPABILITIES_DISABLED>;
}

export interface NativeGeometryAssessment extends NativeGeometryAssessmentCore {
  readonly assessmentId: string;
}

const targetSequenceState = (
  measures: readonly Readonly<NativeTargetGeometryMeasure>[]
): NativeGeometryAssessmentCore["targetSequenceState"] => {
  if (measures.length === 1) return "single";
  return measures.every((measure, index) => index === 0 ||
    measure.rewardPriceDistance > measures[index - 1].rewardPriceDistance)
    ? "monotonic_outward" : "non_monotonic";
};

export async function assessNativeGeometry(
  opportunity: Readonly<CanonicalOpportunity>
): Promise<Readonly<NativeGeometryAssessment>> {
  if (opportunity.schemaVersion !== "gotrader-canonical-opportunity-bt2-v1" ||
      opportunity.geometryMode !== "native_strategy_geometry") {
    throw new Error("BT3 native geometry requires the governed BT2 native geometry contract.");
  }
  const blockers = await validateCanonicalOpportunity(opportunity);
  if (blockers.length) throw new Error(`BT3 native geometry opportunity is invalid: ${blockers.join(", ")}`);

  const riskPriceDistance = Math.abs(opportunity.entryPrice - opportunity.stopPrice);
  if (!Number.isFinite(riskPriceDistance) || riskPriceDistance <= 0) {
    throw new Error("BT3 native geometry risk distance is invalid.");
  }
  const targetMeasures = Object.freeze(opportunity.targetPrices.map((targetPrice, index) => Object.freeze({
    ordinal: index + 1,
    targetPrice,
    rewardPriceDistance: Math.abs(targetPrice - opportunity.entryPrice),
    rewardRiskMultiple: Math.abs(targetPrice - opportunity.entryPrice) / riskPriceDistance
  })));
  if (targetMeasures.some((measure) => !Number.isFinite(measure.rewardRiskMultiple) ||
      measure.rewardPriceDistance <= 0 || measure.rewardRiskMultiple <= 0)) {
    throw new Error("BT3 native geometry target measure is invalid.");
  }

  const core: Readonly<NativeGeometryAssessmentCore> = Object.freeze({
    schemaVersion: "gotrader-bt3-native-geometry-assessment-v1",
    assessmentVersion: "bt3-instrument-neutral-structural-risk-v1",
    opportunityId: opportunity.opportunityId,
    strategyId: opportunity.strategyId,
    requestedSymbol: opportunity.requestedSymbol,
    brokerSymbol: opportunity.brokerSymbol,
    direction: opportunity.direction,
    geometryMode: "native_strategy_geometry",
    entryPrice: opportunity.entryPrice,
    stopPrice: opportunity.stopPrice,
    signalPrice: opportunity.signalPrice,
    targetPrices: Object.freeze([...opportunity.targetPrices]),
    riskPriceDistance,
    signalEntryPriceDistance: Math.abs(opportunity.signalPrice - opportunity.entryPrice),
    signalEntryState: opportunity.signalPrice === opportunity.entryPrice ? "aligned" : "displaced",
    targetSequenceState: targetSequenceState(targetMeasures),
    targetMeasures,
    measureSpace: "price_distance_and_dimensionless_r",
    instrumentSpecificationRequiredForUnitConversion: true,
    nativeGeometryMutationAllowed: false,
    standardizedRrExperimentAllowed: false,
    positionSizingAllowed: false,
    currentLiveGeometryAuthoritative: true,
    authority: SIMULATION_AUTHORITY_NONE,
    capabilities: SIMULATION_CAPABILITIES_DISABLED
  });
  return Object.freeze({ ...core, assessmentId: await canonicalHash(core) });
}

export async function validateNativeGeometryAssessment(
  assessment: Readonly<NativeGeometryAssessment>,
  opportunity: Readonly<CanonicalOpportunity>
) {
  const blockers: string[] = [];
  const { assessmentId, ...core } = assessment;
  if (await canonicalHash(core) !== assessmentId) blockers.push("bt3_native_geometry_assessment_id_invalid");
  try {
    const expected = await assessNativeGeometry(opportunity);
    if (JSON.stringify(expected) !== JSON.stringify(assessment)) {
      blockers.push("bt3_native_geometry_assessment_reproduction_mismatch");
    }
  } catch {
    blockers.push("bt3_native_geometry_parent_invalid");
  }
  if (assessment.nativeGeometryMutationAllowed || assessment.standardizedRrExperimentAllowed ||
      assessment.positionSizingAllowed || !assessment.currentLiveGeometryAuthoritative) {
    blockers.push("bt3_native_geometry_authority_drift");
  }
  return Object.freeze([...new Set(blockers)].sort());
}
