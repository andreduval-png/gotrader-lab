# Liquidity Reclaim Scalper v1 Implementation Authorization

- Date: 2026-08-13
- Parent: `d67c5d010c75e658d2eed82c55066094f47538a3`
- Strategy ID: `liquidity_reclaim_scalper_v1`
- Profile ID: `liquidity_reclaim_scalper_v1_base_research`
- Concurrency decision: `LRS_SAFE_WITH_RESTRICTIONS`
- Authority: `none/none/none`

## Authorized Scope

Implement a new experimental, research-only strategy family that consumes
existing canonical liquidity, dealing-range, displacement, FVG/IFVG, session,
HTF, identity, and BT2 simulation contracts. Add versioned parameters and
profile identity, a causal deterministic state machine and candidate contract,
long/short geometry intent, a strict BT2 adapter, adversarial fixtures, registry
projection, deterministic explanations, documentation, and one bounded
descriptive baseline when resource and dataset preflights permit.

The source-extraction classification must distinguish source-supported rules,
existing canonical rules, research parameters, and unresolved semantics. No
video inference may be presented as a source rule.

## Restrictions

- Use the certified BT1.6 dataset identity only; do not retrieve or commit raw candles.
- Do not redefine canonical IFVG, liquidity, displacement, time, or BT2 fill/intrabar/cost behavior.
- Do not run parameter optimization or modify the strategy after baseline results.
- Do not contact MT5 or mutate shared `.gotrader` runtime state.
- Do not alter existing strategy IDs or frozen baseline snapshots silently.
- Do not start Paper Demo, production, broker mutation, order placement, or execution.
- Do not create readiness/evidence authority or auto-promote/calibrate a profile.

The existing phased automation is paused because its BT3A parameter-schema
scope overlaps this implementation. Runtime services remain untouched.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
canCreateEvidence: false
canApproveReadiness: false
canApplyCalibration: false
canCreateTradeIntent: false
```
