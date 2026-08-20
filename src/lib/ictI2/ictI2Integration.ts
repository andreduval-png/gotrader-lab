import type { Ict2022State } from "@/lib/ictI2/ict2022Model";
import { projectIct2022CurrentRead } from "@/lib/ictI2/ict2022Model";
import type { IctJudasState } from "@/lib/ictI2/ictJudasSwingModel";
import { projectIctJudasCurrentRead } from "@/lib/ictI2/ictJudasSwingModel";
import type { IctPo3State } from "@/lib/ictI2/ictPowerOfThreeModel";
import { projectIctPo3CurrentRead } from "@/lib/ictI2/ictPowerOfThreeModel";
import type { IctI2CurrentReadProjection, IctI2ModelCandidate } from "@/lib/ictI2/ictI2Types";

export interface IctI2Bt2Request {
  requestVersion: "ict-i2-bt2-request-v1";
  candidateId: string;
  strategyId: string;
  strategyVersion: string;
  profileId: string;
  parameterHash: string;
  sourceFingerprint: string;
  datasetCertificateId: string;
  symbol: NonNullable<IctI2ModelCandidate<string>["symbol"]>;
  timeframe: NonNullable<IctI2ModelCandidate<string>["timeframe"]>;
  direction: "long" | "short";
  marketTimestamp: string;
  entryZone: readonly [number, number];
  invalidation: number;
  targetLiquidity: number;
  expiresAt: string;
  supportingFactIds: readonly string[];
  ambiguityPolicyOwner: "BT2";
  fillPolicyOwner: "BT2";
  costPolicyOwner: "BT2";
  outcomePolicyOwner: "BT2";
  authority: IctI2ModelCandidate<string>["authority"];
}

export type IctI2Bt2Adaptation =
  | { status: "ready"; request: IctI2Bt2Request; blockers: readonly string[] }
  | { status: "blocked"; blockers: readonly string[] };

export const adaptIctI2CandidateToBt2 = <State extends string>(candidate: IctI2ModelCandidate<State>): IctI2Bt2Adaptation => {
  const blockers = [...candidate.blockers];
  if (candidate.state !== "ACTIVE") blockers.push(`Candidate state ${candidate.state} is not ACTIVE.`);
  if (!candidate.geometry) blockers.push("Canonical geometry intent is missing.");
  if (!candidate.datasetCertificateId) blockers.push("Accepted dataset certificate identity is missing.");
  if (!candidate.symbol || !candidate.timeframe) blockers.push("Candidate symbol/timeframe identity is missing.");
  if (candidate.direction === "none") blockers.push("Directional candidate is missing.");
  if (blockers.length || !candidate.geometry || !candidate.datasetCertificateId || !candidate.symbol || !candidate.timeframe || candidate.direction === "none") {
    return { status: "blocked", blockers: Array.from(new Set(blockers)) };
  }
  const entryZone = Array.isArray(candidate.geometry.entry)
    ? candidate.geometry.entry
    : [candidate.geometry.entry, candidate.geometry.entry];
  return {
    status: "ready",
    blockers: [],
    request: {
      requestVersion: "ict-i2-bt2-request-v1",
      candidateId: candidate.candidateId,
      strategyId: candidate.strategyId,
      strategyVersion: candidate.strategyVersion,
      profileId: candidate.profileId,
      parameterHash: candidate.parameterHash,
      sourceFingerprint: candidate.sourceFingerprint,
      datasetCertificateId: candidate.datasetCertificateId,
      symbol: candidate.symbol,
      timeframe: candidate.timeframe,
      direction: candidate.direction,
      marketTimestamp: candidate.marketTimestamp,
      entryZone: entryZone as readonly [number, number],
      invalidation: candidate.geometry.stop,
      targetLiquidity: candidate.geometry.target,
      expiresAt: candidate.geometry.expiresAt,
      supportingFactIds: candidate.supportingFactIds,
      ambiguityPolicyOwner: "BT2",
      fillPolicyOwner: "BT2",
      costPolicyOwner: "BT2",
      outcomePolicyOwner: "BT2",
      authority: candidate.authority
    }
  };
};

export const assertCompactIctI2Bt2Request = (request: IctI2Bt2Request) => {
  const serialized = JSON.stringify(request);
  const forbidden = /"(candles|rawCandles|orders|positions|account|outcome|targetHit|stopHit|fillPrice)"\s*:/i;
  if (forbidden.test(serialized)) throw new Error("I2 BT2 request crossed a forbidden ownership or raw-data boundary.");
  if (!request.supportingFactIds.length) throw new Error("I2 BT2 request lost canonical fact lineage.");
  if (request.ambiguityPolicyOwner !== "BT2" || request.outcomePolicyOwner !== "BT2") {
    throw new Error("BT2 ownership is incomplete.");
  }
  return { ok: true as const, serializedBytes: serialized.length };
};

export interface IctI2CurrentReadEnvelope {
  version: "ict-i2-current-read-v1";
  generatedAt: string;
  projections: readonly IctI2CurrentReadProjection[];
  executionAllowed: false;
  researchValidated: false;
}

export const buildIctI2CurrentReadEnvelope = (input: {
  generatedAt: string;
  ict2022: IctI2ModelCandidate<Ict2022State>;
  po3: IctI2ModelCandidate<IctPo3State>;
  judas: IctI2ModelCandidate<IctJudasState>;
}): IctI2CurrentReadEnvelope => ({
  version: "ict-i2-current-read-v1",
  generatedAt: input.generatedAt,
  projections: [
    projectIct2022CurrentRead(input.ict2022),
    projectIctPo3CurrentRead(input.po3),
    projectIctJudasCurrentRead(input.judas)
  ],
  executionAllowed: false,
  researchValidated: false
});
