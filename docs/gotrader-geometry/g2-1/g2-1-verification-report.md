# G2.1 Verification Report

## Passed

- `npm run typecheck`
- `npm run build`
- `node scripts/test-ict-phase2-models.mjs`
- `node scripts/test-ict-po3.mjs`
- G1.1 canonical geometry, target-selection, and R:R suites
- ICT Current Read flow
- Current Opportunity scanner
- Operator Console snapshot
- trade-geometry Current Read / Current Opportunity parity
- trade-geometry BT2 parity
- source-integrity baseline
- provenance baseline
- safety baseline
- MT5 read-only safety

Build warnings are the existing Rollup circular-chunk and chunk-size warnings.

## Baseline Failure

`node scripts/test-gotrader-trade-proposal-mcp.mjs` expects `queued_for_deterministic_validation` but receives `undefined`. The same assertion fails unchanged at accepted G2 HEAD `1ce18a3`; G2.1 does not modify that test or MCP module.

## Deferred

Browser cycles, certified historical runs, full replay/walk-forward runs, and other memory-heavy tests remain deferred by `G2_1_DEFER_RUNTIME_OR_HISTORICAL_TESTING`.

