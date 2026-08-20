# I2.1 Base Profile Freeze

These profiles are preregistered before any certified baseline result. They must not change in response to results.

## ICT 2022

- Strategy/version: `ict_2022_model_v1` / `1.0.0`
- Profile: `ict_2022_base_research_v1` / `1`
- Parameter hash: `fnv1a32:89376403`
- Parameters: structural 1h; directional 15m; setup/execution 5m; FVG midpoint entry; raid-extreme stop; external-draw target; 180-minute maximum age; 1.00 minimum theoretical RR.

## Power of Three

- Strategy/version: `ict_power_of_three_v1` / `1.0.0`
- Profile: `po3_external_liquidity_base_v1` / `1`
- Parameter hash: `fnv1a32:36de226c`
- Parameters: any canonical session; displacement-and-MSS distribution confirmation; external-liquidity objective; FVG midpoint entry; manipulation-extreme stop; 720-minute lifecycle; 1.00 minimum theoretical RR.

## Shared Evaluation Identity

- Dataset certificate: `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`
- BT2 adapter: `ict-i2-bt2-request-v1`
- Fill/outcome owner: `BT2`
- Ambiguity policy: `bt2.stop-first-same-bar.v1`
- Cost model: `bt2.mnq-research-default-frictions.v1` = 0.25 tick size, 1 spread tick, 1 adverse-slippage tick, 1 round-trip commission tick.
- C1 policies: `c1.i2.ict-2022-directional-objective.v1`; `c1.i2.po3-delivery-context.v1`
- SMT: optional and S1-owned.

Judas has no executable base profile. Its blocked-parameter hash is `fnv1a32:3e04dc56`; that hash is evidence identity, not a runnable strategy profile.
