# GoTrader Change-Control Governance Decision

- Decision: `CC-GOV-2026-08-13`
- Status: adopted as a governance process only
- Authorization: `1c1f5b596dc34a3183ef6a0a7465c3c6e5425827`
- Accepted parent: `877ccc047912d7b016f2d603623a01e362cf7596`
- Governance baseline: `b06493496b51dff74b578a881dcc31d5cd07ac11`
- Authority: `none/none/none`

## Decision

Adopt the existing architecture change-control policy as the mandatory process
for subsequent GoTrader implementation and operational slices. Every slice is
bound to an exact clean parent and explicit authorization commit. Implementation
and acceptance must be independent commits, and acceptance must identify the
exact implementation tested by both focused and complete regression gates.

Failed, blocked, and superseded evidence is retained without rewriting.
Rollback requires an explicit restore identity, preview evidence, preserved
audit history, and no authority expansion. Accepted evidence remains immutable;
raw candles are never committed as governance evidence.

Human approval remains mandatory for Paper Demo, live execution, broker
mutation, and any authority change. Reviewers must reject ambiguous identity,
missing evidence, conflated implementation/operational status, or implicit
phase advancement.

## Source Inventory

The exact paths and Git blob identities reviewed by this decision are recorded
in `change-control-governance-decision.json`. That machine-readable record is
the normative decision contract.

## Explicit Non-Authorization

This decision does not authorize BT3A, any later phase, runtime adoption,
readiness changes, production use, Paper Demo, broker mutation, trade intent,
or execution. The next phase may begin only after its own authorization record
is committed from the accepted decision head.
