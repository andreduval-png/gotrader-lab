import { canonicalHash } from "../canonical/canonicalValueSerialization";
import { buildCanonicalOpportunity } from "../backtestSimulation/simulationContracts";
import { SIMULATION_AUTHORITY_NONE, SIMULATION_CAPABILITIES_DISABLED } from "../backtestSimulation/simulationAuthority";
import type { CanonicalOpportunity } from "../backtestSimulation/simulationTypes";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const ACCEPTED_PROFILE_STATUSES = new Set(["approved_research_candidate", "paper_watchlist_candidate", "watchlist_candidate"]);
type Phase2StrategyId = "ict-bread-and-butter-buy" | "ict-bread-and-butter-sell" | "ict-one-shot-one-kill";

export interface Phase2Fixture {
  readonly schemaVersion: "gotrader-bt3-phase2-fixture-v1";
  readonly identity: { readonly fixtureId: string; readonly strategyId: Phase2StrategyId; readonly profileVersion: "phase2_v1";
    readonly sourceCommit: string; readonly requestedSymbol: string; readonly brokerSymbol: string; readonly sourceFingerprint: string;
    readonly timeframe: "5m" | "15m"; readonly generatedAt: string; readonly lastClosedCandleOpen: string;
    readonly expiresAtUtc: string; readonly parameterFingerprint: string; };
  readonly decision: "research_only" | "no_trade";
  readonly side: "long" | "short" | "flat";
  readonly approvedProfileStatus: string;
  readonly blockers: readonly string[];
  readonly geometry?: { readonly entry: number; readonly stop: number; readonly target: number; readonly rr: number };
  readonly promotionAllowed: false;
  readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
}

export interface Phase2ParityCore {
  readonly schemaVersion: "gotrader-bt3-phase2-parity-v1";
  readonly adapterVersion: "bt3-phase2-fixture-adapter-v1";
  readonly snapshotHash: string; readonly fixtureDatasetId: string; readonly fixtureCertificateId: string;
  readonly contextLineageRoot: string; readonly fixtureId: string; readonly strategyId: Phase2StrategyId;
  readonly decision: "research_only" | "no_trade"; readonly side: "long" | "short" | "flat";
  readonly approvedProfileStatus: string; readonly blockers: readonly string[];
  readonly opportunity?: Readonly<CanonicalOpportunity>;
  readonly promotionAllowed: false; readonly fixtureOnly: true; readonly historicalDatasetQualified: false;
  readonly rawCandlesSerialized: false; readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
  readonly capabilities: Readonly<typeof SIMULATION_CAPABILITIES_DISABLED>;
}
export interface Phase2Parity extends Phase2ParityCore { readonly parityId: string }

const mayEmit = (fixture: Readonly<Phase2Fixture>) => fixture.decision === "research_only" && fixture.side !== "flat" &&
  ACCEPTED_PROFILE_STATUSES.has(fixture.approvedProfileStatus) && fixture.blockers.length === 0;

const validateFixture = (fixture: Readonly<Phase2Fixture>) => {
  if (fixture.schemaVersion !== "gotrader-bt3-phase2-fixture-v1" || fixture.identity.profileVersion !== "phase2_v1")
    throw new Error("BT3 Phase 2 fixture identity is inconsistent.");
  const generatedAt = Date.parse(fixture.identity.generatedAt), sourceOpen = Date.parse(fixture.identity.lastClosedCandleOpen);
  const expiresAt = Date.parse(fixture.identity.expiresAtUtc);
  if (![generatedAt, sourceOpen, expiresAt].every(Number.isFinite) || generatedAt < sourceOpen || expiresAt <= generatedAt)
    throw new Error("BT3 Phase 2 timing is invalid.");
  if (fixture.authority.executionAuthority !== "none" || fixture.authority.brokerAuthority !== "none" ||
      fixture.authority.readinessOverrideAuthority !== "none" || fixture.promotionAllowed !== false)
    throw new Error("BT3 Phase 2 fixture authority is invalid.");
  if (mayEmit(fixture) !== Boolean(fixture.geometry)) throw new Error("BT3 Phase 2 geometry and detector eligibility are inconsistent.");
  if (fixture.geometry) {
    const { entry, stop, target, rr } = fixture.geometry;
    const ordered = fixture.side === "long" ? stop < entry && entry < target : target < entry && entry < stop;
    if (![entry, stop, target, rr].every(Number.isFinite) || rr < 2 || !ordered) throw new Error("BT3 Phase 2 native geometry is invalid.");
  }
};

