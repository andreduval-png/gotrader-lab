# BT2 Canonical Opportunity Contract

## Purpose

`CanonicalOpportunity` is an immutable, strategy-native proposal evaluated as
of a closed-candle decision boundary. It is research input to BT2 simulation,
not a broker order, readiness artifact, or trade intent.

## Required Identity

The opportunity core includes:

- schema and adapter versions;
- qualified historical dataset certificate and dataset IDs;
- strategy/profile/parameter hashes supplied by a future BT3 adapter;
- requested and broker symbols, decision timeframe, and half-open data scope;
- `decisionAtUtc`, last known source candle close, warmup identity, and causal
  context lineage root;
- direction, native geometry mode, order policy, activation time, expiry;
- signal price, entry rule/price, stop, ordered targets, and native risk;
- explicit eligibility plus blocker/no-opportunity reasons;
- authority `none / none / none` and disabled capabilities.

The opportunity ID is the canonical SHA-256 hash of the complete core. Changed
geometry, timing, blocker, dataset, adapter, strategy, or policy produces a new
identity. An identical ID with different bytes is an immutable conflict.

## Causality

- Inputs expose only source candles whose close is at or before the declared
  as-of boundary.
- Higher-timeframe facts become available only after their source candle close.
- Order activation cannot precede `decisionAtUtc` or use the decision candle's
  unknown post-decision path.
- Appending future candles cannot change an already emitted opportunity.
- A placeholder, diagnostic, malformed, or ineligible profile can emit only a
  blocked/no-opportunity record.

Required property tests cover future-append invariance, prefix equivalence,
HTF-close timing, deterministic serialization, identity sensitivity, and
forbidden future-field scanning.

## Geometry And Units

Native strategy geometry is preserved without RR normalization. Raw price,
broker points, configured pip units, and R are separate typed quantities.
Cash, lots, margin, and portfolio risk are absent from the opportunity.
Standardized RR experiments are later identified children and cannot mutate the
native opportunity.

## Order Policies

The first contract supports explicit, versioned policies:

- `market_at_next_open`;
- `limit_at_price`;
- `stop_at_price`;
- `retracement_touch` with identified derivation;
- `strategy_defined` only when a future adapter supplies a separately versioned
  deterministic resolver.

No policy may infer a fill from a candle that was already complete when the
order became active unless activation and ordering evidence explicitly permit
it.

## Outcome Boundary

Opportunities contain no win/loss, future excursion, fill, exit, profitability,
analytics, readiness, or selection fields. Those belong to immutable BT2
simulation records and later consumers.
