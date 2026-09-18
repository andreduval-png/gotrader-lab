import type { IctI5RegistryEntry } from "@/lib/ictI5/ictI5Types";

export const ICT_I5_REGISTRY: readonly IctI5RegistryEntry[] = Object.freeze([
  { artifactId: "gotrader.ict.i5.ndog-context.v1", displayName: "ICT New Day Opening Gap Context", decision: "CONTEXT_ONLY", executable: false, aliases: [], narrativePolicyId: "c1.1.i5.opening-gap-context.v1", smtPolicy: "OPTIONAL", researchValidated: false },
  { artifactId: "gotrader.ict.i5.nwog-context.v1", displayName: "ICT New Week Opening Gap Context", decision: "CONTEXT_ONLY", executable: false, aliases: [], narrativePolicyId: "c1.1.i5.opening-gap-context.v1", smtPolicy: "OPTIONAL", researchValidated: false },
  { artifactId: "gotrader.ict.i5.tgif-context.v1", displayName: "ICT TGIF / Friday Model Context", decision: "BLOCKED_SOURCE_SEMANTICS", executable: false, aliases: ["friday_model"], narrativePolicyId: "none", smtPolicy: "DISABLED", researchValidated: false }
]);

export const executableIctI5Registry = () => ICT_I5_REGISTRY.filter((entry) => entry.executable);

export const assertIctI5Registry = () => {
  if (executableIctI5Registry().length !== 0) throw new Error("I5 source audit authorizes no executable strategy registrations.");
  if (new Set(ICT_I5_REGISTRY.map((entry) => entry.artifactId)).size !== ICT_I5_REGISTRY.length) throw new Error("I5 artifact identities must be unique.");
  return ICT_I5_REGISTRY;
};
