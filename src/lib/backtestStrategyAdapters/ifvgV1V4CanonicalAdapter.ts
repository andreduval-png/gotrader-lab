import { canonicalHash } from "../canonical/canonicalValueSerialization";
import { buildCanonicalOpportunity } from "../backtestSimulation/simulationContracts";
import { SIMULATION_AUTHORITY_NONE, SIMULATION_CAPABILITIES_DISABLED } from "../backtestSimulation/simulationAuthority";
import type { CanonicalOpportunity, SimulationDirection } from "../backtestSimulation/simulationTypes";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const FIVE_MINUTES_MS = 5 * 60_000;

export interface IfvgV1V4Fixture {
  readonly schemaVersion: "gotrader-bt3-ifvg-v1-v4-fixture-v1";
  readonly identity: {
    readonly fixtureId: string;
    readonly strategyId: "ifvg_v1" | "ifvg_fresh_retest_v4_candidate";
    readonly profileVersion: "v1" | "v4";
    readonly classification: "behavioral_fixture" | "experimental";
    readonly sourceCommit: string;
    readonly requestedSymbol: string;
    readonly brokerSymbol: string;
    readonly sourceFingerprint: string;
    readonly timeframe: "5m";
    readonly lastClosedCandle: string;
    readonly parameterFingerprint: string;
  };
  readonly detectionState: "trade_plan_constructed" | "blocked";
  readonly blockers: readonly string[];
  readonly geometry?: {
    readonly side: SimulationDirection;
    readonly entry: number;
    readonly stop: number;
    readonly target: number;
    readonly rr: number;
  };
  readonly promotionAllowed: false;
  readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
}

export interface IfvgV1V4ParityCore {
  readonly schemaVersion: "gotrader-bt3-ifvg-v1-v4-parity-v1";
  readonly adapterVersion: "bt3-ifvg-v1-v4-fixture-adapter-v1";
  readonly snapshotHash: string;
  readonly fixtureDatasetId: string;
  readonly fixtureCertificateId: string;
  readonly contextLineageRoot: string;
  readonly fixtureId: string;
  readonly strategyId: string;
  readonly profileVersion: string;
  readonly classification: "behavioral_fixture" | "experimental";
  readonly sourceFingerprint: string;
  readonly detectionState: string;
  readonly blockers: readonly string[];
  readonly opportunity?: Readonly<CanonicalOpportunity>;
  readonly promotionAllowed: false;
  readonly fixtureOnly: true;
  readonly historicalDatasetQualified: false;
  readonly rawCandlesSerialized: false;
  readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
  readonly capabilities: Readonly<typeof SIMULATION_CAPABILITIES_DISABLED>;
}

export interface IfvgV1V4Parity extends IfvgV1V4ParityCore {
  readonly parityId: string;
}

const validateFixture = (fixture: Readonly<IfvgV1V4Fixture>) => {
  if (fixture.schemaVersion !== "gotrader-bt3-ifvg-v1-v4-fixture-v1") throw new Error("BT3 IFVG v1/v4 fixture schema is unsupported.");
  const v1 = fixture.identity.profileVersion === "v1";
  if (v1 !== (fixture.identity.strategyId === "ifvg_v1") ||
      v1 !== (fixture.identity.classification === "behavioral_fixture")) {
    throw new Error("BT3 IFVG v1/v4 profile identity is inconsistent.");
  }
  if (!Number.isFinite(Date.parse(fixture.identity.lastClosedCandle))) throw new Error("BT3 IFVG v1/v4 close time is invalid.");
  if (fixture.authority.executionAuthority !== "none" || fixture.authority.brokerAuthority !== "none" ||
      fixture.authority.readinessOverrideAuthority !== "none" || fixture.promotionAllowed !== false) {
    throw new Error("BT3 IFVG v1/v4 fixture authority is invalid.");
  }
  const emits = fixture.detectionState === "trade_plan_constructed" && fixture.blockers.length === 0;
  if (emits !== Boolean(fixture.geometry)) throw new Error("BT3 IFVG v1/v4 geometry and blocker state are inconsistent.");
};

