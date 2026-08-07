# BT0 Existing Backtest Audit

## Executive Finding

GoTrader contains useful replay and validation components, but not one canonical, restartable, broker-normalized two-year backtest system. The most mature individual workflow is the frozen detector-profile walk-forward/OOS path; the strongest provenance component is the Phase 3F historical dataset manifest. Those strengths are not integrated into one engine.

Final BT0 status: `BT0 PASSED WITH DOCUMENTED HISTORICAL-DATA OR STRATEGY-COVERAGE LIMITATIONS`

Future work class: `NEW_CANONICAL_BACKTEST_SUBSYSTEM`

This is an audit result, not historical acceptance. Existing profitability numbers remain unchanged and cannot create evidence, readiness, calibration, trade intent, broker, production, or execution authority.

The accepted large-scale search addendum is integrated in `bt0-parameter-search-and-anti-overfitting-addendum.md`. It extends the audit through questions 36-64 and adds parameter-schema, complete trial-lineage, multiple-testing, null, ablation, cold-instrument, and sealed-holdout requirements without changing the BT0 status or authority.

## Trust Boundary

The source tree can be reliably characterized. Historical session time cannot yet be declared trustworthy because historical provider time and DST policy are explicitly unverified. Existing performance reports are useful forensic claims but generally lack the complete dataset checksum, source fingerprint, engine version, code commit, cost identity, and seed needed for reproducible profitability. They are `NOT_TRUSTWORTHY` for promotion decisions, not necessarily false.

## Direct Answers

