# INT-1 Authority Audit

Research authority remains:

- `executionAuthority: none`
- `brokerAuthority: none`
- `readinessOverrideAuthority: none`
- `productionAdoptionAllowed: false`
- `canCreateTradeIntent: false`

No reachable research-to-broker write path exists. Searches for order placement, execution, close/modify position, live enablement, and broker writes found only deny-list/policy text; the MT5 gateway remains read-only and safety tests reject mutation endpoints. Typed broker-router modes do not grant runtime authority.
