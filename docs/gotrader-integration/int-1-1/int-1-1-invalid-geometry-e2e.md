# INT-1.1 Invalid Geometry E2E

- MNQ 3.999-point risk: `STOP_DISTANCE_TOO_SMALL`, geometry unset, no actionable plan.
- MNQ 4.000-point risk: distance gate passes unchanged.
- MNQ 4.001-point risk: distance gate passes unchanged.
- Entry passed: canonical lifecycle `ENTRY_MISSED`, nonactionable, no projected target and no current-price replacement.
- Low R:R: native `100 / 95 / 105` retained as `VALID_BELOW_RR_THRESHOLD`, nonactionable.
- Existing browser state on port 4177 displayed `NO TRADE` and no entry/stop/target for its nonactionable stored cycle.

Historical `ENTRY_NOT_RETRACED` handling in the backtest path was not modified.
