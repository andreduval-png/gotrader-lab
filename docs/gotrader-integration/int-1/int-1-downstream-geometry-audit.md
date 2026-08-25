# INT-1 Downstream Geometry Audit

| Consumer | Integrated rule |
| --- | --- |
| Activate Market | Projects `matchingCandidate.geometry`; no generic actionable completion |
| Current Read | Explains and projects canonical geometry only |
| Current Opportunity | Publishes levels only from canonical geometry; diagnostics strip levels |
| Signal contract | Serializes canonical geometry; compatibility fields are non-authoritative |
| Operator Console | Uses `proposedGeometry`; no current-price, midpoint, or implied-RR fallback |

`completeSignalTradeStructure` and nearest-level helpers remain in the legacy advisor as diagnostic machinery. Static and runtime consumers do not permit them to create actionable plans. Missing canonical geometry yields `NO_TRADE` and blank entry, stop, target, and R:R values.
