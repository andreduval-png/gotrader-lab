import { canonicalHash } from "../canonical/canonicalValueSerialization";
import { buildCanonicalOpportunity } from "../backtestSimulation/simulationContracts";
import {
  SIMULATION_AUTHORITY_NONE,
  SIMULATION_CAPABILITIES_DISABLED
} from "../backtestSimulation/simulationAuthority";
import type {
  CanonicalOpportunity,
  SimulationDirection
} from "../backtestSimulation/simulationTypes";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const IFVG_TIMEFRAME_MS = 5 * 60_000;
const OPPORTUNITY_LIFETIME_MS = 2 * 60 * 60_000;

export type IfvgParityClassification = "negative_control" | "positive_canary";

export interface FrozenIfvgIdentity {
  readonly brokerSymbol: string;
  readonly classification: IfvgParityClassification;
  readonly dataWindowEnd: string;
  readonly dataWindowStart: string;
  readonly detectorVersion: "v2" | "v3";
  readonly fixtureId: string;
  readonly lastClosedCandle: string;
  readonly parameterFingerprint: string;
  readonly profileVersion: "v2" | "v3";
  readonly requestedSymbol: string;
  readonly sourceCommit: string;
  readonly sourceFingerprint: string;
  readonly strategyId: string;
  readonly timeframeSet: readonly string[];
}

export interface FrozenIfvgFixture {
  readonly schemaVersion: "gotrader-v2-baseline-fixture-v1";
  readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
  readonly expectedBlockers: readonly string[];
  readonly expectedDetectionState: string;
  readonly expectedResearchLifecycleState: string;
  readonly expectedResultType: string;
  readonly expectedTradeGeometry?: {
    readonly entry: number;
    readonly rr: number;
    readonly side: SimulationDirection;
    readonly stop: number;
    readonly target: number;
  };
  readonly identity: FrozenIfvgIdentity;
}

export interface IfvgParityResultCore {
  readonly schemaVersion: "gotrader-bt3-ifvg-parity-v1";
  readonly adapterVersion: "bt3-ifvg-frozen-fixture-adapter-v1";
  readonly baselineSnapshotHash: string;
  readonly fixtureDatasetId: string;
  readonly fixtureCertificateId: string;
  readonly contextLineageRoot: string;
  readonly fixtureId: string;
  readonly strategyId: string;
  readonly profileVersion: string;
  readonly sourceFingerprint: string;
  readonly classification: IfvgParityClassification;
  readonly detectionState: string;
  readonly resultType: string;
  readonly researchLifecycleState: string;
  readonly blockers: readonly string[];
  readonly opportunity?: Readonly<CanonicalOpportunity>;
  readonly promotionAllowed: false;
  readonly fixtureOnly: true;
  readonly historicalDatasetQualified: false;
  readonly rawCandlesSerialized: false;
  readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
  readonly capabilities: Readonly<typeof SIMULATION_CAPABILITIES_DISABLED>;
}

export interface IfvgParityResult extends IfvgParityResultCore {
  readonly parityId: string;
}

const requireIso = (value: string, label: string) => {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`BT3 IFVG fixture ${label} is invalid.`);
};

const requireProfile = (fixture: Readonly<FrozenIfvgFixture>) => {
  const expected = fixture.identity.detectorVersion === "v2"
    ? "ifvg_filtered_v2_research"
    : "ifvg_fresh_retest_v3_research";
  if (fixture.identity.strategyId !== expected || fixture.identity.profileVersion !== fixture.identity.detectorVersion) {
    throw new Error("BT3 IFVG fixture profile identity is unsupported.");
  }
  if (fixture.identity.detectorVersion === "v2" && fixture.identity.classification !== "negative_control" ||
      fixture.identity.detectorVersion === "v3" && fixture.identity.classification !== "positive_canary") {
    throw new Error("BT3 IFVG fixture classification is inconsistent.");
  }
};

