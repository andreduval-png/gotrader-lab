# I2 ICT 2022 Model Specification

Identity: `ict_2022_model_v1` version `1.0.0`, research-only. The base profile uses structural H1, directional M15, setup M5, execution M5, optional H4/M1, FVG midpoint entry, raid-extreme stop, and external draw target.

The model consumes C1/C1.1 `structuralBias`, `currentFlowDirection`, `setupMaturationDirection`, and `liquidityPath`. At least two directional roles must agree with the path. It then consumes I1 `DRAW_ON_LIQUIDITY`, opposite-side consumed `LIQUIDITY`, same-direction `DISPLACEMENT`, `MSS`, and fresh `FVG` in timestamp order. A later candle must retrace into the FVG.

Long and short paths are symmetric. Native geometry is never changed to meet minimum RR. A structurally valid geometry below the frozen minimum remains `ENTRY_ELIGIBLE` with a non-actionable blocker. BT2 owns fill and outcome.
