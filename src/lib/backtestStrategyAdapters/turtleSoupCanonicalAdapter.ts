import { canonicalHash } from "../canonical/canonicalValueSerialization";
import { buildCanonicalOpportunity } from "../backtestSimulation/simulationContracts";
import { SIMULATION_AUTHORITY_NONE, SIMULATION_CAPABILITIES_DISABLED } from "../backtestSimulation/simulationAuthority";
import type { CanonicalOpportunity } from "../backtestSimulation/simulationTypes";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export interface TurtleSoupFixture {
  readonly schemaVersion: "gotrader-bt3-turtle-soup-fixture-v1";
  readonly identity: {
    readonly fixtureId: string;
    readonly strategyId: "turtle_soup_v1";
    readonly profileVersion: "v1";
    readonly classification: "diagnostic_control";
    readonly sourceCommit: string;
    readonly requestedSymbol: string;
    readonly brokerSymbol: string;
    readonly sourceFingerprint: string;
    readonly setupTimeframe: "15m" | "1h";
    readonly entryTimeframe: "5m";
    readonly generatedAt: string;
    readonly lastClosedCandleOpen: string;
    readonly sessionClosesAtUtc: string;
    readonly parameterFingerprint: string;
  };
  readonly detectionState: string;
  readonly sessionId: "new_york_open";
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
  };
  readonly auditedHistoricalCandidateCount: 0;
  readonly auditedRobustness: "needs_more_data";
  readonly promotionAllowed: false;
  readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
}

export interface TurtleSoupParityCore {
  readonly schemaVersion: "gotrader-bt3-turtle-soup-parity-v1";
  readonly adapterVersion: "bt3-turtle-soup-fixture-adapter-v1";
  readonly snapshotHash: string;
  readonly fixtureDatasetId: string;
  readonly fixtureCertificateId: string;
  readonly contextLineageRoot: string;
  readonly fixtureId: string;
  readonly strategyId: "turtle_soup_v1";
  readonly classification: "diagnostic_control";
  readonly detectionState: string;
  readonly blockers: readonly string[];
  readonly opportunity?: Readonly<CanonicalOpportunity>;
  readonly auditedHistoricalCandidateCount: 0;
  readonly auditedRobustness: "needs_more_data";
  readonly promotionAllowed: false;
  readonly fixtureOnly: true;
  readonly historicalDatasetQualified: false;
  readonly rawCandlesSerialized: false;
  readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
  readonly capabilities: Readonly<typeof SIMULATION_CAPABILITIES_DISABLED>;
}

export interface TurtleSoupParity extends TurtleSoupParityCore { readonly parityId: string; }

const validateFixture = (fixture: Readonly<TurtleSoupFixture>) => {
  if (fixture.schemaVersion !== "gotrader-bt3-turtle-soup-fixture-v1" || fixture.identity.strategyId !== "turtle_soup_v1" ||
      fixture.identity.profileVersion !== "v1" || fixture.identity.classification !== "diagnostic_control") {
    throw new Error("BT3 Turtle Soup fixture identity is inconsistent.");
  }
  const generatedAt = Date.parse(fixture.identity.generatedAt);
  const sourceClose = Date.parse(fixture.identity.lastClosedCandleOpen) + 5 * 60_000;
  const sessionClose = Date.parse(fixture.identity.sessionClosesAtUtc);
  if (![generatedAt, sourceClose, sessionClose].every(Number.isFinite) || generatedAt < sourceClose || sessionClose <= generatedAt) {
    throw new Error("BT3 Turtle Soup timing is invalid.");
  }
  if (fixture.auditedHistoricalCandidateCount !== 0 || fixture.auditedRobustness !== "needs_more_data") {
    throw new Error("BT3 Turtle Soup audited diagnostic boundary is invalid.");
  }
  if (fixture.authority.executionAuthority !== "none" || fixture.authority.brokerAuthority !== "none" ||
      fixture.authority.readinessOverrideAuthority !== "none" || fixture.promotionAllowed !== false) {
    throw new Error("BT3 Turtle Soup fixture authority is invalid.");
  }
  const mayEmit = fixture.detectionState === "replay_required" && fixture.blockers.length === 0;
  if (mayEmit !== Boolean(fixture.geometry)) throw new Error("BT3 Turtle Soup geometry and detector eligibility are inconsistent.");
  if (fixture.geometry) {
    const { side, entry, stop, target, rr } = fixture.geometry;
    const valid = [entry, stop, target, rr].every(Number.isFinite) && rr >= 2.5 &&
      (side === "long" ? stop < entry && target > entry : stop > entry && target < entry);
    if (!valid) throw new Error("BT3 Turtle Soup native geometry is invalid.");
  }
};