const requireAuthorityNone = (fixture: Readonly<FrozenIfvgFixture>) => {
  if (fixture.authority.executionAuthority !== "none" ||
      fixture.authority.brokerAuthority !== "none" ||
      fixture.authority.readinessOverrideAuthority !== "none") {
    throw new Error("BT3 IFVG fixture authority is not none/none/none.");
  }
};

export async function adaptFrozenIfvgFixture(input: {
  readonly fixture: Readonly<FrozenIfvgFixture>;
  readonly baselineSnapshotHash: string;
}): Promise<Readonly<IfvgParityResult>> {
  const { fixture, baselineSnapshotHash } = input;
  if (!SHA256_PATTERN.test(baselineSnapshotHash)) throw new Error("BT3 IFVG baseline snapshot hash is invalid.");
  if (fixture.schemaVersion !== "gotrader-v2-baseline-fixture-v1") {
    throw new Error("BT3 IFVG fixture schema is unsupported.");
  }
  requireAuthorityNone(fixture);
  requireProfile(fixture);
  requireIso(fixture.identity.lastClosedCandle, "last-closed candle");
  requireIso(fixture.identity.dataWindowStart, "window start");
  requireIso(fixture.identity.dataWindowEnd, "window end");
  if (fixture.identity.timeframeSet[0] !== "5m") throw new Error("BT3 IFVG fixture decision timeframe is unsupported.");

  const snapshotId = `sha256:${baselineSnapshotHash}`;
  const fixtureDatasetId = await canonicalHash({
    kind: "bt3-frozen-ifvg-fixture-dataset-v1",
    snapshotId,
    fixtureId: fixture.identity.fixtureId,
    sourceFingerprint: fixture.identity.sourceFingerprint,
    dataWindowStart: fixture.identity.dataWindowStart,
    dataWindowEnd: fixture.identity.dataWindowEnd
  });
  const fixtureCertificateId = await canonicalHash({
    kind: "bt3-frozen-ifvg-fixture-certificate-v1",
    fixtureDatasetId,
    snapshotId,
    sourceCommit: fixture.identity.sourceCommit
  });
  const contextLineageRoot = await canonicalHash({
    kind: "bt3-frozen-ifvg-context-lineage-v1",
    fixtureDatasetId,
    fixtureId: fixture.identity.fixtureId,
    lastClosedCandle: fixture.identity.lastClosedCandle,
    sourceFingerprint: fixture.identity.sourceFingerprint
  });

  const hasGeometry = fixture.expectedTradeGeometry !== undefined;
  const mayEmit = fixture.expectedDetectionState === "trade_plan_constructed" &&
    fixture.expectedResultType === "trade_candidate" && fixture.expectedBlockers.length === 0;
  if (hasGeometry !== mayEmit) throw new Error("BT3 IFVG fixture geometry and blocker state are inconsistent.");

  let opportunity: Readonly<CanonicalOpportunity> | undefined;
  if (fixture.expectedTradeGeometry) {
    const geometry = fixture.expectedTradeGeometry;
    const decisionAt = new Date(Date.parse(fixture.identity.lastClosedCandle) + IFVG_TIMEFRAME_MS);
    const parameterHash = await canonicalHash({
      strategyId: fixture.identity.strategyId,
      profileVersion: fixture.identity.profileVersion,
      parameterFingerprint: fixture.identity.parameterFingerprint
    });
    opportunity = await buildCanonicalOpportunity({
      adapterVersion: "bt3-ifvg-frozen-fixture-adapter-v1",
      datasetCertificateId: fixtureCertificateId,
      datasetId: fixtureDatasetId,
      strategyId: fixture.identity.strategyId,
      profileVersion: fixture.identity.profileVersion,
      parameterHash,
      requestedSymbol: fixture.identity.requestedSymbol,
      brokerSymbol: fixture.identity.brokerSymbol,
      timeframe: "5m",
      decisionAtUtc: decisionAt.toISOString(),
      sourceCandleClosedAtUtc: decisionAt.toISOString(),
      contextLineageRoot,
      direction: geometry.side,
      orderPolicy: "limit_at_price",
      activatesAtUtc: decisionAt.toISOString(),
      expiresAtUtc: new Date(decisionAt.getTime() + OPPORTUNITY_LIFETIME_MS).toISOString(),
      signalPrice: geometry.entry,
      entryPrice: geometry.entry,
      stopPrice: geometry.stop,
      targetPrices: Object.freeze([geometry.target]),
      eligible: true,
      blockers: Object.freeze([])
    });
  }

  const core: Readonly<IfvgParityResultCore> = Object.freeze({
    schemaVersion: "gotrader-bt3-ifvg-parity-v1",
    adapterVersion: "bt3-ifvg-frozen-fixture-adapter-v1",
    baselineSnapshotHash: snapshotId,
    fixtureDatasetId,
    fixtureCertificateId,
    contextLineageRoot,
    fixtureId: fixture.identity.fixtureId,
    strategyId: fixture.identity.strategyId,
    profileVersion: fixture.identity.profileVersion,
    sourceFingerprint: fixture.identity.sourceFingerprint,
    classification: fixture.identity.classification,
    detectionState: fixture.expectedDetectionState,
    resultType: fixture.expectedResultType,
    researchLifecycleState: fixture.expectedResearchLifecycleState,
    blockers: Object.freeze([...fixture.expectedBlockers]),
    ...(opportunity ? { opportunity } : {}),
    promotionAllowed: false,
    fixtureOnly: true,
    historicalDatasetQualified: false,
    rawCandlesSerialized: false,
    authority: SIMULATION_AUTHORITY_NONE,
    capabilities: SIMULATION_CAPABILITIES_DISABLED
  });
  return Object.freeze({ ...core, parityId: await canonicalHash(core) });
}

