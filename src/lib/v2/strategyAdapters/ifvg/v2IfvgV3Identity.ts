import { canonicalHash } from "../../serialization/canonicalSerialization";
import {
  V2_IFVG_V3_ARTIFACT_SCHEMA_VERSION,
  V2_IFVG_V3_PROFILE_ID,
  V2_IFVG_V3_STRATEGY_ID
} from "./v2IfvgV3Types";

export const addTimeframeDuration = (timestamp: string, timeframe: string) => {
  const match = /^(\d+)(m|h|d)$/i.exec(timeframe);
  if (!match) return timestamp;
  const count = Number(match[1]);
  const unit = match[2].toLowerCase();
  const durationMs = count * (unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000);
  return new Date(Date.parse(timestamp) + durationMs).toISOString();
};

export const buildV2IfvgV3FvgSemanticIdentity = ({
  confirmationCandleTime,
  direction,
  lowerBound,
  sourceFingerprint,
  timeframe,
  upperBound
}: {
  confirmationCandleTime: string;
  direction: "bullish" | "bearish";
  lowerBound: number;
  sourceFingerprint: string;
  timeframe: string;
  upperBound: number;
}) => canonicalHash({
  identityType: "ifvg-fvg-semantic-identity-v1",
  sourceFingerprint,
  timeframe,
  direction,
  confirmationCandleTime,
  lowerBound,
  upperBound
});

export const buildV2IfvgV3CandidateIdentity = ({
  direction,
  fvgSemanticIdentityHash,
  inversionTime,
  sourceFingerprint,
  timeframe
}: {
  direction: "long" | "short";
  fvgSemanticIdentityHash: string;
  inversionTime: string;
  sourceFingerprint: string;
  timeframe: string;
}) => canonicalHash({
  identityType: "ifvg-v3-shadow-candidate-identity-v1",
  profileId: V2_IFVG_V3_PROFILE_ID,
  strategyId: V2_IFVG_V3_STRATEGY_ID,
  sourceFingerprint,
  timeframe,
  direction,
  fvgSemanticIdentityHash,
  inversionTime
});

export const buildV2IfvgV3ArtifactIdentity = ({
  adapterVersion,
  contextArtifactId,
  normalizedCandidateId
}: {
  adapterVersion: string;
  contextArtifactId: string;
  normalizedCandidateId: string;
}) => canonicalHash({
  schemaVersion: V2_IFVG_V3_ARTIFACT_SCHEMA_VERSION,
  adapterVersion,
  contextArtifactId,
  normalizedCandidateId
});
