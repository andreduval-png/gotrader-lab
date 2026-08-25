# INT-2 Browser Acceptance

The dedicated 4178 dashboard rendered the compact Operator Console with the
Research trade plan card, entry/stop/target/R:R labels, honest NO TRADE state,
and the none/none/none safety strip.

Automated browser checks:

- desktop 1440x950: zero overflow, no page errors, no unsafe controls
- mobile 390x844: zero overflow, no page errors, no unsafe controls
- required operator and plan labels visible at both sizes

The in-app browser also rendered the dedicated server at desktop size. Its
viewport override backend did not alter the reported 1280x720 viewport, so the
exact mobile breakpoint was independently exercised through the repository's
Playwright browser runtime.