1. **What engines exist?** A browser-era generic backtester, its detector-profile Worker wrapper, an ICT rolling replay evaluator, an MT5 real-replay wrapper, generic walk-forward, detector-profile frozen holdout/OOS, a script-only ICT OOS runner, ICT Monte Carlo, deterministic edge bootstrap, and small performance/account helpers.
2. **How many distinct implementations?** Nine behavioral families, six of which independently own material historical, replay, or statistical semantics. Wrappers and helpers are separate only where behavior changes provenance or execution.
3. **Which is most mature?** Detector-profile frozen walk-forward/OOS is the most mature validation workflow. Phase 3F is the most mature dataset identity contract. Neither is a complete backtester.
4. **What should be preserved?** The strategy manifest, canonical candle/time contracts, Phase 3F checksum and lineage schema, causal detector slicing, conservative same-bar ordering, frozen IFVG controls, deterministic bootstrap seeds, B1 identities/authority, and compact immutable report conventions.
5. **What should be retired?** Browser localStorage as authoritative run storage; futures-only generic configuration for MT5 CFDs; non-deterministic run IDs; unversioned static tick costs; immediate-entry ICT assumptions; `rrAchieved=MFE/risk` as realized R; and duplicated strategy-specific result semantics after parity migration.
6. **Which strategies are fully backtestable?** None under the required two-year, time-trusted, costed, reproducible, restartable standard.
7. **Which are partially backtestable?** IFVG v2/v3/v4 and CMD v2 have direct generic profiles. Silver Bullet v1/v2, IFVG v1, Turtle Soup, CISD, Nasdaq session-raid v1/v2, and Phase 2 Bread-and-Butter/One-Shot have replay-capable detectors with limitations. The matrix covers all 27 entries.
8. **Can two years of OHLC be retrieved?** Probably from MT5/provider history for many timeframes, but the current API caps each response at 5,000 rows and has no cursor. Two years cannot be retrieved reliably in one request; a resumable paged ingestor is required.
9. **Is historical time trustworthy?** No for session-sensitive acceptance. Current-live time qualification is separate from historical provider-time authority.
10. **Is DST trustworthy?** No. Historical DST policy is explicitly unverified.
11. **Is lookahead rigorously prevented?** Some rolling replay and generic paths use past-only slices, but one canonical detector API does not enforce the property and precomputed/full-array paths remain unverified. Overall: partial.
12. **How realistic are entries?** Mixed and limited. Generic profiles can require a future entry-zone touch; IFVG/CMD and ICT replay paths often assume entry at the signal/decision reference without modeling order availability or fill priority.
13. **How are ambiguous OHLC bars resolved?** Main generic and ICT paths use conservative stop/invalidation-first ordering when stop and target share a bar. There is no lower-timeframe reconstruction, and ambiguity is not always a first-class result.
14. **How are stops and targets modeled?** Fixed strategy/profile price levels are scanned against future OHLC highs/lows. Partial and stalled semantics vary; trailing, break-even, partial exits, gaps, and order-book liquidity are absent.
15. **How is native R:R modeled?** Geometry supplies entry, invalidation, and target. Generic paths calculate reward/risk. ICT replay's `rrAchieved` is maximum favorable excursion divided by risk, not necessarily realized R.
16. **Can standardized R:R experiments be added safely?** Yes, only as a separately identified `STANDARDIZED_RR_EXPERIMENT` derived from an immutable opportunity. Native geometry stays `NATIVE_STRATEGY_GEOMETRY` and is never overwritten.
17. **Are CFDs normalized consistently by pips/points?** No. MT5 mappings include USTECH, US500, US30, XAUUSD, EURUSD.pro, and BTCUSD, but generic config accepts futures aliases and uses static tick sizes plus a `0.25` fallback. Point, pip, minimum increment, and cash value lack a canonical versioned contract.
18. **Are transaction costs realistic?** No. Some generic runs apply static spread/slippage/commission in tick-like units; ICT replay and many reports are gross or unknown. Dynamic spread, swap, gaps, asymmetric slippage, and broker-specific commission are absent.
19. **What risk simulation exists?** A fixed `$50,000` account helper with fixed `1%` per R and an ICT Monte Carlo conversion from outcome classes to R. The runtime risk module is fail-closed policy scaffolding, not a historical portfolio simulator.
20. **Is risk separate from signal quality?** Mostly in architecture, but reporting sometimes conflates MFE-based R, outcome quality, and simulated account results. The future ledger boundary should enforce separation.
21. **What statistics exist?** Counts, wins/losses, win/target-first rate, average/realized R, profit factor, max drawdown in R, best/worst, some MAE/MFE, OOS summaries, bootstrap mean-R intervals, and Monte Carlo drawdown/ruin-style summaries.
22. **What is missing?** Consistent median R, streaks, hold time, Sharpe, Sortino, Calmar, SQN, exposure, time-under-water, monthly/quarterly/annual/session/weekday/regime tables, cost attribution, portfolio correlation, and calibrated uncertainty across all engines.
23. **How strong is walk-forward?** Partial. Splits are chronological, but generic windows can overlap and run a frozen config rather than train/select/validate. The detector-profile holdout is stronger, with minimum OOS counts and dates.
24. **How strong is OOS?** Partial. Strategy-specific audits and holdouts exist, but methods differ, sample sizes can be insufficient, and historical identity/time/cost lineage is incomplete.
25. **How strong is Monte Carlo?** Functional but basic: seeded IID outcome resampling with replacement and additive R. It lacks block/sequence models, correlation, compounding, realistic costs, and a standard retained seed identity.
26. **Is optimization curve-fit resistant?** No. Frozen profiles and holdouts help, but no universal trial ledger, family-wise correction, nested validation, or selection-bias accounting exists.
27. **Can strategies be tested as a portfolio?** No. There is no canonical simultaneous trade ledger, capital contention, cross-symbol exposure, correlation, or combined equity engine.
28. **Are runs reproducible?** Not generally. Some bootstrap tests are deterministic, but browser/ICT IDs use time/random values and most reports lack complete dataset, engine, commit, cost, parameter, and seed identity.
29. **Is artifact lineage sufficient?** Phase 3F and B1 lineage contracts are strong, but historical replay/results do not consistently use them. Overall lineage is partial.
30. **Can a two-year run resume?** No. There is no durable job state, partition manifest, checkpoint cursor, idempotent result writer, or recovery protocol.
31. **What will two-year runs cost?** About 927,000 OHLC bars per 24x5 symbol across M1/M5/M15/H1/H4/D1. Compact storage is roughly 50-120 MB per symbol; JS object graphs may consume 230-460 MB per symbol. Optimized runs should take minutes per symbol/profile, while current repeated-window scans may take tens of minutes or exhaust browser memory. A full multi-symbol, multi-profile program is hours-scale.
32. **What should the architecture be?** A headless experiment service: immutable dataset manifest -> causal strategy adapter -> immutable opportunity ledger -> deterministic fill/outcome simulator -> immutable trade ledger -> strategy analytics; a separate risk/portfolio simulator consumes the trade ledger.
33. **Refactor or new subsystem?** `NEW_CANONICAL_BACKTEST_SUBSYSTEM`. Existing pieces become adapters and references; they do not share enough identity, storage, units, lifecycle, or semantics for a safe in-place refactor.
34. **How should it interact with B1.4?** B1.4 should orchestrate and consume the reusable subsystem through B1 contracts, not contain the engine. B1.4 owns job authorization, lineage, scheduling, and policy; the subsystem owns datasets, simulation, analytics, and resumable execution. This needs an Architecture Change Control record before the frozen roadmap/index changes.
35. **What phases follow BT0?** BT1 dataset/time foundation; BT2 canonical opportunity/trade simulation; BT3 adapter migration and parity; BT4 R:R/cost/statistics; BT5 walk-forward/OOS; BT6 Monte Carlo; BT7 risk/portfolio; BT8 comparison/reporting; BT9 two-year acceptance.
36. **Can current strategies expose a sufficiently rich parameter space without altering frozen production profiles?** No. Generic config and selected profiles expose some dimensions; most detector semantics are hardcoded. Safe expansion requires research overlays/new profile versions.
37. **Which families support configuration generation?** Generic/Auto Research, the ICT approved-profile post-filter optimizer, IFVG named variants, and Session Raid v2 threshold overrides. Others have no family generator.
38. **How large are realistic spaces?** The ICT post-filter grid has exactly 2,560 combinations; IFVG has 26 named variants; Auto Research evaluates at most 25 authored candidates. Other spaces are undefined until parameter schemas/ranges exist.
39. **Is random sampling supported?** No. Current generation is deterministic authored selection or Cartesian enumeration.
40. **Can thousands of experiments run reproducibly?** No. One optimizer can enumerate thousands in memory, but dataset/run/family identity, durable jobs, seeds, full trial retention, and resume are absent.
41. **Is there a sequential validation funnel?** Partial fragments exist in Auto Research, IFVG gates, cost stress, and holdout validation, but no immutable family-wide stage ledger exists.
42. **Is any multiple-comparisons correction implemented?** No.
43. **Is BH-FDR implemented?** No.
44. **Can meaningful null distributions be generated?** No canonical null engine exists. Monte Carlo resamples observed outcomes and is not a null test.
45. **Can performance be compared with random entries?** No.
46. **Can direction-shuffle tests run?** No.
47. **Can feature ablation run?** Only manual named filter variants; no canonical controlled ablation framework.
48. **Are features modular enough?** Partially. Some filters are separable, but many detector conditions and geometry rules are hardcoded or dependent.
49. **Can discovery and cold-instrument validation be separated?** Data mappings permit multiple instruments, but no governance freezes an untouched cold instrument.
50. **Can experiment instruments be frozen before testing?** Not with immutable experiment-family state.
51. **Can era-split stability be analyzed?** Partially through chronological/rolling windows; canonical era metrics and decay reporting are absent.
52. **Do CFDs require special event treatment?** Yes: broker holidays, early closes, maintenance, abnormal spread periods, and news shocks. Futures roll logic must not be assumed.
53. **How conservative is execution modeling?** Same-bar exits are generally stop-first, but entries and costs are not sufficiently realistic.
54. **Does passive touch count as fill?** Yes in the generic touch-entry path; other paths may assume the entry is active immediately.
55. **How are ambiguous bars handled?** Generally conservative stop/invalidation-first, without first-class ambiguity identity or lower-timeframe reconstruction.
56. **Can costs be stress-tested?** Partially through fixed-R/tick scenarios; not through accepted broker-normalized cost policies.
57. **Can a holdout be sealed and consumed once?** No.
58. **Can retuning after holdout be prevented?** Frozen profiles discourage mutation, but no one-way holdout state prevents a new selection after results are viewed.
59. **Can survivor distributions be reported?** Not completely. Optimizers compact to top candidates and no full funnel distribution contract exists.
60. **Does UI encourage cherry-picking?** Yes, because recommendation/top-candidate surfaces dominate while omitted/rejected population distributions are not first-class.
61. **Are trades/year and profitable day/week/month metrics available?** Not canonically; most are unavailable.
62. **Can neighborhood robustness be measured?** No canonical local sensitivity engine exists.
63. **Is configuration complexity tracked?** No; active filters, tuned dimensions, and sensitivity are not a canonical complexity score.
64. **What additional architecture is needed?** Parameter schemas/feature DAGs, immutable experiment families/configuration IDs, durable search jobs/trial ledgers, statistical correction and null services, ablation/neighborhood analysis, cold-instrument and one-use holdout state machines, and full survivor-distribution reporting.

