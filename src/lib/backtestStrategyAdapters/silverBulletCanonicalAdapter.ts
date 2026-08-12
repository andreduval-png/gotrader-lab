import { canonicalHash } from "../canonical/canonicalValueSerialization";
import { buildCanonicalOpportunity } from "../backtestSimulation/simulationContracts";
import { SIMULATION_AUTHORITY_NONE, SIMULATION_CAPABILITIES_DISABLED } from "../backtestSimulation/simulationAuthority";
import type { CanonicalOpportunity } from "../backtestSimulation/simulationTypes";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export interface SilverBulletFixture {
  readonly schemaVersion: "gotrader-bt3-silver-bullet-fixture-v1";
  readonly identity: {
    readonly fixtureId: string;
    readonly strategyId: "silver_bullet_v1" | "silver_bullet_v2_refined_research";
    readonly profileVersion: "v1" | "v2";
    readonly classification: "negative_control" | "strict_research";
    readonly sourceCommit: string;
    readonly requestedSymbol: string;
    readonly brokerSymbol: string;
    readonly sourceFingerprint: string;
    readonly timeframe: "1m";
    readonly generatedAt: string;
    readonly lastClosedCandleOpen: string;
    readonly sessionClosesAtUtc: string;
    readonly parameterFingerprint: string;
  };
  readonly detectionState: string;
  readonly sessionId: "new_york_am";
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly presentConditions: readonly string[];
  readonly missingConditions: readonly string[];
  readonly geometry?: {
    readonly side: "long" | "short";
    readonly entry: number;
    readonly stop: number;
    readonly target: number;
    readonly rr: number;
    readonly returnToFvgTimestamp: string;
  };
  readonly promotionAllowed: false;
  readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
}

