# Cycle Certified Evidence Contract Governance Record

Recorded: 2026-08-14

## Accepted Feature Identity

- Worktree: `C:\Users\andre\OneDrive\Documents\gotrader-cycle-certified-evidence-contract`
- Branch: `codex/gotrader-cycle-certified-evidence-contract`
- Accepted HEAD: `a65e48af58941c68298c0ceb1623e7f1a53d3ae6`
- Accepted tree: `3ea11f5d4791af9b3d17af7e3434c5430e53eb63`
- Authorization: `86545c289388610a836209a686bb14352c9393b0`
- Implementation: `362bdba308b8b6be53f67f9122644c635fe33e2b`
- Acceptance report SHA-256: `99da2c6c2bc4003b28a7a2cd23df904492f625885161168af6d9f098f11821ff`

## Decision

Accept the research-cycle two-layer evidence contract. Current candles remain
the tactical source. Historical evidence can support a current candidate only
when the exact strategy/profile, parameter, source family, symbol mapping,
timeframe, validation, dataset certificate, dataset, and report identities are
bound and verified. Uncertified matches are profile context only; mismatches
and missing identities fail closed and remain visible.

The acceptance passed focused contract tests, strict typecheck, core,
source-integrity, provenance, safety, production build, and sequential 44/44
browser smoke. The initial EOL-only baseline failure and stale operator-label
43/44 browser failure remain disclosed in the acceptance report.

## Authority Boundary

Authority remains `none/none/none`. This record does not authorize R1 resume,
parameter search, readiness advancement, Paper Demo, runtime adoption,
production, broker mutation, trade intent, orders, or execution. Raw candles
remain excluded.
