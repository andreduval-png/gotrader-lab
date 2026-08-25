# G2.2 Static Construction Scan

Decision: `PASS`.

Baseline: commit `7b7e912bf043a54dd4bbf823b79fb9c259d05b7f`, tree `5c40ccfec11ddaf98f30e1d2ed11ae9d0d8521d7`.

The executable scan is `scripts/test-g2-2-final-geometry-acceptance.mjs`. It reclassifies all 23 producer entries from current source and asserts the following counts:

| Classification | Count |
|---|---:|
| `CANONICAL_DIRECT` | 5 |
| `CANONICAL_LOSSLESS_ADAPTER` | 10 |
| `SOURCE_BLOCKED` | 5 |
| `RESEARCH_ONLY` ownership class | 0 |
| `NON_EXECUTABLE` | 3 |
| `LEGACY_ACTIONABLE_NUMERIC` | 0 |

`RESEARCH_ONLY` is recorded as an actionability capability on canonical producers, not as a competing geometry-ownership class. IFVG v4, Silver Bullet v2, and London Raid v2 therefore remain canonical adapters and research-only.

## Producer Findings

The five source-blocked producer entries are B&B buy, B&B sell, OSOK, PO3 ambiguous/HOD-LOD, and CMD High Displacement v2. They represent four ownership families because B&B has separate directional producers. CMD is classified `LEGACY_GEOMETRY_NOT_MIGRATED`: its numeric detector output is not accepted as G1.1 intent.

B&B and OSOK clear entry, invalidation, target, and R:R before returning `SOURCE_BLOCKED` intent. PO3 creates geometry only for one deterministic external objective; multiple objectives and HOD/LOD without canonical objective identity fail closed. CMD is projected as `geometryMode: source_blocked` and supplies no canonical object.

The ten adapters wrap the detector's exact native entry, stop, and target. They add identity and policy metadata but select no alternative price. The 2-point floor is a symbol-specific MNQ/USTECH/US100/NQ detector-adapter safety gate, not a universal G1.1 minimum and not a rule for the five direct producers.

## Downstream Findings

Actionable geometry constructors found:

| Surface | Count |
|---|---:|
| Current Read | 0 |
| Current Opportunity | 0 |
| Operator Console / Research Trade Plan | 0 |
| Signal Contract | 0 |
| Activate Market persistence | 0 |
| MCP canonical projection surfaces | 0 |

These surfaces call `projectCanonicalTradeGeometry` or copy the canonical object. Missing geometry becomes context, source blocked, near miss, or no trade. No current-price entry substitution, recent-bar stop completion, nearest-liquidity target completion, target stretching, stop tightening, shadow constructor, or replacement R:R was found in the actionable downstream set.

The legacy MCP proposal validator calculates diagnostic R:R for user-supplied proposal numbers. It is script-local, non-canonical, non-executable, and is not imported by Current Read, Current Opportunity, Operator Console, Signal Contract, Research Trade Plan, Charter BT2, or G1.1. It remains a cleanup item and cannot validate canonical geometry.

## G1.1 Boundary

G1.1 validates causal availability, direction, risk distance, reward distance, theoretical R:R, lifecycle status, actionability, and geometry identity. It does not choose strategy entry, stop, or target. Below-threshold R:R retains the declared primary target. Invalid direction fails closed without absolute-distance rescue.

Executable scan result: 23 producers, 5 direct, 10 adapters, 5 blocked, 3 non-executable, 0 actionable legacy numeric, and 0 downstream actionable constructors.