Detailed evidence and parameter tables are in `bt0-parameter-search-and-anti-overfitting-addendum.md`.

## Existing Performance Claims

These are preserved as documented claims, not re-certified results:

| Profile | Existing claim | BT0 trust classification |
|---|---|---|
| IFVG v1 | 599 candidates; 59.43% target-first; 8.7081 average RR | `NOT_TRUSTWORTHY` (incomplete source/cost identity) |
| IFVG v2 causal | Recent 16 candidates at 68.75%; prior 6 at 33.33% | `INSUFFICIENT_DATA` and incomplete lineage |
| IFVG v3 | 172 completed over 180d; 55.23% target-first; 2.805 average R; PF 5.979; DD 8.966R | `NOT_TRUSTWORTHY` for reproducible profitability; positive-canary claim retained |
| Silver Bullet | 152 candidates; 10.53% target-first; degraded OOS | `NOT_TRUSTWORTHY`; already rejected |
| Turtle Soup | 0 candidates | `INSUFFICIENT_DATA` |
| CISD | 109 candidates; 25.69% target-first; degraded OOS | `NOT_TRUSTWORTHY`; already rejected |
| CMD London long | Pooled 124 trades; -0.0289R; PF 0.9558 after causal correction | `NOT_TRUSTWORTHY` for exact reproduction; negative-control conclusion retained |

