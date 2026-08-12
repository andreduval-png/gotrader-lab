import { canonicalHash } from "../canonical/canonicalValueSerialization";
import { buildCanonicalOpportunity } from "../backtestSimulation/simulationContracts";
import { SIMULATION_AUTHORITY_NONE, SIMULATION_CAPABILITIES_DISABLED } from "../backtestSimulation/simulationAuthority";
import type { CanonicalOpportunity } from "../backtestSimulation/simulationTypes";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

type SessionRaidStrategyId =
  | "nasdaq_london_raid_ny_reversal_v1"
  | "nasdaq_london_raid_ny_reversal_v2_filtered_research";

export interface SessionRaidFixture {
  readonly schemaVersion: "gotrader-bt3-session-raid-fixture-v1";
  readonly identity: {
    readonly fixtureId: string;
    readonly strategyId: SessionRaidStrategyId;
    readonly profileVersion: "v1" | "v2";
    readonly classification: "strict_research" | "insufficient_sample_control";
    readonly sourceCommit: string;
    readonly requestedSymbol: string;
    readonly brokerSymbol: string;
    readonly sourceFingerprint: string;
    readonly timeframe: "15m";
    readonly generatedAt: string;
    readonly sourceSignalCandleOpen: string;
    readonly sessionClosesAtUtc: string;
    readonly parameterFingerprint: string;
  };
  readonly detectionState: string;
  readonly blockers: readonly string[];
  readonly missingConditions: readonly string[];
  readonly failedFilters: readonly string[];
  readonly filterPassed?: boolean;
  readonly replayOutcome?: string;
  readonly geometry?: { readonly side: "short"; readonly entry: number; readonly stop: number; readonly target: number; readonly rr: number };
  readonly audit:
    | { readonly profileVersion: "v1"; readonly candidateCount: 12; readonly uniqueDateCount: 12;
        readonly targetFirstCount: 3; readonly invalidationFirstCount: 9; readonly targetFirstRatePercent: 25;
        readonly walkForwardVerdict: "blocked" }
    | { readonly profileVersion: "v2"; readonly retainedCandidateCount: 1; readonly uniqueDateCount: 1;
        readonly sampleVerdict: "insufficient"; readonly scannerGeometryOwned: false };
  readonly promotionAllowed: false;
  readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
}

export interface SessionRaidParityCore {
  readonly schemaVersion: "gotrader-bt3-session-raid-parity-v1";
  readonly adapterVersion: "bt3-session-raid-fixture-adapter-v1";
  readonly snapshotHash: string;
  readonly fixtureDatasetId: string;
  readonly fixtureCertificateId: string;
  readonly contextLineageRoot: string;
  readonly fixtureId: string;
  readonly strategyId: SessionRaidStrategyId;
  readonly profileVersion: "v1" | "v2";
  readonly classification: "strict_research" | "insufficient_sample_control";
  readonly detectionState: string;
  readonly blockers: readonly string[];
  readonly failedFilters: readonly string[];
  readonly audit: SessionRaidFixture["audit"];
  readonly opportunity?: Readonly<CanonicalOpportunity>;
  readonly promotionAllowed: false;
  readonly fixtureOnly: true;
  readonly historicalDatasetQualified: false;
  readonly rawCandlesSerialized: false;
  readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
  readonly capabilities: Readonly<typeof SIMULATION_CAPABILITIES_DISABLED>;
}

export interface SessionRaidParity extends SessionRaidParityCore { readonly parityId: string }