export async function adaptPhase2Fixture(input: { readonly fixture: Readonly<Phase2Fixture>; readonly snapshotHash: string }) {
  const { fixture, snapshotHash } = input;
  if (!SHA256_PATTERN.test(snapshotHash)) throw new Error("BT3 Phase 2 snapshot hash is invalid.");
  validateFixture(fixture);
  const qualifiedSnapshotHash = `sha256:${snapshotHash}`;
  const fixtureDatasetId = await canonicalHash({ kind: "bt3-phase2-fixture-dataset-v1", qualifiedSnapshotHash,
    fixtureId: fixture.identity.fixtureId, sourceFingerprint: fixture.identity.sourceFingerprint });
  const fixtureCertificateId = await canonicalHash({ kind: "bt3-phase2-fixture-certificate-v1", fixtureDatasetId,
    sourceCommit: fixture.identity.sourceCommit });
  const contextLineageRoot = await canonicalHash({ kind: "bt3-phase2-context-v1", fixtureDatasetId,
    fixtureId: fixture.identity.fixtureId, generatedAt: fixture.identity.generatedAt });
  let opportunity: Readonly<CanonicalOpportunity> | undefined;
  if (fixture.geometry && fixture.side !== "flat") {
    opportunity = await buildCanonicalOpportunity({ adapterVersion: "bt3-phase2-fixture-adapter-v1",
      datasetCertificateId: fixtureCertificateId, datasetId: fixtureDatasetId, strategyId: fixture.identity.strategyId,
      profileVersion: "phase2_v1", parameterHash: await canonicalHash({ strategyId: fixture.identity.strategyId,
        parameterFingerprint: fixture.identity.parameterFingerprint }), requestedSymbol: fixture.identity.requestedSymbol,
      brokerSymbol: fixture.identity.brokerSymbol, timeframe: fixture.identity.timeframe,
      decisionAtUtc: fixture.identity.generatedAt, sourceCandleClosedAtUtc: fixture.identity.generatedAt,
      contextLineageRoot, direction: fixture.side, orderPolicy: "limit_at_price", activatesAtUtc: fixture.identity.generatedAt,
      expiresAtUtc: fixture.identity.expiresAtUtc, signalPrice: fixture.geometry.entry, entryPrice: fixture.geometry.entry,
      stopPrice: fixture.geometry.stop, targetPrices: Object.freeze([fixture.geometry.target]), eligible: true,
      blockers: Object.freeze([]) });
  }
  const core: Readonly<Phase2ParityCore> = Object.freeze({ schemaVersion: "gotrader-bt3-phase2-parity-v1",
    adapterVersion: "bt3-phase2-fixture-adapter-v1", snapshotHash: qualifiedSnapshotHash, fixtureDatasetId,
    fixtureCertificateId, contextLineageRoot, fixtureId: fixture.identity.fixtureId, strategyId: fixture.identity.strategyId,
    decision: fixture.decision, side: fixture.side, approvedProfileStatus: fixture.approvedProfileStatus,
    blockers: Object.freeze([...fixture.blockers]), ...(opportunity ? { opportunity } : {}), promotionAllowed: false,
    fixtureOnly: true, historicalDatasetQualified: false, rawCandlesSerialized: false,
    authority: SIMULATION_AUTHORITY_NONE, capabilities: SIMULATION_CAPABILITIES_DISABLED });
  return Object.freeze({ ...core, parityId: await canonicalHash(core) });
}

export async function comparePhase2Parity(fixture: Readonly<Phase2Fixture>, result: Readonly<Phase2Parity>) {
  const blockers: string[] = []; const { parityId, ...core } = result;
  if (await canonicalHash(core) !== parityId) blockers.push("bt3_phase2_parity_id_invalid");
  if (result.fixtureId !== fixture.identity.fixtureId || result.strategyId !== fixture.identity.strategyId) blockers.push("bt3_phase2_identity_drift");
  if (result.decision !== fixture.decision || result.side !== fixture.side || result.approvedProfileStatus !== fixture.approvedProfileStatus)
    blockers.push("bt3_phase2_detector_state_drift");
  if (JSON.stringify(result.blockers) !== JSON.stringify(fixture.blockers)) blockers.push("bt3_phase2_blocker_drift");
  if (Boolean(result.opportunity) !== Boolean(fixture.geometry)) blockers.push("bt3_phase2_opportunity_presence_drift");
  if (result.opportunity && fixture.geometry && (result.opportunity.direction !== fixture.side ||
      result.opportunity.entryPrice !== fixture.geometry.entry || result.opportunity.stopPrice !== fixture.geometry.stop ||
      result.opportunity.targetPrices[0] !== fixture.geometry.target)) blockers.push("bt3_phase2_geometry_drift");
  if (result.promotionAllowed || result.historicalDatasetQualified || result.rawCandlesSerialized) blockers.push("bt3_phase2_scope_violation");
  return Object.freeze([...new Set(blockers)].sort());
}
