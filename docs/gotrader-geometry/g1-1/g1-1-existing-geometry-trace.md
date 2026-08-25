# G1.1 Existing Geometry Trace

## Existing flow

1. Strategy detectors create native or partially completed entry, invalidation,
   and target facts.
2. `IctResearchSignal` and candidate adapters retain those primitive prices.
3. `completeSignalTradeStructure` may complete missing geometry. Missing entry
   can fall back to current market price; target and invalidation can come from
   generic directional candidate selection.
4. Approved-profile actionability checks primitive geometry and estimated R:R.
5. Current Read copies primitive signal-contract prices.
6. Current Opportunity builds another `TradeConstructionResult` and can
   downgrade a candidate but has no immutable geometry identity.
7. Activation selects among signal contract, Current Read, and candidate values.
8. Operator Console can recover a missing entry algebraically from stop, target,
   and R:R (`rr_implied_recovery`).
9. BT2 receives intended primitive levels, then exclusively owns fill, costs,
   intrabar ordering, net R:R, and realized R.

## Mutations and fallbacks

- `estimateRewardRisk` uses absolute distances and can hide invalid long/short
  ordering.
- `entryReferenceForSignal` can substitute current price for absent native entry.
- advisor target completion uses generic nearest directional objectives.
- Order Block Retracement explicitly chooses nearest directional draw-on-liquidity.
- Current Opportunity recalculates geometry status and R:R from primitives.
- Operator Console can invent a display entry from other displayed values.
- BT2 preserves intended levels in accepted I2 adapters; it does not own target
  selection.

## Root-cause classification

Dominant classification: `MULTIPLE_CAUSES`.

Contributors are `TARGET_SELECTION`, `LATE_ENTRY_CHASE`, `RR_CALCULATION`,
`CURRENT_OPPORTUNITY_MUTATION`, and `UI_PROJECTION_MISMATCH`. Current Read is
primarily a copier, not the dominant target mutation point. The nearest target
behavior is especially visible in Order Block Retracement.

G1.1 establishes a single immutable projection object. Legacy producers remain
visible but are non-actionable until an explicit strategy target policy creates
canonical geometry.

