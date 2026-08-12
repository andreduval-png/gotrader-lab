import { canonicalHash } from "../canonical/canonicalValueSerialization";
import { buildCanonicalOpportunity } from "../backtestSimulation/simulationContracts";
import { SIMULATION_AUTHORITY_NONE, SIMULATION_CAPABILITIES_DISABLED } from "../backtestSimulation/simulationAuthority";
import type { CanonicalOpportunity } from "../backtestSimulation/simulationTypes";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export interface CmdFixture {
  readonly schemaVersion: "gotrader-bt3-cmd-fixture-v1";
  readonly identity: {
    readonly fixtureId: string;
    readonly strategyId: "ict_cmd_short_paper_watchlist_v1" | "cmd_high_displacement_v2_research";
    readonly profileVersion: "v1" | "v2";
    readonly classification: "behavioral_fixture" | "experimental";
    readonly sourceCommit: string;
    readonly requestedSymbol: string;
    readonly brokerSymbol: string;
    readonly sourceFingerprint: string;
    readonly timeframe: "5m";
    readonly lastClosedCandle: string;
    readonly parameterFingerprint: string;
  };
  readonly detectionState: string;
  readonly blockers: readonly string[];
  readonly geometry?: {
    readonly side: "short";
    readonly entry: number;
    readonly stop: number;
    readonly target: number;
    readonly rr: number;
  };
  readonly promotionAllowed: false;
  readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
}

export interface CmdParityCore {
  readonly schemaVersion: "gotrader-bt3-cmd-parity-v1";
  readonly adapterVersion: "bt3-cmd-fixture-adapter-v1";
  readonly snapshotHash: string;
  readonly fixtureDatasetId: string;
  readonly fixtureCertificateId: string;
  readonly contextLineageRoot: string;
  readonly fixtureId: string;
  readonly strategyId: string;
  readonly profileVersion: string;
  readonly classification: "behavioral_fixture" | "experimental";
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

export interface CmdParity extends CmdParityCore {
  readonly parityId: string;
}

const validateFixture = (fixture: Readonly<CmdFixture>) => {
  if (fixture.schemaVersion !== "gotrader-bt3-cmd-fixture-v1") throw new Error("BT3 CMD fixture schema is unsupported.");
  const isV1 = fixture.identity.profileVersion === "v1";
  if (isV1 !== (fixture.identity.strategyId === "ict_cmd_short_paper_watchlist_v1") ||
      isV1 !== (fixture.identity.classification === "behavioral_fixture")) {
    throw new Error("BT3 CMD profile identity is inconsistent.");
  }
  if (!Number.isFinite(Date.parse(fixture.identity.lastClosedCandle))) throw new Error("BT3 CMD close time is invalid.");
  if (fixture.authority.executionAuthority !== "none" || fixture.authority.brokerAuthority !== "none" ||
      fixture.authority.readinessOverrideAuthority !== "none" || fixture.promotionAllowed !== false) {
    throw new Error("BT3 CMD fixture authority is invalid.");
  }
  const mayEmit = !isV1 && fixture.detectionState === "trade_plan_constructed" && fixture.blockers.length === 0;
  if (mayEmit !== Boolean(fixture.geometry)) throw new Error("BT3 CMD geometry and detector ownership are inconsistent.");
};

export async function adaptCmdFixture(input: {
  readonly fixture: Readonly<CmdFixture>;
  readonly snapshotHash: string;
}): Promise<Readonly<CmdParity>> {
  const { fixture, snapshotHash } = input;
  if (!SHA256_PATTERN.test(snapshotHash)) throw new Error("BT3 CMD snapshot hash is invalid.");
  validateFixture(fixture);
  const qualifiedSnapshotHash = `sha256:${snapshotHash}`;
  const fixtureDatasetId = await canonicalHash({ kind: "bt3-cmd-fixture-dataset-v1", qualifiedSnapshotHash, fixtureId: fixture.identity.fixtureId, sourceFingerprint: fixture.identity.sourceFingerprint });
  const fixtureCertificateId = await canonicalHash({ kind: "bt3-cmd-fixture-certificate-v1", fixtureDatasetId, sourceCommit: fixture.identity.sourceCommit });
  const contextLineageRoot = await canonicalHash({ kind: "bt3-cmd-context-v1", fixtureDatasetId, fixtureId: fixture.identity.fixtureId, lastClosedCandle: fixture.identity.lastClosedCandle });
  let opportunity: Readonly<CanonicalOpportunity> | undefined;
  if (fixture.geometry) {
    const decisionAt = new Date(Date.parse(fixture.identity.lastClosedCandle) + 5 * 60_000);
    opportunity = await buildCanonicalOpportunity({
      adapterVersion: "bt3-cmd-fixture-adapter-v1",
      datasetCertificateId: fixtureCertificateId,
      datasetId: fixtureDatasetId,
      strategyId: fixture.identity.strategyId,
      profileVersion: fixture.identity.profileVersion,
      parameterHash: await canonicalHash({ strategyId: fixture.identity.strategyId, profileVersion: fixture.identity.profileVersion, parameterFingerprint: fixture.identity.parameterFingerprint }),
      requestedSymbol: fixture.identity.requestedSymbol,
      brokerSymbol: fixture.identity.brokerSymbol,
      timeframe: fixture.identity.timeframe,
      decisionAtUtc: decisionAt.toISOString(),
      sourceCandleClosedAtUtc: decisionAt.toISOString(),
      contextLineageRoot,
      direction: "short",
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
  const core: Readonly<CmdParityCore> = Object.freeze({
    schemaVersion: "gotrader-bt3-cmd-parity-v1",
    adapterVersion: "bt3-cmd-fixture-adapter-v1",
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

export async function compareCmdParity(fixture: Readonly<CmdFixture>, result: Readonly<CmdParity>) {
  const blockers: string[] = [];
  const { parityId, ...core } = result;
  if (await canonicalHash(core) !== parityId) blockers.push("bt3_cmd_parity_id_invalid");
  if (result.fixtureId !== fixture.identity.fixtureId) blockers.push("bt3_cmd_fixture_id_drift");
  if (result.strategyId !== fixture.identity.strategyId || result.profileVersion !== fixture.identity.profileVersion) blockers.push("bt3_cmd_profile_drift");
  if (result.classification !== fixture.identity.classification) blockers.push("bt3_cmd_classification_drift");
  if (JSON.stringify(result.blockers) !== JSON.stringify(fixture.blockers)) blockers.push("bt3_cmd_blocker_drift");
  if (Boolean(result.opportunity) !== Boolean(fixture.geometry)) blockers.push("bt3_cmd_opportunity_presence_drift");
  if (result.opportunity && fixture.geometry &&
      (result.opportunity.direction !== "short" || result.opportunity.entryPrice !== fixture.geometry.entry ||
       result.opportunity.stopPrice !== fixture.geometry.stop || result.opportunity.targetPrices[0] !== fixture.geometry.target)) {
    blockers.push("bt3_cmd_geometry_drift");
  }
  if (result.promotionAllowed || result.historicalDatasetQualified || result.rawCandlesSerialized) blockers.push("bt3_cmd_scope_violation");
  return Object.freeze([...new Set(blockers)].sort());
}
