# G1.1 Current Read and Current Opportunity Parity

Current Opportunity now attaches an immutable canonical geometry object whenever
the detector supplies a directional entry, structural invalidation, target,
source identity, and strategy threshold. Its compatibility fields `entry`,
`invalidation`, `target`, and `rrEstimate` are projected from that object.

Activation carries the selected candidate's geometry unchanged. The Operator
Console prefers its lossless projection over signal-contract compatibility
fields. It no longer derives an entry algebraically from stop, target, and R:R.

The UI labels non-actionable values `Research entry`, `Research stop`, and
`Research target`, displays `Theoretical R:R`, and emits `NO_TRADE`. A valid
research setup therefore remains visible even when it fails the actionability
gate. A later target hit is outcome evidence and does not retroactively change
the decision made at market time.

Current Read remains a market/narrative producer. It does not select or mutate a
canonical target. Legacy signals without canonical geometry continue through a
compatibility projection but cannot use implied-entry recovery; they remain a
documented staged-migration limitation.

