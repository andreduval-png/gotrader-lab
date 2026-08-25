import type { IctI3RegistryEntry } from "@/lib/ictI3/ictI3Types";

export const ICT_I3_REGISTRY: readonly IctI3RegistryEntry[] = Object.freeze([
  {
    modelId: "mmxm_delivery_framework_v1",
    version: "1.0.0",
    displayName: "MMXM Delivery Framework",
    classification: "FRAMEWORK_CONTEXT",
    executable: false,
    researchValidated: false
  },
  {
    modelId: "ict_market_maker_buy_model_v1",
    version: "1.0.0",
    displayName: "ICT Market Maker Buy Model",
    classification: "ACTIVE_RESEARCH",
    executable: true,
    researchValidated: false
  },
  {
    modelId: "ict_market_maker_sell_model_v1",
    version: "1.0.0",
    displayName: "ICT Market Maker Sell Model",
    classification: "ACTIVE_RESEARCH",
    executable: true,
    researchValidated: false
  }
]);

export const executableIctI3Registry = () => ICT_I3_REGISTRY.filter((entry) => entry.executable);

export const assertIctI3Registry = () => {
  const executable = executableIctI3Registry();
  if (executable.length !== 2) throw new Error("I3 must expose exactly two executable directional models.");
  if (ICT_I3_REGISTRY.find((entry) => entry.modelId === "mmxm_delivery_framework_v1")?.executable) {
    throw new Error("MMXM framework must not become an alias strategy.");
  }
  if (new Set(ICT_I3_REGISTRY.map((entry) => entry.modelId)).size !== ICT_I3_REGISTRY.length) {
    throw new Error("I3 registry identities must be unique.");
  }
  return ICT_I3_REGISTRY;
};
