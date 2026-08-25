# INT-1 G2.3 Integration

G2.3 was reproduced from exact commit `15911d673d7f4ccafdaf8f135c766525b0c03330`, tree `166000f493a9d1c1fcef0657a09ff400917aa61f`, whose sole parent is primary base `d665288ecde763d103a59387584f3cdfd16f8c95`.

IFVG v3 uses its distal IFVG edge plus the frozen range/gap buffer as the native stop. The 4-point MNQ/USTECH policy is viability only: `3.999` and `1.29` fail, while exactly `4.00` passes that gate. It never widens a stop. `ENTRY_MISSED` and `STOP_DISTANCE_TOO_SMALL` remain active, and targets are never stretched to manufacture R:R.

Historical lifecycle requires a causal retrace to intended entry; otherwise the result is `ENTRY_NOT_RETRACED`.
