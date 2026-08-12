import { canonicalHash } from "../canonical/canonicalValueSerialization";
import { buildCanonicalOpportunity } from "../backtestSimulation/simulationContracts";
import { SIMULATION_AUTHORITY_NONE, SIMULATION_CAPABILITIES_DISABLED } from "../backtestSimulation/simulationAuthority";
import type { CanonicalOpportunity } from "../backtestSimulation/simulationTypes";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CLOSE_MINUTES = { "5m": 5, "15m": 15 } as const;

export interface CisdFixture {
  readonly schemaVersion: "gotrader-bt3-cisd-fixture-v1";
  readonly identity: {
    readonly fixtureId: string;
    readonly strategyId: "cisd_v1";
    readonly profileVersion: "v1";
    readonly classification: "negative_control";
    readonly sourceCommit: string;
    readonly requestedSymbol: string;
    readonly brokerSymbol: string;
    readonly sourceFingerprint: string;
    readonly timeframe: "5m" | "15m";
    readonly generatedAt: string;
    readonly lastClosedCandleOpen: string;
    readonly expiresAtUtc: string;
    readonly parameterFingerprint: string;
  };
  readonly detectionState: string;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly presentConditions: readonly string[];
  readonly missingConditions: readonly string[];
  readonly geometry?: { readonly side: "long" | "short"; readonly entry: number; readonly stop: number; readonly target: number; readonly rr: number; };
  readonly auditedCandidateCount: 109;
  readonly auditedInvalidationFirstRatePercent: 72.48;
  readonly auditedOosVerdict: "degraded";
  readonly auditedRobustness: "rejected";
  readonly promotionAllowed: false;
  readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
}

export interface CisdParityCore {
  readonly schemaVersion: "gotrader-bt3-cisd-parity-v1";
  readonly adapterVersion: "bt3-cisd-fixture-adapter-v1";
  readonly snapshotHash: string;
  readonly fixtureDatasetId: string;
  readonly fixtureCertificateId: string;
  readonly contextLineageRoot: string;
  readonly fixtureId: string;
  readonly strategyId: "cisd_v1";
  readonly classification: "negative_control";
  readonly detectionState: string;
  readonly blockers: readonly string[];
  readonly opportunity?: Readonly<CanonicalOpportunity>;
  readonly auditedCandidateCount: 109;
  readonly auditedInvalidationFirstRatePercent: 72.48;
  readonly auditedOosVerdict: "degraded";
  readonly auditedRobustness: "rejected";
  readonly promotionAllowed: false;
  readonly fixtureOnly: true;
  readonly historicalDatasetQualified: false;
  readonly rawCandlesSerialized: false;
  readonly authority: Readonly<typeof SIMULATION_AUTHORITY_NONE>;
  readonly capabilities: Readonly<typeof SIMULATION_CAPABILITIES_DISABLED>;
}
export interface CisdParity extends CisdParityCore { readonly parityId: string; }

const validateFixture = (fixture: Readonly<CisdFixture>) => {
  if (fixture.schemaVersion !== "gotrader-bt3-cisd-fixture-v1" || fixture.identity.strategyId !== "cisd_v1" ||
      fixture.identity.profileVersion !== "v1" || fixture.identity.classification !== "negative_control") {
    throw new Error("BT3 CISD fixture identity is inconsistent.");
  }
  const generatedAt = Date.parse(fixture.identity.generatedAt);
  const sourceClose = Date.parse(fixture.identity.lastClosedCandleOpen) + CLOSE_MINUTES[fixture.identity.timeframe] * 60_000;
  const expiresAt = Date.parse(fixture.identity.expiresAtUtc);
  if (![generatedAt, sourceClose, expiresAt].every(Number.isFinite) || generatedAt < sourceClose || expiresAt <= generatedAt) {
    throw new Error("BT3 CISD timing is invalid.");
  }
  if (fixture.auditedCandidateCount !== 109 || fixture.auditedInvalidationFirstRatePercent !== 72.48 ||
      fixture.auditedOosVerdict !== "degraded" || fixture.auditedRobustness !== "rejected") {
    throw new Error("BT3 CISD audited negative-control boundary is invalid.");
  }
  if (fixture.authority.executionAuthority !== "none" || fixture.authority.brokerAuthority !== "none" ||
      fixture.authority.readinessOverrideAuthority !== "none" || fixture.promotionAllowed !== false) {
    throw new Error("BT3 CISD fixture authority is invalid.");
  }
  const mayEmit = fixture.detectionState === "replay_required" && fixture.blockers.length === 0;
  if (mayEmit !== Boolean(fixture.geometry)) throw new Error("BT3 CISD geometry and detector eligibility are inconsistent.");
  if (fixture.geometry) {
    const { side, entry, stop, target, rr } = fixture.geometry;
    const valid = [entry, stop, target, rr].every(Number.isFinite) && rr >= 2 &&
      (side === "long" ? stop < entry && target > entry : stop > entry && target < entry);
    if (!valid) throw new Error("BT3 CISD native geometry is invalid.");
  }
};

