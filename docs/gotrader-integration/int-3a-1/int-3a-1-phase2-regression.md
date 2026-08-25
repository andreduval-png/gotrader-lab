# INT-3A.1 Phase 2 Regression

The Phase 2 smoke harness required a narrow generated-module stub for the new
`ictI2` dependency reached through Current Read. The harness rewrite now maps
that dependency idempotently to `ictI2Stub.mjs`.

No Phase 2 detector behavior changed. Bread and Butter and One Shot One Kill
remain source-blocked/non-executable. The smoke test passes with no new geometry
or authority.

