# INT-1 G1.1 Integration

`src/lib/tradeGeometry` now owns `StrategyGeometryIntent`, `CanonicalTradeGeometry`, target selection, entry lifecycle, directional R:R, and canonical projection.

Actionability requires complete producer-owned geometry, a valid lifecycle, a native target, minimum R:R, producer eligibility, and authority `none/none/none`. Valid low-R:R geometry remains visible as research geometry but is non-actionable. Missing or invalid geometry is `NO_TRADE`; downstream consumers cannot repair it.

The causality suite proves target selection and geometry remain unchanged when future data is appended beyond fixed `asOf`.
