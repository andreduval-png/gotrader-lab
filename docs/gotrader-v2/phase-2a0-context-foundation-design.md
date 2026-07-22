# GoTrader V2 Phase 2A.0 Shadow Context Foundation

## Boundary

Phase 2A.0 establishes contracts and eligibility only. It does not calculate session, opening, dealing-range, liquidity, sweep, displacement, FVG/IFVG, or higher-timeframe facts.

The context namespace is shadow-only and has no production consumers. It cannot create strategy signals, trade geometry, replay evidence, readiness, Paper-Demo eligibility, broker requests, or execution behavior.

## Versions

- context schema: `gotrader-v2-canonical-market-context-v1`
- context policy: `gotrader-v2-context-policy-v1`
- context input identity: `gotrader-v2-context-input-identity-v1`
- shadow session calendar: `gotrader-v2-shadow-session-calendar-v1`
- strategy session timezone: `America/New_York`
- market-data identity: `gotrader-v2-market-data-identity-v2`
- canonical hash: `gotrader-v2-sha256-v1`
- MT5 time contract: `1.1.0`

The shadow session calendar is only a version owner. Phase 2A.0 does not implement session boundaries or an exchange-holiday calendar.

## Data Flow

```text
explicit read-only source
  -> V2 canonical closed-candle windows
  -> purpose-scoped time eligibility
  -> sorted multi-window context identity
  -> pure context builder shell
  -> immutable context artifact with zero facts
```

Returning zero facts is intentional. A contract or placeholder is not market analysis. Later phases must add each fact family with its own causal policy and tests.

## Multi-Window Identity

Context identity hashes:

- explicit source identity;
- purpose;
- market-time `asOf` boundary;
- required timeframes;
- sorted input-window identity hashes and compact boundaries;
- context policy version;
- session-calendar version.

It excludes raw candles, build time, UI state, random IDs, observation age, and terminal raw-clock values. Reordering equivalent input windows does not alter the artifact ID. A meaningful source, window, policy, or market-time change does.

## Pure Builder

The builder receives already-loaded canonical windows. It performs no network, MT5, storage, strategy, evidence, UI, or broker operation. Repository orchestration remains separate from deterministic context construction.

`builtAt` is operational metadata and cannot affect stable context identity.

## Fact Contracts

Phase 2A.0 defines discriminated, immutable contracts for the future fact families:

- session;
- opening price;
- dealing range;
- liquidity pool;
- liquidity sweep;
- displacement;
- FVG/IFVG;
- higher-timeframe bias.

Fact identity excludes provider receive-time metadata. FVG lifecycle is represented by one exclusive state rather than overlapping booleans. No fact engine is implemented in this phase.

## No-Adoption Boundary

Architecture tests scan production source outside `src/lib/v2` and fail if the V2 context builder is imported. The V2 context namespace itself cannot import ICT strategies, Current Read, Research Cycle, validation, Paper-Demo, components, broker, or execution code.

Authority remains `none / none / none`.

## Rollback

Revert the Phase 2A.0 commit. No production adapter, strategy, route, storage schema, or evidence artifact requires migration because no consumer adopts the context namespace.
