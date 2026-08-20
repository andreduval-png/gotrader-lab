import type { IctI2RegistryEntry } from "@/lib/ictI2/ictI2Types";

export const ICT_I2_REGISTRY: readonly IctI2RegistryEntry[] = Object.freeze([
  {
    strategyId: "amd_power_of_three_research_v1",
    strategyVersion: "legacy-placeholder",
    displayName: "AMD Power of Three Research v1",
    registrationStatus: "LEGACY_PLACEHOLDER",
    supersededBy: "ict_power_of_three_v1",
    sourcePacketId: "legacy.strategy-library.amd-placeholder"
  },
  {
    strategyId: "ict_2022_model_v1",
    strategyVersion: "1.0.0",
    displayName: "ICT 2022 Mentorship Model",
    registrationStatus: "ACTIVE_RESEARCH",
    sourcePacketId: "gotrader.ict.i2.2022.source-rules.v1"
  },
  {
    strategyId: "ict_power_of_three_v1",
    strategyVersion: "1.0.0",
    displayName: "ICT Power of Three",
    registrationStatus: "ACTIVE_RESEARCH",
    supersedes: "amd_power_of_three_research_v1",
    sourcePacketId: "gotrader.ict.i2.po3.source-rules.v1"
  },
  {
    strategyId: "ict_judas_swing_v1",
    strategyVersion: "1.0.0-source-blocked",
    displayName: "ICT Judas Swing",
    registrationStatus: "SOURCE_BLOCKED",
    sourcePacketId: "gotrader.ict.i2.judas.source-rules.v1"
  }
]);

export const executableIctI2Registry = () => ICT_I2_REGISTRY.filter((entry) => entry.registrationStatus === "ACTIVE_RESEARCH");

export const assertNoExecutableIctI2Aliases = () => {
  const active = executableIctI2Registry();
  const ids = active.map((entry) => entry.strategyId);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate executable ICT I2 strategy identity.");
  if (active.some((entry) => entry.strategyId === "ict_judas_swing_v1")) {
    throw new Error("Source-blocked Judas Swing must not enter the executable registry.");
  }
  return active;
};
