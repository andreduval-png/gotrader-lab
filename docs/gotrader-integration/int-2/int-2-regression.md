# INT-2 Regression

Passed post-merge:

- INT-1 A-J convergence
- INT-1.1 live IFVG geometry and producer-to-plan E2E
- IFVG, trade construction, all canonical geometry boundary/no-chase/target/R:R/current-read/causality suites
- G2.1 producer geometry, Current Opportunity, Activate Market, signal contract, operator console
- G2.2 final geometry, Phase 2, news/session, SMT
- source integrity, provenance, safety, and MT5 read-only safety
- TypeScript typecheck and production build

Build retained the existing Rollup circular-chunk and large-chunk warnings.

Legacy diagnostic limitation: `test:trade-geometry-bt2` cannot resolve the
inherited missing `scripts/test-ict-i2-bt2.mjs`. INT-2 did not fabricate this
historical suite.
