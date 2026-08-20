# I2 BT2 Integration Report

`adaptIctI2CandidateToBt2` accepts only `ACTIVE`, directional candidates with canonical geometry and an accepted dataset certificate ID. It preserves strategy/profile/parameter/source/dataset identity and supporting fact IDs. Raw candles, account state, orders, positions, fills, and outcomes are excluded.

I2 owns detection, state, blockers, expiry, and geometry intent. BT2 owns fill, trade-through, spread, slippage, commission, intrabar ambiguity, stop/target ordering, and outcome. Existing BT2 fixtures confirm entry+stop, entry+target, and stop+target same-bar behavior; ambiguous stop+target remains conservatively stop-first.

G1 was dirty and unaccepted at preflight, so I2 preserves the accepted BT2 geometry boundary and does not import G1.