export async function adaptIfvgV1V4Fixture(input: {
  readonly fixture: Readonly<IfvgV1V4Fixture>;
  readonly snapshotHash: string;
}): Promise<Readonly<IfvgV1V4Parity>> {
  const { fixture, snapshotHash } = input;
  if (!SHA256_PATTERN.test(snapshotHash)) throw new Error("BT3 IFVG v1/v4 snapshot hash is invalid.");
  validateFixture(fixture);
  const qualifiedSnapshotHash = `sha256:${snapshotHash}`;
  const fixtureDatasetId = await canonicalHash({
    kind: "bt3-ifvg-v1-v4-fixture-dataset-v1",
    qualifiedSnapshotHash,
    fixtureId: fixture.identity.fixtureId,
    sourceFingerprint: fixture.identity.sourceFingerprint
  });
  const fixtureCertificateId = await canonicalHash({
    kind: "bt3-ifvg-v1-v4-fixture-certificate-v1",
    fixtureDatasetId,
    sourceCommit: fixture.identity.sourceCommit
  });
  const contextLineageRoot = await canonicalHash({
    kind: "bt3-ifvg-v1-v4-context-v1",
    fixtureDatasetId,
    fixtureId: fixture.identity.fixtureId,
    lastClosedCandle: fixture.identity.lastClosedCandle
  });
  let opportunity: Readonly<CanonicalOpportunity> | undefined;
  if (fixture.geometry) {
    const decisionAt = new Date(Date.parse(fixture.identity.lastClosedCandle) + FIVE_MINUTES_MS);
    opportunity = await buildCanonicalOpportunity({
      adapterVersion: "bt3-ifvg-v1-v4-fixture-adapter-v1",
      datasetCertificateId: fixtureCertificateId,
      datasetId: fixtureDatasetId,
      strategyId: fixture.identity.strategyId,
      profileVersion: fixture.identity.profileVersion,
      parameterHash: await canonicalHash({
        strategyId: fixture.identity.strategyId,
        profileVersion: fixture.identity.profileVersion,
        parameterFingerprint: fixture.identity.parameterFingerprint
      }),
      requestedSymbol: fixture.identity.requestedSymbol,
      brokerSymbol: fixture.identity.brokerSymbol,
      timeframe: fixture.identity.timeframe,
      decisionAtUtc: decisionAt.toISOString(),
      sourceCandleClosedAtUtc: decisionAt.toISOString(),
      contextLineageRoot,
      direction: fixture.geometry.side,
      orderPolicy: "limit_at_price",
      activatesAtUtc: decisionAt.toISOString(),
      expiresAtUtc: new Date(decisionAt.getTime() + 2 * 60 * 60_000).toISOString(),
      signalPrice: fixture.geometry.entry,
      entryPrice: fixture.geometry.entry,
      stopPrice: fixture.geometry.stop,
      targetPrices: Object.freeze([fixture.geometry.target]),
      eligible: true,
      blockers: Object.freeze([])
    });
  }
  const core: Readonly<IfvgV1V4ParityCore> = Object.freeze({
    schemaVersion: "gotrader-bt3-ifvg-v1-v4-parity-v1",
    adapterVersion: "bt3-ifvg-v1-v4-fixture-adapter-v1",
    snapshotHash: qualifiedSnapshotHash,
    fixtureDatasetId,
    fixtureCertificateId,
    contextLineageRoot,
    fixtureId: fixture.identity.fixtureId,
    strategyId: fixture.identity.strategyId,
    profileVersion: fixture.identity.profileVersion,
    classification: fixture.identity.classification,
    sourceFingerprint: fixture.identity.sourceFingerprint,
    detectionState: fixture.detectionState,
    blockers: Object.freeze([...fixture.blockers]),
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

export async function compareIfvgV1V4Parity(fixture: Readonly<IfvgV1V4Fixture>, result: Readonly<IfvgV1V4Parity>) {
  const blockers: string[] = [];
  const { parityId, ...core } = result;
  if (await canonicalHash(core) !== parityId) blockers.push("bt3_ifvg_v1_v4_parity_id_invalid");
  if (result.fixtureId !== fixture.identity.fixtureId) blockers.push("bt3_ifvg_v1_v4_fixture_id_drift");
  if (result.strategyId !== fixture.identity.strategyId || result.profileVersion !== fixture.identity.profileVersion) blockers.push("bt3_ifvg_v1_v4_profile_drift");
  if (result.classification !== fixture.identity.classification) blockers.push("bt3_ifvg_v1_v4_classification_drift");
  if (JSON.stringify(result.blockers) !== JSON.stringify(fixture.blockers)) blockers.push("bt3_ifvg_v1_v4_blocker_drift");
  if (Boolean(result.opportunity) !== Boolean(fixture.geometry)) blockers.push("bt3_ifvg_v1_v4_opportunity_presence_drift");
  if (result.opportunity && fixture.geometry &&
      (result.opportunity.direction !== fixture.geometry.side || result.opportunity.entryPrice !== fixture.geometry.entry ||
       result.opportunity.stopPrice !== fixture.geometry.stop || result.opportunity.targetPrices[0] !== fixture.geometry.target)) {
    blockers.push("bt3_ifvg_v1_v4_geometry_drift");
  }
  if (result.promotionAllowed || result.historicalDatasetQualified || result.rawCandlesSerialized) blockers.push("bt3_ifvg_v1_v4_scope_violation");
  return Object.freeze([...new Set(blockers)].sort());
}
