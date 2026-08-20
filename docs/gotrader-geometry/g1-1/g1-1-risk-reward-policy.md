# G1.1 Risk/Reward Policy

G1.1 computes theoretical R:R from immutable intended levels with signed,
direction-aware distances. Long requires `stop < entry < target`; short requires
`target < entry < stop`. No `abs()` operation masks invalid ordering.

Theoretical R:R excludes fills, spread, slippage, commission, and intrabar
ordering. BT2 owns those execution effects and reports net/realized values
separately. Threshold comparison uses the full JavaScript numeric result; only UI
formatting rounds it.

Minimum R:R belongs to the strategy/profile policy. If it is absent, geometry is
valid research-only and cannot become actionable. A structurally valid geometry
below its declared threshold receives `VALID_BELOW_RR_THRESHOLD`; neither stop
tightening nor target stretching is permitted.

Displayed theoretical R:R is projected from the canonical object together with
the exact entry, stop, and target. Consumers do not calculate an independent
display value.

