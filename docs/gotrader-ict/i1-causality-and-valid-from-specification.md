# I1 Causality and Valid-From Specification

Every fact obeys `occurredAt <= confirmedAt <= validFrom`. A historical consumer may only see a fact when market time is at or after `validFrom` and before any `invalidatedAt`.

- Swings occur at the pivot and become valid after the right confirmation window.
- Equal levels and swing liquidity inherit confirmed swing visibility.
- FVGs become valid on the third candle; later partial fill, fill, and inversion produce transition facts.
- MSS becomes valid on the close-through candle and can reference only already valid swings.
- Blocks occur at their origin candle but become valid only with the confirming MSS; conversions become valid later.
- Range and IRL/ERL facts inherit the latest anchor confirmation.

The same canonical builder serves Current Read and historical BT2. `asOf` filters source candles before source fingerprinting. The adversarial future-extension fixture proves that appending candles after an unchanged `asOf` cannot alter the snapshot.
