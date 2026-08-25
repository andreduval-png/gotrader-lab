# INT-2 Live IFVG Geometry Parity

The real IFVG v3 producer invokes `adaptIfvgNativeGeometry` before
`compactIctIfvgFreshRetestV3Assessment`.

Verified chain:

`evaluateIctIfvg -> assessIctIfvgFreshRetestV3 ->
adaptIfvgNativeGeometry -> compact assessment -> Current Opportunity ->
signal contract -> Activate Market -> operator plan`.

Exact fixture:

- geometry ID: `fnv1a128:51bed382147c310eac6a997059cebd92`
- entry: 95
- stop: 93.9095
- target: 98.6
- theoretical R:R: 3.301237964236566

All downstream projections retained these values unchanged.
