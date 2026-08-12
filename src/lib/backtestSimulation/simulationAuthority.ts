export interface SimulationAuthority {
  readonly executionAuthority: "none";
  readonly brokerAuthority: "none";
  readonly readinessOverrideAuthority: "none";
}

export const SIMULATION_AUTHORITY_NONE: Readonly<SimulationAuthority> = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

export const SIMULATION_CAPABILITIES_DISABLED = Object.freeze({
  productionAdoptionAllowed: false,
  canCreateEvidence: false,
  canApproveReadiness: false,
  canApplyCalibration: false,
  canCreateTradeIntent: false,
  canPlaceOrder: false
});

export function assertSimulationAuthority(value: unknown): asserts value is SimulationAuthority {
  const authority = value as Partial<SimulationAuthority> | undefined;
  if (
    !authority ||
    authority.executionAuthority !== "none" ||
    authority.brokerAuthority !== "none" ||
    authority.readinessOverrideAuthority !== "none"
  ) throw new Error("Simulation authority must remain none/none/none.");
}