export interface SilverBulletParityCore {
  readonly schemaVersion: "gotrader-bt3-silver-bullet-parity-v1";
  readonly adapterVersion: "bt3-silver-bullet-fixture-adapter-v1";
  readonly snapshotHash: string;
  readonly fixtureDatasetId: string;
  readonly fixtureCertificateId: string;
  readonly contextLineageRoot: string;
  readonly fixtureId: string;
  readonly strategyId: string;
  readonly profileVersion: string;
  readonly classification: "negative_control" | "strict_research";
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

export interface SilverBulletParity extends SilverBulletParityCore {
  readonly parityId: string;
}

const validateFixture = (fixture: Readonly<SilverBulletFixture>) => {
  if (fixture.schemaVersion !== "gotrader-bt3-silver-bullet-fixture-v1") {
    throw new Error("BT3 Silver Bullet fixture schema is unsupported.");
  }
  const isV1 = fixture.identity.profileVersion === "v1";
  if (isV1 !== (fixture.identity.strategyId === "silver_bullet_v1") ||
      isV1 !== (fixture.identity.classification === "negative_control")) {
    throw new Error("BT3 Silver Bullet profile identity is inconsistent.");
  }
  const generatedAt = Date.parse(fixture.identity.generatedAt);
  const sourceClose = Date.parse(fixture.identity.lastClosedCandleOpen) + 60_000;
  const sessionClose = Date.parse(fixture.identity.sessionClosesAtUtc);
  if (![generatedAt, sourceClose, sessionClose].every(Number.isFinite) || generatedAt < sourceClose || sessionClose <= generatedAt) {
    throw new Error("BT3 Silver Bullet timing is invalid.");
  }
  if (fixture.authority.executionAuthority !== "none" || fixture.authority.brokerAuthority !== "none" ||
      fixture.authority.readinessOverrideAuthority !== "none" || fixture.promotionAllowed !== false) {
    throw new Error("BT3 Silver Bullet fixture authority is invalid.");
  }
  const mayEmit = fixture.detectionState === "replay_required" && fixture.blockers.length === 0;
  if (mayEmit !== Boolean(fixture.geometry)) {
    throw new Error("BT3 Silver Bullet geometry and detector eligibility are inconsistent.");
  }
  if (fixture.geometry) {
    const { side, entry, stop, target, rr } = fixture.geometry;
    const validGeometry = [entry, stop, target, rr].every(Number.isFinite) && rr >= 2 &&
      (side === "long" ? stop < entry && target > entry : stop > entry && target < entry);
    if (!validGeometry) throw new Error("BT3 Silver Bullet native geometry is invalid.");
  }
};

export async function adaptSilverBulletFixture(input: {
  readonly fixture: Readonly<SilverBulletFixture>;
  readonly snapshotHash: string;
}): Promise<Readonly<SilverBulletParity>> {
  const { fixture, snapshotHash } = input;
  if (!SHA256_PATTERN.test(snapshotHash)) throw new Error("BT3 Silver Bullet snapshot hash is invalid.");
  validateFixture(fixture);
  const qualifiedSnapshotHash = `sha256:${snapshotHash}`;
  const fixtureDatasetId = await canonicalHash({
    kind: "bt3-silver-bullet-fixture-dataset-v1",
    qualifiedSnapshotHash,
    fixtureId: fixture.identity.fixtureId,
    sourceFingerprint: fixture.identity.sourceFingerprint
  });
  const fixtureCertificateId = await canonicalHash({
    kind: "bt3-silver-bullet-fixture-certificate-v1",
    fixtureDatasetId,
    sourceCommit: fixture.identity.sourceCommit
  });
  const contextLineageRoot = await canonicalHash({
    kind: "bt3-silver-bullet-context-v1",
    fixtureDatasetId,
    fixtureId: fixture.identity.fixtureId,
    generatedAt: fixture.identity.generatedAt,
    sessionId: fixture.sessionId
  });
  let opportunity: Readonly<CanonicalOpportunity> | undefined;
  if (fixture.geometry) {
    const sourceCandleClosedAtUtc = new Date(Date.parse(fixture.identity.lastClosedCandleOpen) + 60_000).toISOString();
    opportunity = await buildCanonicalOpportunity({
      adapterVersion: "bt3-silver-bullet-fixture-adapter-v1",
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
      decisionAtUtc: fixture.identity.generatedAt,
      sourceCandleClosedAtUtc,
      contextLineageRoot,
      direction: fixture.geometry.side,
      orderPolicy: "limit_at_price",
      activatesAtUtc: fixture.identity.generatedAt,
      expiresAtUtc: fixture.identity.sessionClosesAtUtc,
      signalPrice: fixture.geometry.entry,
      entryPrice: fixture.geometry.entry,
      stopPrice: fixture.geometry.stop,
      targetPrices: Object.freeze([fixture.geometry.target]),
      eligible: true,
      blockers: Object.freeze([])
    });
  }
  const core: Readonly<SilverBulletParityCore> = Object.freeze({
    schemaVersion: "gotrader-bt3-silver-bullet-parity-v1",
    adapterVersion: "bt3-silver-bullet-fixture-adapter-v1",
    snapshotHash: qualifiedSnapshotHash,
    fixtureDatasetId,
    fixtureCertificateId,
    contextLineageRoot,
    fixtureId: fixture.identity.fixtureId,
    strategyId: fixture.identity.strategyId,
    profileVersion: fixture.identity.profileVersion,
    classification: fixture.identity.classification,
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

export async function compareSilverBulletParity(
  fixture: Readonly<SilverBulletFixture>,
  result: Readonly<SilverBulletParity>
) {
  const blockers: string[] = [];
  const { parityId, ...core } = result;
  if (await canonicalHash(core) !== parityId) blockers.push("bt3_silver_bullet_parity_id_invalid");
  if (result.fixtureId !== fixture.identity.fixtureId) blockers.push("bt3_silver_bullet_fixture_id_drift");
  if (result.strategyId !== fixture.identity.strategyId || result.profileVersion !== fixture.identity.profileVersion) {
    blockers.push("bt3_silver_bullet_profile_drift");
  }
  if (result.classification !== fixture.identity.classification) blockers.push("bt3_silver_bullet_classification_drift");
  if (JSON.stringify(result.blockers) !== JSON.stringify(fixture.blockers)) blockers.push("bt3_silver_bullet_blocker_drift");
  if (Boolean(result.opportunity) !== Boolean(fixture.geometry)) blockers.push("bt3_silver_bullet_opportunity_presence_drift");
  if (result.opportunity && fixture.geometry &&
      (result.opportunity.direction !== fixture.geometry.side || result.opportunity.entryPrice !== fixture.geometry.entry ||
       result.opportunity.stopPrice !== fixture.geometry.stop || result.opportunity.targetPrices[0] !== fixture.geometry.target ||
       result.opportunity.decisionAtUtc !== fixture.identity.generatedAt ||
       result.opportunity.expiresAtUtc !== fixture.identity.sessionClosesAtUtc)) {
    blockers.push("bt3_silver_bullet_geometry_or_timing_drift");
  }
  if (result.promotionAllowed || result.historicalDatasetQualified || result.rawCandlesSerialized) {
    blockers.push("bt3_silver_bullet_scope_violation");
  }
  return Object.freeze([...new Set(blockers)].sort());
}
