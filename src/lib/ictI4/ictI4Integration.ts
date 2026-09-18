import type { IctI4Artifact, IctI4CurrentReadProjection, IrlErlDeliveryContext, OteEntryPolicyContext, PdArrayExecutionPolicyContext, UnicornContext } from "@/lib/ictI4/ictI4Types";

export type IctI4Bt2Adaptation = { status: "blocked"; blockers: readonly string[] };

export const adaptIctI4ArtifactToBt2 = (artifact: IctI4Artifact): IctI4Bt2Adaptation => ({
  status: "blocked",
  blockers: [`${artifact.artifactId} is non-executable and has no source-authorized canonical trade geometry.`]
});

const displayName = (artifact: IctI4Artifact) => artifact.artifactId === "gotrader.ict.i4.unicorn-context.v1"
  ? "ICT Unicorn / Breaker+FVG Context"
  : artifact.artifactId === "gotrader.ict.i4.ote-entry-policy.v1"
    ? "ICT OTE Entry Policy"
    : artifact.artifactId === "gotrader.ict.i4.irl-to-erl-framework.v1"
      ? "IRL to ERL Delivery Framework"
      : artifact.artifactId === "gotrader.ict.i4.erl-to-irl-framework.v1"
        ? "ERL to IRL Delivery Framework"
        : "Canonical PD Array Execution Policy";

export const projectIctI4CurrentRead = (artifact: IctI4Artifact): IctI4CurrentReadProjection => {
  const classification = artifact.artifactId === "gotrader.ict.i4.unicorn-context.v1"
    ? "composite_context"
    : artifact.artifactId === "gotrader.ict.i4.ote-entry-policy.v1"
      ? "entry_policy"
      : artifact.artifactId.includes("framework")
        ? "framework"
        : "execution_policy";
  const state = "phase" in artifact ? artifact.phase : artifact.retraceObserved ? "RETRACE_OBSERVED" : "WAITING_FOR_RETRACE";
  return {
    artifactId: artifact.artifactId,
    displayName: displayName(artifact),
    classification,
    state,
    detail: artifact.executable
      ? "Executable research candidate."
      : "Framework or policy context only; no qualified trade proposal or execution geometry exists.",
    supportingFactIds: artifact.supportingFactIds,
    blockers: artifact.blockers,
    executable: false,
    authority: artifact.authority,
    researchValidated: false
  };
};

export interface IctI4CurrentReadEnvelope {
  version: "ict-i4-current-read-v1";
  generatedAt: string;
  projections: readonly IctI4CurrentReadProjection[];
  currentOpportunityCandidates: readonly [];
  executionAllowed: false;
  researchValidated: false;
}

export const buildIctI4CurrentReadEnvelope = (generatedAt: string, artifacts: readonly IctI4Artifact[]): IctI4CurrentReadEnvelope => ({
  version: "ict-i4-current-read-v1",
  generatedAt,
  projections: artifacts.map(projectIctI4CurrentRead),
  currentOpportunityCandidates: [],
  executionAllowed: false,
  researchValidated: false
});

export const assertCompactIctI4Envelope = (envelope: IctI4CurrentReadEnvelope) => {
  const serialized = JSON.stringify(envelope);
  if (/"(candles|rawCandles|orders|positions|account|geometry|entry|stop|target)"\s*:/i.test(serialized)) {
    throw new Error("I4 framework envelope crossed a raw-data or trade-geometry boundary.");
  }
  if (envelope.projections.some((projection) => projection.executable)) throw new Error("I4 Current Read cannot promote framework context to a trade.");
  return { ok: true as const, serializedBytes: serialized.length };
};
