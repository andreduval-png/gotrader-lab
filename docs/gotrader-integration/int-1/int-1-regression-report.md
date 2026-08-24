# INT-1 Regression Report

## Passed

Canonical facts; trade geometry, targets, causality, and anti-chase; G2.1/G2.2 geometry acceptance; G2.3 IFVG; trade construction; Current Read; Current Opportunity; Activate Market; signal contract; Operator Console; Phase 2 quarantine; SMT; news/session risk; source integrity; provenance; safety; MT5 read-only safety; INT-1 adversarial A-J; TypeScript typecheck; Vite production build.

The production build completed with pre-existing Rollup circular re-export and large-chunk warnings. No new build error was introduced.

## Adversarial Matrix

| Case | Result |
| --- | --- |
| A/B 3.999 vs 4.000 | fail closed / boundary pass |
| C low R:R | levels retained, non-actionable |
| D entry missed | `ENTRY_MISSED` |
| E/F missing geometry or target | `NO_TRADE`, no synthesis |
| G/H B&B and OSOK | `SOURCE_BLOCKED`, no levels |
| I v3/v4 | separate identities |
| J future extension | invariant at fixed `asOf` |
