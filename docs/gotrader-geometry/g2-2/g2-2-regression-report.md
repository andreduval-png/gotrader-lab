# G2.2 Regression Report

Concurrency decision: `G2_2_SAFE_WITH_RESTRICTIONS`.

Preflight found 2.38 GB free of 15.61 GB RAM and active services on ports 5173, 4174, 7341, and 8787. No healthy service was stopped or restarted. Historical sweeps and optimization were not run.

## Passed

- `npm.cmd run typecheck`
- `npm.cmd run build` (existing Rollup circular-chunk and large-chunk warnings unchanged)
- `npm.cmd run test:g2-2-final-geometry`
- `npm.cmd run test:g2-2-controls`
- `npm.cmd run test:g2-2-bt2-profiles`
- G2.1 Current Read, Current Opportunity, Operator Console, Signal Contract, MCP, source-block, and evidence-identity suites
- source integrity, provenance, safety, and MT5 read-only safety
- IFVG v1-v4, Silver Bullet v1/v2, Turtle Soup, CISD, London Raid v1/v2, ICT 2022, deterministic PO3, Charter profiles/integration, and Model 5 closure

The one-point regression returned `rejectedStopDistance: 1`, `acceptedStopDistance: 2`, `acceptedRR: 6`, and `downstreamConstructors: 0`.

The geometry controls passed for directional validation, below-R:R retention, no target stretching, no stop tightening, entry missed, target consumed, BT2 parity, and future-extension invariance.

BT2 copies exact canonical intended entry, stop, and primary target. It owns fill, spread, slippage, commission, ambiguity, trade-through, and outcome only. Missing or non-actionable canonical geometry produces no request.

Evidence identity hashes strategy/version, profile/version, parameter hash, candidate, entry model, stop model and buffer policy, selected target identity, target policy/version, minimum-R:R policy, and source fingerprint into the geometry identity. This is behaviorally equivalent to an explicit geometry-policy field when policy owners increment their versions. No historical evidence was rewritten.

## Known Non-Actionable Limitations

1. `test:g2-1-replay-parity` reproduces the accepted module-resolution defect: generated `ictAdvisorEngine.mjs` cannot resolve `.gotrader/currentOpportunity`.
2. Direct replay inspection classifies the advisor replay as `LEGACY_DIAGNOSTIC / MIGRATION_PENDING`. It scores advisor-era signal numbers and does not accept or mutate `CanonicalTradeGeometry`; it is not authoritative canonical replay.
3. Legacy walk-forward/backtest diagnostics still expose configurable stop models and fixed-R targets. They are `MIGRATION_REQUIRED` before canonical validation claims. They do not feed G1.1 or BT2 canonical actionability, so unsafe `CANONICAL_VALIDATION_DEPENDENCY` count is 0.
4. `test:ict-phase2-models` has a generated-module resolution defect for `ictDetectorCanonicalGeometry.mjs`. Dedicated B&B/OSOK source-block tests and the G2.2 static certification pass.
5. The legacy MCP proposal validator calculates diagnostic R:R for user numbers. It is isolated from all canonical actionable consumers.
6. Existing production-build Rollup warnings remain unrelated to geometry ownership.

None of these limitations can create, replace, or validate actionable canonical geometry. They do mean replay/walk-forward require migration before the broader validation program can call those lanes canonical.

## Historical Disposition

`HISTORICAL_ACCEPTANCE_DEFERRED`.

No two-year run, parameter search, ablation, FDR, optimization, or evidence promotion was performed. The one bounded 90-day London Raid v2 regression used existing read-only MT5 diagnostics and remained research-only; it claimed no new validation evidence.

Authority: `none/none/none`.
