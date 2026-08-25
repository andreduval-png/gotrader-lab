# G2.1 Disposition

`G2_1_PARTIAL`

`SOURCE_NATIVE_PHASE2_GEOMETRY_FAIL_CLOSED`

`G2_1_CANONICAL_PRODUCER_MIGRATION_REQUIRED`

The source-remediation slice is accepted for B&B, OSOK, and PO3 ambiguity handling. It prevents the known generic geometry defects from reaching Current Read, the signal contract, Current Opportunity, Operator Console, replay, or MCP through those Phase 2 signals.

G2.1 is not complete. Current Opportunity still contains `current-opportunity-shadow-v1`, and several accepted detector producers expose numeric geometry rather than `CanonicalTradeGeometry`. Deleting the shadow adapter before migrating each producer would erase accepted detector plans. The required next slice is producer-by-producer canonicalization followed by removal of Current Read, Current Opportunity, signal-contract, Operator Console, backtest, and MCP reconstruction.

The request attachment ends mid-sentence in Operator Console section 49. The missing remainder is required before final G2.1 acceptance criteria can be asserted.