export async function compareFrozenIfvgParity(input: {
  readonly fixture: Readonly<FrozenIfvgFixture>;
  readonly result: Readonly<IfvgParityResult>;
}): Promise<readonly string[]> {
  const { fixture, result } = input;
  const blockers: string[] = [];
  const { parityId, ...core } = result;
  if (await canonicalHash(core) !== parityId) blockers.push("bt3_ifvg_parity_id_invalid");
  if (result.fixtureId !== fixture.identity.fixtureId) blockers.push("bt3_ifvg_fixture_id_drift");
  if (result.strategyId !== fixture.identity.strategyId) blockers.push("bt3_ifvg_strategy_id_drift");
  if (result.profileVersion !== fixture.identity.profileVersion) blockers.push("bt3_ifvg_profile_version_drift");
  if (result.sourceFingerprint !== fixture.identity.sourceFingerprint) blockers.push("bt3_ifvg_source_fingerprint_drift");
  if (result.classification !== fixture.identity.classification) blockers.push("bt3_ifvg_classification_drift");
  if (JSON.stringify(result.blockers) !== JSON.stringify(fixture.expectedBlockers)) blockers.push("bt3_ifvg_blocker_drift");
  if (Boolean(result.opportunity) !== Boolean(fixture.expectedTradeGeometry)) blockers.push("bt3_ifvg_opportunity_presence_drift");
  if (result.opportunity && fixture.expectedTradeGeometry) {
    const geometry = fixture.expectedTradeGeometry;
    if (result.opportunity.direction !== geometry.side || result.opportunity.entryPrice !== geometry.entry ||
        result.opportunity.stopPrice !== geometry.stop || result.opportunity.targetPrices[0] !== geometry.target) {
      blockers.push("bt3_ifvg_native_geometry_drift");
    }
  }
  if (result.promotionAllowed || result.historicalDatasetQualified || result.rawCandlesSerialized) {
    blockers.push("bt3_ifvg_scope_authority_violation");
  }
  return Object.freeze([...new Set(blockers)].sort());
}
