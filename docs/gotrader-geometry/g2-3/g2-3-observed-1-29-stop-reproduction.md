# Tight-Stop Reproduction

The reported production family was a short with about 1.29 price points between midpoint entry and invalidation. The exact producer formula is the IFVG distal edge plus the existing buffer; it is not an advisor fallback.

The deterministic MNQ/USTECH regression reproduces the same family:

- Candidate: `ifvg|MNQ|USTECH|5m|2026-06-12T14:30:00.000Z|2026-06-12T14:40:00.000Z|2026-06-12T14:45:00.000Z|long`
- Entry: `95`
- Stop: `93.9021`
- Target: `98.6`
- Stop distance: `1.0979` price points
- Theoretical R:R: `3.279R`
- Stop source: `ifvg_distal_edge_plus_buffer`
- Result: setup detected, `STOP_DISTANCE_TOO_SMALL`, geometry not eligible, no actionable plan.

The fixture intentionally does not hardcode 1.29; it exercises the same source calculation and sub-four-point policy boundary.

