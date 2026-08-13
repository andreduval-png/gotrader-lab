# GoTrader Product Integrity Audit Authorization

Date: 2026-08-13

Parent: `07257150ff8aacdfd3a8e8ab772086438cdb5ae7`

## Authorized Scope

Audit every user-facing route, dashboard surface, status label, feature claim,
control, and persisted browser workflow against its actual implementation and
current authority. Exercise the application through focused system tests and a
real browser. Correct verified defects in UI truthfulness, stale projections,
broken controls, storage resilience, responsive behavior, accessibility, and
missing operator visibility required to understand existing accepted behavior.

Each correction must be traceable to an audit finding, narrowly scoped, and
covered by focused tests. User-visible claims must identify unavailable,
degraded, simulated, research-only, shadow-only, candidate, or blocked states
honestly and must not imply functionality beyond the backing contract.

## Prohibited Scope

- No strategy threshold, approved-profile, readiness, evidence, risk, or
  promotion-gate relaxation.
- No simulation or statistics promotion, parameter search, risk allocation,
  portfolio action, Paper Demo activation, production adoption, broker mutation,
  order placement, or execution.
- No automatic startup or external contact added solely for the audit.
- No raw-candle commit or deletion of accepted or failed evidence.
- No implicit adoption of change control, BT3A, or any later phase.

Authority remains `none/none/none` throughout this audit.

