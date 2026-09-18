import type { MarketMakerModelParameters } from "@/lib/ictI3/ictI3Types";

const SHARED_MARKET_MAKER_PARAMETERS: MarketMakerModelParameters = {
  structuralTimeframe: "1h",
  setupTimeframe: "5m",
  executionTimeframe: "5m",
  dealingRangePolicy: "ACTIVE_CANONICAL_RANGE",
  premiumDiscountPolicy: "REQUIRED",
  displacementPolicy: "REQUIRED",
  mssPolicy: "OPTIONAL",
  eligiblePdArrayTypes: ["FVG"],
  entryMode: "PD_ARRAY_MIDPOINT",
  stopMode: "LIQUIDITY_ENGINEERING_EXTREME",
  targetMode: "OPPOSITE_EXTERNAL_LIQUIDITY",
  smtPolicy: "OPTIONAL",
  opposingSmtBehavior: "WARN",
  maximumSetupAgeMinutes: 180,
  minimumRR: 2
};

export const ICT_MMBM_BASE_PARAMETERS: MarketMakerModelParameters = Object.freeze({
  ...SHARED_MARKET_MAKER_PARAMETERS,
  eligiblePdArrayTypes: Object.freeze([...SHARED_MARKET_MAKER_PARAMETERS.eligiblePdArrayTypes])
});

export const ICT_MMSM_BASE_PARAMETERS: MarketMakerModelParameters = Object.freeze({
  ...SHARED_MARKET_MAKER_PARAMETERS,
  eligiblePdArrayTypes: Object.freeze([...SHARED_MARKET_MAKER_PARAMETERS.eligiblePdArrayTypes])
});
