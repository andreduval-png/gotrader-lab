# G2.2 Architecture Change-Control Proposal

Proposed contract identity: `gotrader-canonical-trade-geometry-v1`.

## Contract

Canonical facts feed an executable strategy or profile. That owner emits source-native strategy geometry intent. G1.1 validates and seals it as `CanonicalTradeGeometry`. Current Read, Current Opportunity, Operator Console, Research Trade Plan, Signal Contract, BT2, canonical replay/walk-forward adapters, MCP/AI projections, and evidence identity may consume it but may not select or alter prices.

When source-native intent is unavailable, the required result is `SOURCE_BLOCKED`, `GEOMETRY_INCOMPLETE`, and `NO TRADE`.

## Profile Inheritance

Charter 1, 2, 6, 7, and 10 retain the exact owner geometry object. Charter 9 maps to OSOK and inherits its source block. Charter 11 and 12 resolve through the B&B directional owner and inherit B&B's source block. Framework profiles cannot carry geometry. IFVG v3 remains active research; IFVG v4 remains research-only and cannot become actionable through geometry wrapping.

## Research Cycle Boundary

Source-blocked output remains visible as context and blocker codes. Current Opportunity is synchronous and does not wait or retry for geometry. A source-blocked candidate cannot become `valid_candidate`, cannot publish prices, and cannot produce an actionable Research Trade Plan or BT2 request. The accepted G2.1 baseline does not include later RP1 freshness changes; no RP1 behavior is claimed by this freeze.

## Validation Boundary

BT2 is canonical and lossless. The advisor-era replay and configurable legacy walk-forward/backtest lanes remain diagnostic/migration-pending. They must receive dedicated canonical adapters before large-scale validation can treat their geometry as authoritative.

## Governance Disposition

No accepted `architecture-index.md` or `architecture-roadmap.md` is present in this baseline. This proposal therefore does not create or silently mutate a frozen index. Governance may adopt this contract and freeze record in a later authorized integration change.

Recommended next gate: `CANONICAL_GEOMETRY_ACCEPTED_BUT_BT_ADAPTER_GAPS_REMAIN`.

Authority remains `none/none/none`.
