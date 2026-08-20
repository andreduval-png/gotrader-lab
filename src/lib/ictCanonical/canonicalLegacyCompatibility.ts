export const CANONICAL_LEGACY_COMPATIBILITY = Object.freeze([
  {
    strategy: "IFVG",
    legacyModules: ["ict-strategy-suite/ictIfvg", "ict/detectFVG"],
    canonicalDependencies: ["FVG", "FVG_TRANSITION", "PD_ARRAY:IFVG"],
    parityFixture: "IFVG inversion preserves origin-FVG lineage and price range.",
    status: "SHADOW_PARITY"
  },
  {
    strategy: "Silver Bullet",
    legacyModules: ["ict-strategy-suite/ictSilverBullet", "ict/sessionTagger"],
    canonicalDependencies: ["SESSION_WINDOW", "LIQUIDITY", "FVG", "MSS"],
    parityFixture: "New York window remains America/New_York with IANA DST authority.",
    status: "SHADOW_PARITY"
  },
  {
    strategy: "Turtle Soup",
    legacyModules: ["ict-strategy-suite/ictTurtleSoup", "ict/detectLiquiditySweeps"],
    canonicalDependencies: ["SWING", "EQUAL_LEVEL", "LIQUIDITY"],
    parityFixture: "Confirmed liquidity remains unavailable before swing validFrom.",
    status: "SHADOW_PARITY"
  },
  {
    strategy: "CISD",
    legacyModules: ["ict-strategy-suite/ictCisd"],
    canonicalDependencies: ["DISPLACEMENT", "MSS", "BLOCK"],
    parityFixture: "Structure transitions reference confirmed structure and causal break candles.",
    status: "SHADOW_PARITY"
  },
  {
    strategy: "CMD",
    legacyModules: ["ict-strategy-suite/ictCmdHighDisplacementV2"],
    canonicalDependencies: ["SESSION_WINDOW", "DISPLACEMENT", "FVG", "DRAW_ON_LIQUIDITY"],
    parityFixture: "Displacement measurement and structural draw are independently versioned.",
    status: "SHADOW_PARITY"
  },
  {
    strategy: "Nasdaq London Raid",
    legacyModules: ["sessionRaidReversal"],
    canonicalDependencies: ["SESSION_WINDOW", "LIQUIDITY", "MSS", "FVG"],
    parityFixture: "London timing remains explicit and no session fact grants trade authority.",
    status: "SHADOW_PARITY"
  }
] as const);
