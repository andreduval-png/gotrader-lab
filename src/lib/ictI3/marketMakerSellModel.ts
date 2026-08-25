import { assertCanonicalModelContract, type CanonicalIctModel } from "@/lib/ictCanonical/canonicalIctModelContract";
import { CANONICAL_ICT_NONE_AUTHORITY } from "@/lib/ictCanonical/canonicalIctTypes";
import { evaluateMarketMakerModelCore } from "@/lib/ictI3/marketMakerModelCore";
import { ICT_MMSM_BASE_PARAMETERS } from "@/lib/ictI3/marketMakerParameters";
import type { IctI3DetectionInput, MarketMakerModelParameters } from "@/lib/ictI3/ictI3Types";

export const evaluateMarketMakerSellModel = (
  input: IctI3DetectionInput,
  parameters: MarketMakerModelParameters = ICT_MMSM_BASE_PARAMETERS
) => evaluateMarketMakerModelCore(input, "BEARISH", parameters);

export const ICT_MMSM_CANONICAL_MODEL: CanonicalIctModel = assertCanonicalModelContract({
  strategyId: "ict_market_maker_sell_model_v1",
  strategyVersion: "1.0.0",
  classification: "research_only",
  requiredTimeframes: ["1h", "5m"],
  preferredTimeframes: ["4h", "15m"],
  optionalTimeframes: ["1m", "1d"],
  requiredFactTypes: ["DEALING_RANGE", "PD_LOCATION", "LIQUIDITY", "IRL_ERL_TRANSITION", "DISPLACEMENT", "PD_ARRAY"],
  factDependencyIds: [
    "i1.dealing-range",
    "i1.pd-location",
    "i1.liquidity",
    "i1.irl-erl-transition",
    "i1.displacement",
    "i1.pd-array"
  ],
  narrativePolicyId: "c1.i3.mmsm-setup-maturation.v1",
  smtPolicy: "optional",
  parameterSchema: {
    parameterSchemaId: "gotrader.ict.i3.market-maker.parameters.v1",
    version: "1.0.0",
    parameters: [
      { name: "roleTimeframes", classification: "RESEARCH_PARAMETER" },
      { name: "dealingRangePolicy", classification: "CANONICAL_GOTRADER_RULE", allowedValues: ["ACTIVE_CANONICAL_RANGE"] },
      { name: "transitionPolicy", classification: "CANONICAL_GOTRADER_RULE", allowedValues: ["ERL_TO_IRL_DELIVERY"] },
      { name: "premiumDiscountPolicy", classification: "RESEARCH_PARAMETER", allowedValues: ["REQUIRED", "PREFERRED", "DISABLED"] },
      { name: "displacementPolicy", classification: "CANONICAL_GOTRADER_RULE", allowedValues: ["REQUIRED"] },
      { name: "mssPolicy", classification: "RESEARCH_PARAMETER", allowedValues: ["OPTIONAL", "REQUIRED"] },
      { name: "eligiblePdArrayTypes", classification: "RESEARCH_PARAMETER" },
      { name: "entryMode", classification: "RESEARCH_PARAMETER", allowedValues: ["PD_ARRAY_MIDPOINT", "PD_ARRAY_PROXIMAL"] },
      { name: "stopMode", classification: "SOURCE_DEFINED", allowedValues: ["LIQUIDITY_ENGINEERING_EXTREME"] },
      { name: "targetMode", classification: "SOURCE_DEFINED", allowedValues: ["OPPOSITE_EXTERNAL_LIQUIDITY"] },
      { name: "smtPolicy", classification: "CANONICAL_GOTRADER_RULE", allowedValues: ["OPTIONAL"] },
      { name: "maximumSetupAgeMinutes", classification: "RESEARCH_PARAMETER", minimum: 15, maximum: 1440, defaultValue: 180 },
      { name: "minimumRR", classification: "RESEARCH_PARAMETER", minimum: 0.1, maximum: 10, defaultValue: 2 }
    ]
  },
  authority: CANONICAL_ICT_NONE_AUTHORITY,
  detect: () => []
});
