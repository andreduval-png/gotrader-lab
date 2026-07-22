export interface V2Authority {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}

export interface V2MarketDataCapability {
  marketDataAccess: "read_only";
  transportCapability: "market_data_read_only";
  authority: Readonly<V2Authority>;
}

export const V2_AUTHORITY_NONE: Readonly<V2Authority> = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

export const V2_MARKET_DATA_READ_ONLY: Readonly<V2MarketDataCapability> = Object.freeze({
  marketDataAccess: "read_only",
  transportCapability: "market_data_read_only",
  authority: V2_AUTHORITY_NONE
});

export function assertV2Authority(value: unknown): asserts value is V2Authority {
  if (!value || typeof value !== "object") {
    throw new Error("V2 authority is missing.");
  }
  const authority = value as Partial<V2Authority>;
  if (
    authority.executionAuthority !== "none" ||
    authority.brokerAuthority !== "none" ||
    authority.readinessOverrideAuthority !== "none"
  ) {
    throw new Error("V2 authority must remain execution none, broker none, and readiness override none.");
  }
}
