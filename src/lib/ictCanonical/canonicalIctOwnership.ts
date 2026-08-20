export type CanonicalFactOwnerId =
  | "ICT_FACT_SWING"
  | "ICT_FACT_LIQUIDITY"
  | "ICT_FACT_FVG"
  | "ICT_FACT_BLOCK"
  | "ICT_FACT_STRUCTURE"
  | "ICT_FACT_DEALING_RANGE"
  | "ICT_FACT_SESSION"
  | "ICT_FACT_OPENING_GAP"
  | "ICT_FACT_IRL_ERL";

export type CanonicalMigrationStatus =
  | "CANONICAL_SHADOW"
  | "CANONICAL_WITH_COMPATIBILITY_ADAPTER"
  | "ADOPTED"
  | "LEGACY_PENDING_REMOVAL"
  | "LEGACY_RETAINED";

export interface CanonicalFactOwnershipEntry {
  ownerId: CanonicalFactOwnerId;
  module: string;
  factTypes: readonly string[];
  legacyImplementations: readonly string[];
  compatibilityAdapter?: string;
  migrationStatus: CanonicalMigrationStatus;
}

export const CANONICAL_ICT_FACT_OWNERSHIP: readonly CanonicalFactOwnershipEntry[] = Object.freeze([
  {
    ownerId: "ICT_FACT_SWING",
    module: "ictCanonical/canonicalSwingLiquidity",
    factTypes: ["SWING", "EQUAL_LEVEL"],
    legacyImplementations: ["ict/detectSwings", "ict-strategy-suite/ictStrategySuiteHelpers.detectSwingHighs/Lows"],
    compatibilityAdapter: "ictCanonical/legacyCompatibility",
    migrationStatus: "CANONICAL_WITH_COMPATIBILITY_ADAPTER"
  },
  {
    ownerId: "ICT_FACT_LIQUIDITY",
    module: "ictCanonical/canonicalSwingLiquidity",
    factTypes: ["LIQUIDITY", "DRAW_ON_LIQUIDITY"],
    legacyImplementations: ["ict/detectLiquiditySweeps", "ictStrategySuiteHelpers.detectLiquidityPools"],
    compatibilityAdapter: "ictCanonical/legacyCompatibility",
    migrationStatus: "CANONICAL_WITH_COMPATIBILITY_ADAPTER"
  },
  {
    ownerId: "ICT_FACT_IRL_ERL",
    module: "ictCanonical/canonicalIrlErl",
    factTypes: ["LIQUIDITY:INTERNAL", "LIQUIDITY:EXTERNAL", "IRL_ERL_TRANSITION"],
    legacyImplementations: ["strategy-local external-liquidity targets", "implicit PD-array internal liquidity"],
    migrationStatus: "CANONICAL_SHADOW"
  },
  {
    ownerId: "ICT_FACT_FVG",
    module: "ictCanonical/canonicalImbalance",
    factTypes: ["FVG", "BPR"],
    legacyImplementations: ["ict/detectFVG", "ictStrategySuiteHelpers.detectFairValueGap", "ict/pdArrayHierarchy"],
    compatibilityAdapter: "ictCanonical/legacyCompatibility",
    migrationStatus: "CANONICAL_WITH_COMPATIBILITY_ADAPTER"
  },
  {
    ownerId: "ICT_FACT_BLOCK",
    module: "ictCanonical/canonicalBlocks",
    factTypes: ["ORDER_BLOCK", "BREAKER_BLOCK", "MITIGATION_BLOCK"],
    legacyImplementations: ["ictStrategySuiteHelpers block variants", "ictPhase2OrderBlocks", "ict/pdArrayHierarchy"],
    compatibilityAdapter: "ictCanonical/legacyCompatibility",
    migrationStatus: "CANONICAL_WITH_COMPATIBILITY_ADAPTER"
  },
  {
    ownerId: "ICT_FACT_STRUCTURE",
    module: "ictCanonical/canonicalStructure",
    factTypes: ["DISPLACEMENT", "MSS"],
    legacyImplementations: ["ict/detectMSS", "strategy-local displacement policies", "ictStrategySuiteHelpers.detectDisplacement"],
    compatibilityAdapter: "ictCanonical/legacyCompatibility",
    migrationStatus: "CANONICAL_WITH_COMPATIBILITY_ADAPTER"
  },
  {
    ownerId: "ICT_FACT_DEALING_RANGE",
    module: "ictCanonical/canonicalRangePd",
    factTypes: ["DEALING_RANGE", "PD_LOCATION", "OTE_ZONE", "PD_ARRAY"],
    legacyImplementations: ["ict/dealingRangePremiumDiscount", "ictStrategySuiteHelpers.calculateDealingRange", "ict/pdArrayHierarchy"],
    compatibilityAdapter: "ictCanonical/legacyCompatibility",
    migrationStatus: "CANONICAL_WITH_COMPATIBILITY_ADAPTER"
  },
  {
    ownerId: "ICT_FACT_SESSION",
    module: "ictCanonical/canonicalTime",
    factTypes: ["SESSION_WINDOW"],
    legacyImplementations: ["ict/sessionTagger", "strategy-local America/New_York windows", "ictSessionNarrative"],
    compatibilityAdapter: "ictCanonical/legacyCompatibility",
    migrationStatus: "CANONICAL_WITH_COMPATIBILITY_ADAPTER"
  },
  {
    ownerId: "ICT_FACT_OPENING_GAP",
    module: "ictCanonical/canonicalOpeningGap",
    factTypes: ["OPENING_GAP:NDOG", "OPENING_GAP:NWOG"],
    legacyImplementations: ["ictStrategySuiteHelpers.calculateNewDayOpeningGap/NewWeekOpeningGap", "ict/openingPriceEquilibrium"],
    compatibilityAdapter: "ictCanonical/legacyCompatibility",
    migrationStatus: "CANONICAL_WITH_COMPATIBILITY_ADAPTER"
  }
]);

export const canonicalOwnerFor = (ownerId: CanonicalFactOwnerId) => {
  const owner = CANONICAL_ICT_FACT_OWNERSHIP.find((entry) => entry.ownerId === ownerId);
  if (!owner) throw new Error(`Unknown canonical ICT owner: ${ownerId}`);
  return owner;
};
