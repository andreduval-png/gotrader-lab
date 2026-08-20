# I2 Current Read Integration

The compact `ict-i2-current-read-v1` envelope projects deterministic model state without raw candles. ICT 2022 reports ordered stage and retrace wait; PO3 reports accumulation/manipulation/distribution stage; Judas reports source block rather than a setup.

The envelope is additive and does not mutate legacy `IctCurrentRead` candidate selection. `executionAllowed` and `researchValidated` are always false. C1/C1.1 remain narrative owners and S1 remains SMT owner.
