# I1 FVG and BPR Specification

`canonicalImbalance` owns three-candle FVG identity. It records direction, proximal/distal prices, midpoint, origin candle IDs, causal timestamps, current fill projection, and versioned lineage.

PARTIALLY_FILLED, FILLED, and INVERTED are separate linked FVG transition facts. INVERTED facts preserve `originFvgId` and the original price range for IFVG consumers. Existing IFVG strategies are retained unchanged.

BPR is an opposing-FVG overlap fact. It references both FVG IDs and the exact overlap bounds. BPR is context, not a strategy.
