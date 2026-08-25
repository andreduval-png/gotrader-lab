import { ICT_CORE_AUTHORITY } from "@/lib/ictI2/ictI2Shared";
import type { IctCoreCandidateCollection, IctCoreStrategyCandidate } from "@/lib/ictI2/ictI2Types";

export const buildIctCoreCandidateCollection = ({ generatedAt, sourceFingerprint, candidates }: {
  generatedAt: string;
  sourceFingerprint: string;
  candidates: readonly IctCoreStrategyCandidate[];
}): IctCoreCandidateCollection => {
  const actionableDirections = new Set(candidates.filter((candidate) => candidate.actionable).map((candidate) => candidate.direction));
  return {
    version: "gotrader.ict-core-candidates.v1",
    generatedAt,
    sourceFingerprint,
    candidates: [...candidates],
    conflict: actionableDirections.has("long") && actionableDirections.has("short") ? "CONFLICTING_CANONICAL_SETUPS" : "NONE",
    researchValidated: false,
    authority: ICT_CORE_AUTHORITY
  };
};

