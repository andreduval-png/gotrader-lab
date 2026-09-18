import type { IctI5Artifact, IctI5OpeningGapContext } from "@/lib/ictI5/ictI5Types";

export type IctI5Bt2Adaptation = { status: "blocked"; blockers: readonly string[] };

export const adaptIctI5ArtifactToBt2 = (artifact: IctI5Artifact): IctI5Bt2Adaptation => ({
  status: "blocked",
  blockers: [`${artifact.artifactId} is non-executable and has no source-authorized canonical trade geometry.`]
});

export interface IctI5CurrentReadProjection {
  artifactId: IctI5Artifact["artifactId"];
  displayName: string;
  classification: "opening_gap_context" | "source_blocked_context";
  state: string;
  detail: string;
  supportingFactIds: readonly string[];
  blockers: readonly string[];
  executable: false;
  authority: IctI5Artifact["authority"];
  researchValidated: false;
}

const gapDetail = (artifact: IctI5OpeningGapContext) =>
  `${artifact.gapType} ${artifact.orientation}; state ${artifact.state}; midpoint ${artifact.midpointReached ? "reached" : "not reached"}; context only.`;

export const projectIctI5CurrentRead = (artifact: IctI5Artifact): IctI5CurrentReadProjection => ({
  artifactId: artifact.artifactId,
  displayName: artifact.displayName,
  classification: artifact.artifactId === "gotrader.ict.i5.tgif-context.v1" ? "source_blocked_context" : "opening_gap_context",
  state: "state" in artifact ? artifact.state : "SOURCE_BLOCKED",
  detail: artifact.artifactId === "gotrader.ict.i5.tgif-context.v1"
    ? "TGIF source semantics are incomplete; no executable candidate exists."
    : gapDetail(artifact),
  supportingFactIds: artifact.supportingFactIds,
  blockers: artifact.blockers,
  executable: false,
  authority: artifact.authority,
  researchValidated: false
});

export interface IctI5CurrentReadEnvelope {
  version: "ict-i5-current-read-v1";
  generatedAt: string;
  projections: readonly IctI5CurrentReadProjection[];
  currentOpportunityCandidates: readonly [];
  executionAllowed: false;
  researchValidated: false;
}

export const buildIctI5CurrentReadEnvelope = (generatedAt: string, artifacts: readonly IctI5Artifact[]): IctI5CurrentReadEnvelope => ({
  version: "ict-i5-current-read-v1",
  generatedAt,
  projections: artifacts.map(projectIctI5CurrentRead),
  currentOpportunityCandidates: [],
  executionAllowed: false,
  researchValidated: false
});

export const assertCompactIctI5Envelope = (envelope: IctI5CurrentReadEnvelope) => {
  const serialized = JSON.stringify(envelope);
  if (/"(candles|rawCandles|orders|positions|account|geometry|entry|stop|target)"\s*:/i.test(serialized)) {
    throw new Error("I5 context envelope crossed a raw-data or trade-geometry boundary.");
  }
  if (envelope.projections.some((projection) => projection.executable)) throw new Error("I5 Current Read cannot promote gap context to a trade.");
  return { ok: true as const, serializedBytes: serialized.length };
};
