# BT0 Gap Analysis

Scale: 0 absent, 1 severely inadequate, 2 partial, 3 functional, 4 strong, 5 production-grade research quality.

| Domain | Score | Evidence | Required direction |
|---|---:|---|---|
| Historical ingestion | 2 | MT5 range, browser import, and manifests exist; no canonical paged store | BT1 resumable partitioned ingestion |
| Two-year scalability | 1 | 5,000-row API cap, browser object graphs, no durable job | Headless columnar dataset/jobs |
| Historical time correctness | 1 | Historical provider basis and DST explicitly unverified | Verified historical time contract |
| Lookahead protection | 3 | Several causal slices and regression fixtures; no capability-enforced as-of API | Canonical as-of context + property tests |
| Strategy coverage | 2 | Many detectors/replay scripts; zero fully two-year capable profiles | Adapter migration against manifest |
| Entry realism | 2 | Some future touch logic; other paths assume immediate fill | Canonical order/fill lifecycle |
| Intrabar handling | 3 | Conservative stop-first exists | First-class ambiguity and optional lower-TF resolution |
| R:R analysis | 2 | Native geometry and R exist; ICT uses MFE as achieved R | Separate theoretical, available, realized, net R |
| CFD normalization | 1 | MT5 mappings exist; futures sanitizer/static tick fallback conflicts | Versioned point/pip/symbol-spec contract |
| Cost modeling | 1 | Static tick-like spread/slippage/commission in selected path | Broker-normalized dynamic/versioned model |
| Risk simulation | 1 | Linear fixed account helper and simple MC | Independent policy-driven account simulator |
| Portfolio simulation | 0 | No simultaneous capital/exposure/correlation engine | BT7 portfolio engine |
| Statistics | 2 | Core counts/PF/DD/mean exist; many metrics inconsistent/missing | Versioned formula registry |
| Walk-forward | 2 | Chronological generic windows and stronger detector holdout | Nested/frozen workflow with warmup and identity |
| OOS | 2 | Several strategy-specific methods; overlap and lineage gaps | One OOS contract and acceptance policy |
| Monte Carlo | 2 | Actual seeded IID resampling | Retained seeds, blocks/regimes/correlation/costs |
| Optimization | 2 | Variant/profile research exists | Immutable trial ledger and nested selection |
| Curve-fit protection | 1 | Frozen controls/holdouts help; no multiple-testing accounting | Preregistration and selection-bias controls |
| Reproducibility | 1 | Random/time IDs and incomplete run identity are common | Canonical experiment identity |
| Lineage | 3 | Phase 3F and B1 contracts are strong but not integrated | Reuse those contracts end-to-end |
| Persistence | 2 | IndexedDB/localStorage/JSON/Markdown artifacts exist | Authoritative filesystem/database manifests |
| Restart/resume | 0 | No durable cursor/checkpoint/idempotent recovery | BT1/BT2 job checkpoints |
| Performance | 2 | Worker and bounded browser modes exist; repeated-window complexity | Incremental facts and headless streaming |
| Parallelism | 1 | Single browser Worker only | Deterministic bounded child/worker pool |
| UI comparison | 2 | ICT Lab/Performance/Validation surfaces exist | Dataset/run comparison and drill-down |
| Reporting | 2 | Many compact reports/audits, incompatible schemas | Canonical report schema and exports |
| Safety | 5 | Read-only sources, authority none/none/none, frozen gates and safety tests | Preserve unchanged |

Total: 48 / 135 (35.6%). Safety is strong; research validity and operating lifecycle are not.

## Critical Blockers

1. Historical time and DST are not accepted.
2. Dataset and run identity are not end-to-end.
3. CFD/forex point/pip and cost normalization are not canonical.
4. Entry/fill/outcome semantics differ by engine.
5. No restartable two-year job lifecycle exists.
6. No immutable canonical trade ledger or portfolio simulator exists.
7. Strategy adapters do not cover the full manifest.

## Preserve / Replace

Preserve Phase 3F hashing/time gates, B1 identities and authority, strategy manifest, canonical candles/context, causal fixtures, conservative ambiguity, frozen IFVG controls, detector-profile holdout, deterministic bootstrap, and safety suite.

Replace authoritative browser persistence, futures-only symbol assumptions, generic tick fallback, random run identities, duplicated outcome schemas, MFE-as-realized-R, and monolithic UI-driven run lifecycle after shadow parity is proven.

## Classification

The gap pattern is architectural rather than cosmetic. `INCREMENTAL_IMPROVEMENT` cannot safely unify identity, time, units, lifecycle, and portfolio boundaries. `MAJOR_REFACTOR` risks breaking the frozen controls inside legacy engines. The recommended class is therefore exactly `NEW_CANONICAL_BACKTEST_SUBSYSTEM`, with adapters shielding existing behavior until explicit adoption.
