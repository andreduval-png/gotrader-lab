# Cycle Certified Evidence Contract Authorization

Authorized: 2026-08-14

## Scope

Implement a research-only two-layer evidence contract for each research cycle:

- current canonical candles remain the sole source for the tactical market read;
- historical results may support that read only when strategy/profile, parameters,
  source family, symbol mapping, timeframe, and validation identities match;
- certified historical status requires an explicit dataset certificate and
  certificate-bound report identity;
- missing or mismatched evidence remains visible and fail-closed;
- historical evidence never supplies current entry, stop, target, or bias.

## Boundaries

This authorization does not change strategy semantics, thresholds, frozen
profiles, parameter search, readiness authority, Paper Demo, production,
broker mutation, trade intent, orders, or execution. Authority remains
`none/none/none`. Raw candles must not be persisted in the contract.

Implementation and acceptance must be separate commits. Failures must be
preserved and no phase or authority may advance implicitly.