export async function adaptTurtleSoupFixture(input: { readonly fixture: Readonly<TurtleSoupFixture>; readonly snapshotHash: string; }) {
  const { fixture, snapshotHash } = input;
  if (!SHA256_PATTERN.test(snapshotHash)) throw new Error("BT3 Turtle Soup snapshot hash is invalid.");
  validateFixture(fixture);
  const qualifiedSnapshotHash = `sha256:${snapshotHash}`;
  const fixtureDatasetId = await canonicalHash({ kind: "bt3-turtle-soup-fixture-dataset-v1", qualifiedSnapshotHash,
    fixtureId: fixture.identity.fixtureId, sourceFingerprint: fixture.identity.sourceFingerprint });
  const fixtureCertificateId = await canonicalHash({ kind: "bt3-turtle-soup-fixture-certificate-v1", fixtureDatasetId,
    sourceCommit: fixture.identity.sourceCommit });
  const contextLineageRoot = await canonicalHash({ kind: "bt3-turtle-soup-context-v1", fixtureDatasetId,
    fixtureId: fixture.identity.fixtureId, generatedAt: fixture.identity.generatedAt, sessionId: fixture.sessionId });
  let opportunity: Readonly<CanonicalOpportunity> | undefined;
  if (fixture.geometry) {
    const sourceCandleClosedAtUtc = new Date(Date.parse(fixture.identity.lastClosedCandleOpen) + 5 * 60_000).toISOString();
    opportunity = await buildCanonicalOpportunity({
      adapterVersion: "bt3-turtle-soup-fixture-adapter-v1", datasetCertificateId: fixtureCertificateId,
      datasetId: fixtureDatasetId, strategyId: fixture.identity.strategyId, profileVersion: fixture.identity.profileVersion,
      parameterHash: await canonicalHash({ strategyId: fixture.identity.strategyId,
        parameterFingerprint: fixture.identity.parameterFingerprint }), requestedSymbol: fixture.identity.requestedSymbol,
      brokerSymbol: fixture.identity.brokerSymbol, timeframe: fixture.identity.entryTimeframe,
      decisionAtUtc: fixture.identity.generatedAt, sourceCandleClosedAtUtc, contextLineageRoot,
      direction: fixture.geometry.side, orderPolicy: "limit_at_price", activatesAtUtc: fixture.identity.generatedAt,
      expiresAtUtc: fixture.identity.sessionClosesAtUtc, signalPrice: fixture.geometry.entry,
      entryPrice: fixture.geometry.entry, stopPrice: fixture.geometry.stop,
      targetPrices: Object.freeze([fixture.geometry.target]), eligible: true, blockers: Object.freeze([])
    });
  }
  const core: Readonly<TurtleSoupParityCore> = Object.freeze({
    schemaVersion: "gotrader-bt3-turtle-soup-parity-v1", adapterVersion: "bt3-turtle-soup-fixture-adapter-v1",
    snapshotHash: qualifiedSnapshotHash, fixtureDatasetId, fixtureCertificateId, contextLineageRoot,
    fixtureId: fixture.identity.fixtureId, strategyId: "turtle_soup_v1", classification: "diagnostic_control",
    detectionState: fixture.detectionState, blockers: Object.freeze([...fixture.blockers]), ...(opportunity ? { opportunity } : {}),
    auditedHistoricalCandidateCount: 0, auditedRobustness: "needs_more_data", promotionAllowed: false,
    fixtureOnly: true, historicalDatasetQualified: false, rawCandlesSerialized: false,
    authority: SIMULATION_AUTHORITY_NONE, capabilities: SIMULATION_CAPABILITIES_DISABLED
  });
  return Object.freeze({ ...core, parityId: await canonicalHash(core) });
}

export async function compareTurtleSoupParity(fixture: Readonly<TurtleSoupFixture>, result: Readonly<TurtleSoupParity>) {
  const blockers: string[] = [];
  const { parityId, ...core } = result;
  if (await canonicalHash(core) !== parityId) blockers.push("bt3_turtle_soup_parity_id_invalid");
  if (result.fixtureId !== fixture.identity.fixtureId) blockers.push("bt3_turtle_soup_fixture_id_drift");
  if (JSON.stringify(result.blockers) !== JSON.stringify(fixture.blockers)) blockers.push("bt3_turtle_soup_blocker_drift");
  if (Boolean(result.opportunity) !== Boolean(fixture.geometry)) blockers.push("bt3_turtle_soup_opportunity_presence_drift");
  if (result.opportunity && fixture.geometry &&
      (result.opportunity.direction !== fixture.geometry.side || result.opportunity.entryPrice !== fixture.geometry.entry ||
       result.opportunity.stopPrice !== fixture.geometry.stop || result.opportunity.targetPrices[0] !== fixture.geometry.target ||
       result.opportunity.decisionAtUtc !== fixture.identity.generatedAt || result.opportunity.expiresAtUtc !== fixture.identity.sessionClosesAtUtc)) {
    blockers.push("bt3_turtle_soup_geometry_or_timing_drift");
  }
  if (result.auditedHistoricalCandidateCount !== 0 || result.auditedRobustness !== "needs_more_data") blockers.push("bt3_turtle_soup_audit_drift");
  if (result.promotionAllowed || result.historicalDatasetQualified || result.rawCandlesSerialized) blockers.push("bt3_turtle_soup_scope_violation");
  return Object.freeze([...new Set(blockers)].sort());
}
