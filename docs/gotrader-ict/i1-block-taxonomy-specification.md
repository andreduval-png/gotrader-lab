# I1 Block Taxonomy Specification

`canonicalBlocks` distinguishes ORDER_BLOCK, BREAKER_BLOCK, and MITIGATION_BLOCK.

An order block is the last opposing candle before a confirmed canonical MSS. Its origin time is the candle time and its validity begins with the MSS. A breaker is a later close-through conversion and records `originBlockId`, `structureFailureId`, and `conversionEventId`. A mitigation block is a later overlapping revisit that closes in the expected direction and records the same relationships.

Legacy phase-2 and PD-array block variants remain unchanged. I1 does not claim canonical semantics for reclaimed, rejection, propulsion, or vacuum variants.
