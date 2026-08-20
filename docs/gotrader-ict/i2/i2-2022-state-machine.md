# I2 ICT 2022 State Machine

`SEARCHING -> DIRECTIONAL_OBJECTIVE_ESTABLISHED -> WAITING_FOR_LIQUIDITY_RAID -> LIQUIDITY_RAID_CONFIRMED -> DISPLACEMENT_CONFIRMED -> MSS_CONFIRMED -> FVG_CREATED -> WAITING_FOR_RETRACE -> ENTRY_ELIGIBLE -> ACTIVE`.

Terminal states include `INVALIDATED`, `ENTRY_MISSED`, `NO_FILL`, `SETUP_EXPIRED`, `LIQUIDITY_OBJECTIVE_CONSUMED`, `TARGET_REACHED`, and `SOURCE_BLOCKED`. Each transition stores `validFrom` and supporting fact IDs. Facts after evaluation `asOf` are invisible. The model cannot jump from raid to entry.

Mandatory/inseparable: objective, raid, displacement, MSS, FVG, retrace. Dependent: geometry and BT2 request. Optional: SMT and profile timeframe alternatives.
