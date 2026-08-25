# I1 Dealing Range and PD Array Specification

`canonicalRangePd` selects the latest confirmed opposing swing anchors. Range identity includes both swing IDs. PREMIUM, EQUILIBRIUM, and DISCOUNT facts always reference that `dealingRangeId`.

OTE is geometry foundation only. `buildCanonicalOteZone` requires an explicit versioned policy; the legacy 0.62-0.79 policy is exported for compatibility but is not a research optimum or strategy authorization.

Canonical PD arrays project FVG, inverted FVG, BPR, order block, breaker block, mitigation block, and OTE-zone facts. Every projection references one source fact ID and retains its range, direction, timeframe, lineage, and authority.
