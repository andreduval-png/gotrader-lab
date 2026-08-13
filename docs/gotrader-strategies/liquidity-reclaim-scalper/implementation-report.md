# Liquidity Reclaim Scalper v1 Implementation Report

Status: implemented with documented strategy-semantic limitations

The new experimental family has typed parameters, immutable profile identity,
a causal deterministic state machine, compact candidate geometry, canonical
Phase 2A fact reuse, strict BT2 adaptation, additive strategy registration,
stable blockers, and deterministic operator explanation. It has no execution,
broker, readiness, evidence, calibration, production, or Paper-Demo authority.

Focused parameter, state, causal/lookahead, long/short BT2, and conservative
intrabar tests pass. The initial full two-year descriptive baseline is deferred
and no profitability or validation claim is made.

The frozen v1 catalog snapshot remains byte-identical. The intentional additive
catalog is sealed separately as `strategy-catalog-behavior-v2.snapshot.json`.
The detector resides in the shadow-only V2 strategy-adapter namespace, so the
Phase 1 production-consumer count remains zero.

```text
researchValidated: false
productionAdoptionAllowed: false
authority: none / none / none
```