export async function adaptCisdFixture(input: { readonly fixture: Readonly<CisdFixture>; readonly snapshotHash: string; }) {
  const { fixture, snapshotHash } = input;
  if (!SHA256_PATTERN.test(snapshotHash)) throw new Error("BT3 CISD snapshot hash is invalid.");
  validateFixture(fixture);
  const qualifiedSnapshotHash = `sha256:${snapshotHash}`;
  const fixtureDatasetId = await canonicalHash({ kind: "bt3-cisd-fixture-dataset-v1", qualifiedSnapshotHash,
    fixtureId: fixture.identity.fixtureId, sourceFingerprint: fixture.identity.sourceFingerprint });
  const fixtureCertificateId = await canonicalHash({ kind: "bt3-cisd-fixture-certificate-v1", fixtureDatasetId,
    sourceCommit: fixture.identity.sourceCommit });
  const contextLineageRoot = await canonicalHash({ kind: "bt3-cisd-context-v1", fixtureDatasetId,
    fixtureId: fixture.identity.fixtureId, generatedAt: fixture.identity.generatedAt });
  let opportunity: Readonly<CanonicalOpportunity> | undefined;
  if (fixture.geometry) {
    const sourceCandleClosedAtUtc = new Date(Date.parse(fixture.identity.lastClosedCandleOpen) +
      CLOSE_MINUTES[fixture.identity.timeframe] * 60_000).toISOString();
    opportunity = await buildCanonicalOpportunity({ adapterVersion: "bt3-cisd-fixture-adapter-v1",
      datasetCertificateId: fixtureCertificateId, datasetId: fixtureDatasetId, strategyId: "cisd_v1", profileVersion: "v1",
      parameterHash: await canonicalHash({ strategyId: "cisd_v1", parameterFingerprint: fixture.identity.parameterFingerprint }),
      requestedSymbol: fixture.identity.requestedSymbol, brokerSymbol: fixture.identity.brokerSymbol,
      timeframe: fixture.identity.timeframe, decisionAtUtc: fixture.identity.generatedAt, sourceCandleClosedAtUtc,
      contextLineageRoot, direction: fixture.geometry.side, orderPolicy: "limit_at_price",
      activatesAtUtc: fixture.identity.generatedAt, expiresAtUtc: fixture.identity.expiresAtUtc,
      signalPrice: fixture.geometry.entry, entryPrice: fixture.geometry.entry, stopPrice: fixture.geometry.stop,
      targetPrices: Object.freeze([fixture.geometry.target]), eligible: true, blockers: Object.freeze([]) });
  }
  const core: Readonly<CisdParityCore> = Object.freeze({ schemaVersion: "gotrader-bt3-cisd-parity-v1",
    adapterVersion: "bt3-cisd-fixture-adapter-v1", snapshotHash: qualifiedSnapshotHash, fixtureDatasetId,
    fixtureCertificateId, contextLineageRoot, fixtureId: fixture.identity.fixtureId, strategyId: "cisd_v1",
    classification: "negative_control", detectionState: fixture.detectionState, blockers: Object.freeze([...fixture.blockers]),
    ...(opportunity ? { opportunity } : {}), auditedCandidateCount: 109, auditedInvalidationFirstRatePercent: 72.48,
    auditedOosVerdict: "degraded", auditedRobustness: "rejected", promotionAllowed: false, fixtureOnly: true,
    historicalDatasetQualified: false, rawCandlesSerialized: false, authority: SIMULATION_AUTHORITY_NONE,
    capabilities: SIMULATION_CAPABILITIES_DISABLED });
  return Object.freeze({ ...core, parityId: await canonicalHash(core) });
}

export async function compareCisdParity(fixture: Readonly<CisdFixture>, result: Readonly<CisdParity>) {
  const blockers: string[] = []; const { parityId, ...core } = result;
  if (await canonicalHash(core) !== parityId) blockers.push("bt3_cisd_parity_id_invalid");
  if (result.fixtureId !== fixture.identity.fixtureId) blockers.push("bt3_cisd_fixture_id_drift");
  if (JSON.stringify(result.blockers) !== JSON.stringify(fixture.blockers)) blockers.push("bt3_cisd_blocker_drift");
  if (Boolean(result.opportunity) !== Boolean(fixture.geometry)) blockers.push("bt3_cisd_opportunity_presence_drift");
  if (result.opportunity && fixture.geometry && (result.opportunity.direction !== fixture.geometry.side ||
      result.opportunity.entryPrice !== fixture.geometry.entry || result.opportunity.stopPrice !== fixture.geometry.stop ||
      result.opportunity.targetPrices[0] !== fixture.geometry.target || result.opportunity.decisionAtUtc !== fixture.identity.generatedAt ||
      result.opportunity.expiresAtUtc !== fixture.identity.expiresAtUtc)) blockers.push("bt3_cisd_geometry_or_timing_drift");
  if (result.auditedCandidateCount !== 109 || result.auditedInvalidationFirstRatePercent !== 72.48 ||
      result.auditedOosVerdict !== "degraded" || result.auditedRobustness !== "rejected") blockers.push("bt3_cisd_audit_drift");
  if (result.promotionAllowed || result.historicalDatasetQualified || result.rawCandlesSerialized) blockers.push("bt3_cisd_scope_violation");
  return Object.freeze([...new Set(blockers)].sort());
}
