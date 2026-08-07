export interface HistoricalDatasetAuthority {
  readonly executionAuthority: "none";
  readonly brokerAuthority: "none";
  readonly readinessOverrideAuthority: "none";
}

export const HISTORICAL_DATASET_AUTHORITY_NONE: Readonly<HistoricalDatasetAuthority> =
  Object.freeze({
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  });

export function assertHistoricalDatasetAuthority(
  value: unknown
): asserts value is HistoricalDatasetAuthority {
  const authority = value as Partial<HistoricalDatasetAuthority> | undefined;
  if (
    !authority ||
    authority.executionAuthority !== "none" ||
    authority.brokerAuthority !== "none" ||
    authority.readinessOverrideAuthority !== "none"
  ) {
    throw new Error("Historical dataset authority must remain none/none/none.");
  }
}