const validateFixture = (fixture: Readonly<SessionRaidFixture>) => {
  const { identity } = fixture;
  const isV1 = identity.profileVersion === "v1";
  const expectedStrategy = isV1 ? "nasdaq_london_raid_ny_reversal_v1" : "nasdaq_london_raid_ny_reversal_v2_filtered_research";
  const expectedClass = isV1 ? "strict_research" : "insufficient_sample_control";
  if (fixture.schemaVersion !== "gotrader-bt3-session-raid-fixture-v1" || identity.strategyId !== expectedStrategy ||
      identity.classification !== expectedClass || fixture.audit.profileVersion !== identity.profileVersion) {
    throw new Error("BT3 Session Raid fixture identity is inconsistent.");
  }
  const generatedAt = Date.parse(identity.generatedAt);
  const sourceClose = Date.parse(identity.sourceSignalCandleOpen) + 15 * 60_000;
  const sessionClose = Date.parse(identity.sessionClosesAtUtc);
  if (![generatedAt, sourceClose, sessionClose].every(Number.isFinite) || generatedAt < sourceClose || sessionClose <= generatedAt) {
    throw new Error("BT3 Session Raid timing is invalid.");
  }
  if (fixture.authority.executionAuthority !== "none" || fixture.authority.brokerAuthority !== "none" ||
      fixture.authority.readinessOverrideAuthority !== "none" || fixture.promotionAllowed !== false) {
    throw new Error("BT3 Session Raid authority is invalid.");
  }
  if (isV1) {
    const audit = fixture.audit as Extract<SessionRaidFixture["audit"], { profileVersion: "v1" }>;
    if (audit.candidateCount !== 12 || audit.uniqueDateCount !== 12 || audit.targetFirstCount !== 3 ||
        audit.invalidationFirstCount !== 9 || audit.targetFirstRatePercent !== 25 || audit.walkForwardVerdict !== "blocked") {
      throw new Error("BT3 Session Raid v1 audited boundary is invalid.");
    }
    const mayEmit = fixture.detectionState === "complete_bearish_reversal_candidate" && fixture.blockers.length === 0;
    if (mayEmit !== Boolean(fixture.geometry)) throw new Error("BT3 Session Raid v1 geometry and detector eligibility are inconsistent.");
  } else {
    const audit = fixture.audit as Extract<SessionRaidFixture["audit"], { profileVersion: "v2" }>;
    if (audit.retainedCandidateCount !== 1 || audit.uniqueDateCount !== 1 || audit.sampleVerdict !== "insufficient" ||
        audit.scannerGeometryOwned !== false) throw new Error("BT3 Session Raid v2 audited boundary is invalid.");
    if (fixture.geometry) throw new Error("BT3 Session Raid v2 does not own canonical geometry.");
  }
  if (fixture.geometry) {
    const { entry, stop, target, rr } = fixture.geometry;
    if (![entry, stop, target, rr].every(Number.isFinite) || !(stop > entry && target < entry && rr >= 2)) {
      throw new Error("BT3 Session Raid native short geometry is invalid.");
    }
  }
};

