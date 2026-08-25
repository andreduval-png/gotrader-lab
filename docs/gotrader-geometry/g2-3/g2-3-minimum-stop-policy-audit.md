# Minimum Stop Policy Audit

- Owner: canonical ICT trade construction symbol risk model.
- Policy ID: `ict_index_risk_policy_v1`.
- Scope: requested or broker symbols containing USTECH, MNQ, NQ, or US100.
- Unit: provider price points, not dollars, ticks, pips, or contract value.
- Rule: risk distance below `4.0` fails; exactly `4.0` passes.
- Role: viability gate only. It never generates or widens a stop.

The rule is symbol-policy-specific, not IFVG-specific and not universal to every strategy or market.

