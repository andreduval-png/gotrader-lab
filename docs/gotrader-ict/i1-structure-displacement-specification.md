# I1 Structure and Displacement Specification

`canonicalStructure` owns DISPLACEMENT and MSS.

Displacement records start/end candle IDs, body size, baseline body size, multiple, and measurement policy. The retained legacy-suite policy uses a ten-body baseline and 1.6 minimum multiple; alternate accepted definitions must use separate policy IDs.

MSS requires a causal close-through of a previously confirmed swing. It records the broken structure ID and links a matching same-candle displacement when available. CISD remains an unchanged strategy; it may later adapt these shared identities without an I1 semantic rewrite.