export async function adaptSessionRaidFixture(input: { readonly fixture: Readonly<SessionRaidFixture>; readonly snapshotHash: string }) {
  const { fixture, snapshotHash } = input;
  if (!SHA256_PATTERN.test(snapshotHash)) throw new Error("BT3 Session Raid snapshot hash is invalid.");
  validateFixture(fixture);
  const qualifiedSnapshotHash = `sha256:${snapshotHash}`;
  const fixtureDatasetId = await canonicalHash({ kind: "bt3-session-raid-fixture-dataset-v1", qualifiedSnapshotHash,
    fixtureId: fixture.identity.fixtureId, sourceFingerprint: fixture.identity.sourceFingerprint });
  const fixtureCertificateId = await canonicalHash({ kind: "bt3-session-raid-fixture-certificate-v1", fixtureDatasetId,
    sourceCommit: fixture.identity.sourceCommit });
  const contextLineageRoot = await canonicalHash({ kind: "bt3-session-raid-context-v1", fixtureDatasetId,
    fixtureId: fixture.identity.fixtureId, generatedAt: fixture.identity.generatedAt, profileVersion: fixture.identity.profileVersion });
  let opportunity: Readonly<CanonicalOpportunity> | undefined;
  if (fixture.geometry) {
    const sourceCandleClosedAtUtc = new Date(Date.parse(fixture.identity.sourceSignalCandleOpen) + 15 * 60_000).toISOString();
    opportunity = await buildCanonicalOpportunity({ adapterVersion: "bt3-session-raid-fixture-adapter-v1",
      datasetCertificateId: fixtureCertificateId, datasetId: fixtureDatasetId, strategyId: fixture.identity.strategyId,
      profileVersion: fixture.identity.profileVersion, parameterHash: await canonicalHash({ strategyId: fixture.identity.strategyId,
        parameterFingerprint: fixture.identity.parameterFingerprint }), requestedSymbol: fixture.identity.requestedSymbol,
      brokerSymbol: fixture.identity.brokerSymbol, timeframe: fixture.identity.timeframe,
      decisionAtUtc: fixture.identity.generatedAt, sourceCandleClosedAtUtc, contextLineageRoot, direction: "short",
      orderPolicy: "limit_at_price", activatesAtUtc: fixture.identity.generatedAt,
      expiresAtUtc: fixture.identity.sessionClosesAtUtc, signalPrice: fixture.geometry.entry,
      entryPrice: fixture.geometry.entry, stopPrice: fixture.geometry.stop,
      targetPrices: Object.freeze([fixture.geometry.target]), eligible: true, blockers: Object.freeze([]) });
  }
  const core: Readonly<SessionRaidParityCore> = Object.freeze({ schemaVersion: "gotrader-bt3-session-raid-parity-v1",
    adapterVersion: "bt3-session-raid-fixture-adapter-v1", snapshotHash: qualifiedSnapshotHash, fixtureDatasetId,
    fixtureCertificateId, contextLineageRoot, fixtureId: fixture.identity.fixtureId, strategyId: fixture.identity.strategyId,
    profileVersion: fixture.identity.profileVersion, classification: fixture.identity.classification,
    detectionState: fixture.detectionState, blockers: Object.freeze([...fixture.blockers]),
    failedFilters: Object.freeze([...fixture.failedFilters]), audit: fixture.audit, ...(opportunity ? { opportunity } : {}),
    promotionAllowed: false, fixtureOnly: true, historicalDatasetQualified: false, rawCandlesSerialized: false,
    authority: SIMULATION_AUTHORITY_NONE, capabilities: SIMULATION_CAPABILITIES_DISABLED });
  return Object.freeze({ ...core, parityId: await canonicalHash(core) });
}

export async function compareSessionRaidParity(fixture: Readonly<SessionRaidFixture>, result: Readonly<SessionRaidParity>) {
  const blockers: string[] = [];
  const { parityId, ...core } = result;
  if (await canonicalHash(core) !== parityId) blockers.push("bt3_session_raid_parity_id_invalid");
  if (result.fixtureId !== fixture.identity.fixtureId) blockers.push("bt3_session_raid_fixture_id_drift");
  if (JSON.stringify(result.blockers) !== JSON.stringify(fixture.blockers)) blockers.push("bt3_session_raid_blocker_drift");
  if (JSON.stringify(result.failedFilters) !== JSON.stringify(fixture.failedFilters)) blockers.push("bt3_session_raid_filter_drift");
  if (Boolean(result.opportunity) !== Boolean(fixture.geometry)) blockers.push("bt3_session_raid_opportunity_presence_drift");
  if (result.opportunity && fixture.geometry && (result.opportunity.direction !== "short" ||
      result.opportunity.entryPrice !== fixture.geometry.entry || result.opportunity.stopPrice !== fixture.geometry.stop ||
      result.opportunity.targetPrices[0] !== fixture.geometry.target || result.opportunity.decisionAtUtc !== fixture.identity.generatedAt ||
      result.opportunity.expiresAtUtc !== fixture.identity.sessionClosesAtUtc)) blockers.push("bt3_session_raid_geometry_or_timing_drift");
  if (JSON.stringify(result.audit) !== JSON.stringify(fixture.audit)) blockers.push("bt3_session_raid_audit_drift");
  if (result.promotionAllowed || result.historicalDatasetQualified || result.rawCandlesSerialized) blockers.push("bt3_session_raid_scope_violation");
  return Object.freeze([...new Set(blockers)].sort());
}
