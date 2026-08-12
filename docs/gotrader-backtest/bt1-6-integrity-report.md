# BT1.6 Integrity Report

Status: `ACCEPTED_WITH_WARNINGS`

Certification requires zero unresolved blocking integrity events, including
conflicting duplicates, unclassified gaps, future or partial bars, malformed
OHLC/volume/spread values, range violations, and unsupported derivation gaps.
Expected closures must be covered by the verified calendar rather than inferred
from familiar times.

All 192 initially unclassified M1 gaps passed two independent live GET-only
queries with zero returned candles, zero boundary failures, and zero drift.
Gap evidence ID:
`sha256:e49b7773fd4751750295c9cf1f301750fc02bf079892f7673db99d882ebe4419`.
The final repository has zero blocking integrity events and zero rejected bars.
