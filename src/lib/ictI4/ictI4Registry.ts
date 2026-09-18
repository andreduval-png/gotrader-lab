import type { IctI4RegistryEntry } from "@/lib/ictI4/ictI4Types";

export const ICT_I4_REGISTRY: readonly IctI4RegistryEntry[] = Object.freeze([
  { artifactId: "gotrader.ict.i4.unicorn-context.v1", displayName: "ICT Unicorn / Breaker+FVG Context", taxonomy: "COMPOSITE_SETUP", decision: "BLOCKED_SOURCE_SEMANTICS", executable: false, aliases: ["breaker_fvg_model"], narrativePolicyId: "c1.1.i4.setup-relative.v1", smtPolicy: "OPTIONAL", researchValidated: false },
  { artifactId: "gotrader.ict.i4.ote-entry-policy.v1", displayName: "ICT OTE Entry Policy", taxonomy: "ENTRY_MODEL", decision: "ACCEPTED_EXECUTION_POLICY", executable: false, aliases: ["ote_research_v1"], narrativePolicyId: "c1.1.i4.setup-relative.v1", smtPolicy: "OPTIONAL", researchValidated: false },
  { artifactId: "gotrader.ict.i4.irl-to-erl-framework.v1", displayName: "IRL to ERL Delivery Framework", taxonomy: "CANONICAL_FACT_FRAMEWORK", decision: "ACCEPTED_FRAMEWORK", executable: false, aliases: [], narrativePolicyId: "c1.1.i4.delivery.v1", smtPolicy: "DISABLED", researchValidated: false },
  { artifactId: "gotrader.ict.i4.erl-to-irl-framework.v1", displayName: "ERL to IRL Delivery Framework", taxonomy: "CANONICAL_FACT_FRAMEWORK", decision: "ACCEPTED_FRAMEWORK", executable: false, aliases: [], narrativePolicyId: "c1.1.i4.delivery.v1", smtPolicy: "DISABLED", researchValidated: false },
  { artifactId: "gotrader.ict.i4.breaker-fact.v1", displayName: "Canonical Breaker Block", taxonomy: "CANONICAL_FACT", decision: "CONCEPT_ONLY", executable: false, aliases: [], narrativePolicyId: "none", smtPolicy: "DISABLED", researchValidated: false },
  { artifactId: "gotrader.ict.i4.mitigation-fact.v1", displayName: "Canonical Mitigation Block", taxonomy: "CANONICAL_FACT", decision: "CONCEPT_ONLY", executable: false, aliases: [], narrativePolicyId: "none", smtPolicy: "DISABLED", researchValidated: false },
  { artifactId: "gotrader.ict.i4.pd-array-execution-policy.v1", displayName: "Canonical PD Array Execution Policy", taxonomy: "STRATEGY_PROFILE", decision: "ACCEPTED_EXECUTION_POLICY", executable: false, aliases: ["pd_array_setup_research_v1"], narrativePolicyId: "c1.1.i4.setup-relative.v1", smtPolicy: "OPTIONAL", researchValidated: false }
]);

export const executableIctI4Registry = () => ICT_I4_REGISTRY.filter((entry) => entry.executable);

export const assertIctI4Registry = () => {
  if (executableIctI4Registry().length !== 0) throw new Error("I4 source audit authorizes no executable strategy registrations.");
  if (new Set(ICT_I4_REGISTRY.map((entry) => entry.artifactId)).size !== ICT_I4_REGISTRY.length) throw new Error("I4 artifact identities must be unique.");
  if (ICT_I4_REGISTRY.some((entry) => entry.aliases.includes(entry.artifactId))) throw new Error("I4 alias metadata cannot duplicate canonical artifact identity.");
  return ICT_I4_REGISTRY;
};
