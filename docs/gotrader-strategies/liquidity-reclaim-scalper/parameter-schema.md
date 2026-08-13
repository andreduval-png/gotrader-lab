# Parameter Schema

The v1 schema exposes 25 behavior-affecting fields. Canonical serialization of
the schema version, strategy ID, and complete validated parameter object creates
`parameterHash`. Unknown, missing, malformed, or out-of-range fields fail closed.

The base profile uses 15m context, 5m structure, and 1m execution; canonical
liquidity/displacement; IFVG proximal-edge entry; raid-extreme stop; external
liquidity target; no session filter; liquidity-objective-only bias; and preferred
dealing-range context. `minimumTheoreticalRR` is `null` because the source does
not support inventing a threshold.

The schema is a research contract. It does not authorize parameter search.