No BT0 command ran a historical profitability experiment. Deterministic fixtures validate software behavior, not market edge.

## Validation And Execution Record

All commands ran sequentially in the isolated BT0 worktree. Runtime is wall-clock observed by the audit harness. Peak memory was not sampled because profiling tooling and concurrent load were excluded by the preflight. Test datasets are synthetic/static fixtures unless noted; there is no live date range or profitability result.

| Command | Dataset / strategy / date range | Runtime | Result / warnings |
|---|---|---:|---|
| `npm.cmd ci --ignore-scripts --no-audit --no-fund` | Lockfile dependencies | 39.1s | Passed; 275 packages |
| `npm.cmd run typecheck` | Source tree | 22.7s | Passed |
| `npm.cmd run build` | Production source bundle | 65.9s | Passed; existing circular-chunk and >500 kB Vite warnings |
| `npm.cmd run test:strategy-baselines` | Manifest and strategy fixtures, no market dates | 22.1s | Passed, including IFVG, Silver Bullet, Turtle Soup, CISD, Phase 2, recognition |
| `npm.cmd run test:source-integrity` | Source/time/context fixtures | 26.8s | Passed |
| `npm.cmd run test:provenance` | Source status and validation-chain fixtures | 3.2s | Passed |
| `npm.cmd run test:safety` | Authority/read-only/calibration fixtures | 4.6s | Passed |
| `npm.cmd run test:mt5-readonly-safety` | Static read-only policy; upstream deliberately not running | 1.2s | Passed; endpoint checks reported `not_running`, no live probe |
| `npm.cmd run test:b1-contract-fixtures` | B1 planning contract fixtures | 1.0s | Passed |
| `npm.cmd run test:ict-replay-validation` | Synthetic ICT candle fixtures | 1.8s | Failed before assertions: temporary ESM fixture omitted `currentOpportunity` dependency |
| `npm.cmd run test:ict-real-replay-runner` | Synthetic/stubbed replay runner | 1.9s | Same test-harness dependency-closure failure |
| `npm.cmd run test:ict-monte-carlo` | Synthetic approved outcomes | 1.2s | Passed |
| `npm.cmd run test:walk-forward-preflight` | Synthetic readiness/depth fixtures | 1.2s | Passed |
| `npm.cmd run test:detector-profile-walk-forward` | Synthetic 60-trade holdout and 21-trade v4 fixtures | 1.5s | Passed |
| `git diff --check` | Audit documents | <1s | Passed |

The two ICT failures are audit findings. The request prohibits production changes to make audit tests pass, so BT0 records and defers the test-harness repair. Safe commands not run include browser tests, live MT5 bridge/upstream/depth/disconnect tests, live historical performance/OOS scripts, deep history, and memory/load profiling.

Historical probes run: none. Historical probes deferred: provider retention, 5,000-row boundary paging, DST/offset regimes, broker symbol specifications, spread coverage, two-year completeness/checksum, and live performance benchmarks.

## Conclusion

The system is sufficiently characterized to proceed to architecture. It is not sufficiently normalized or identified to call any strategy fully two-year backtestable. The next step is BT1 under change control; production adoption, B1.4 activation, and all trading authority remain disabled.
