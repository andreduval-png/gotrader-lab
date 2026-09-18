# P2 Integration Ledger

Status: first twelve dependency groups integrated and locally verified within the limits below; historical report/package dispositions remain pending. Primary adoption is not authorized by this ledger.

Baseline: `f67cc8e9456aa45fc5706cedc54a609e03f4d463`.
Candidate lineage inspected: `773956ecc2f42637f08a5eaf52c809074f11b451`.
Local P1 changes remain uncommitted in the isolated production-p1 worktree.

| Order | Commit | Scope | Planned disposition |
| --- | --- | --- | --- |
| 1 | 4a2a966 | INT-3C I4/I5 context | Ported source/tests/package script; locally verified context-only behavior; no execution promotion |
| 2 | 067c14a | INT-3D charter attribution | Ported and locally verified owner attribution, frozen geometry preservation and cycle/source binding |
| 3 | b13f64a | DH1 fetch planner | Ported and locally verified; retained P1 guard and propagated cancellation through history chunks |
| 4 | 5a6ae18 | DH2 canonical facts | Ported and locally verified PD production, causal lineage, and explicit transition semantic blocking |
| 5 | 5fc11da | DH4 delivery qualification | Ported and verified same-range/causal sequence; repaired rejected-sequence geometry bypass |
| 6 | 038be65 | Coverage architecture | Ported; owner inventory and fail-closed evidence identity regressions passed |
| 7 | 53b65fd | Historical parity | Ported; synthetic adapter geometry preservation and deterministic resume passed; certified acceptance deferred |
| 8 | 9f94cb2 | London Raid target parity | Ported; nearest-native-objective live/historical fixture parity verified; old policy evidence invalidated |
| 9 | cc73d38 | Five-owner cycle | Integrated with P1 guard preserved; owner cancellation, late-callback, cross-owner evidence and plan-first browser regressions pass |
| 10 | 1f1fbcc | Owner validation readiness | Integrated; cross-owner/version evidence rejected; requirement flags alone cannot qualify readiness |
| 11 | 52285a0 | Owner validation policies | Integrated with inherited technical-pass claims removed; policy/evidence/technical/readiness remain separate |
| 12 | d775fe3 | Performance policy | Integrated owner-specific policy IDs/hashes and deficit reporting; prior fail-closed guards preserved |
| 13 | 697b669 | Capacity-blocked evidence report | Historical documentation only; not acceptance evidence |
| 14 | 1486164 | Blocked execution report | Historical documentation only; not acceptance evidence |
| 15 | 773956e | Portable evidence package | Defer execution until P3 accounting/checkpoint repair |

Known overlap with P1: activation pipeline, operator cycle, console snapshot and operator types/store. Do not replace these files wholesale from the later branch: that can remove the newly tested cancellation, quota and bound-plan fixes.

Primary has nine unrelated local modifications identified by the audit. They are preserved, not implicitly included here. Review performance/import changes separately against this integration sequence.

Before any port: record the selected diff and intended contracts; run frozen strategy and owner tests; rerun P1 behavioral tests after each dependency group. Do not mark a feature accepted solely because its source commit exists.

## Group 1 verification (2026-09-18)

Ported the source, tests and package script from `4a2a966112912bf42945e1372781b46268dcdaa8`, without importing its historical acceptance documents or creating a commit. Preserved P1 overlap edits in activation persistence, console identity and executable operator tests.

Added cycle/source binding for context rows: stale-cycle, mismatched-source and unbound summaries are hidden; live tape drift preserves the bound snapshot. Added executable regression assertions. Contexts cannot create candidates or geometry, and unresolved Unicorn/TGIF semantics remain blocked.

Passed: `test:int-3c-context` (16 scripts), `test:int-3b-runtime`, `test:operator-console`, `test:paper-demo-gateway`, `test-operator-browser-p1.mjs`, and `test-int-3a-2-production-browser.mjs`. The latter exercises production builders and console DOM at desktop/mobile sizes with isolated Vite cache and no configured backend proxy. Local screenshots: `.gotrader/p2-browser/desktop.png` and `mobile.png`. These are controlled fixtures, not a live MT5 cycle or evidence of owner profitability.

TypeScript and production build verification retain existing circular-chunk/large-bundle warnings. IFVG fixture remains 95 / 93.9095 / 98.6 with geometry ID `fnv1a128:51bed382147c310eac6a997059cebd92`; ICT 2022 DOM fixture remains 100.5 / 105 / 89 (2.56R displayed). Authority remains none/none/none.

## Group 2 verification (2026-09-18)

Ported source/tests/package changes from `067c14aa2468b551af5d33171e755b20bc95d91e`, retaining P1 and Group 1 edits. Historical acceptance documentation was not imported as fresh evidence.

Charter attribution preserves existing canonical owner candidates, geometry and actionability. Twelve profile definitions remain classified as owner attribution, framework-only or source-blocked; they add no executable strategies. Added stale-cycle and wrong-source console regressions. Profile rows use cycle-bound identity rather than the changing live tape. Operator inventory is collapsed by default and supports keyboard-native disclosure; responsive wrapping avoids overflowing mobile rows.

Passed: `test:int-3d-charter-profiles`, `test:int-3b-runtime`, `test:int-3c-context`, `test:operator-console`, `test-operator-browser-p1.mjs`, and desktop/mobile `test-int-3a-2-production-browser.mjs`. Browser assertions verify twelve profile rows, source-blocked Model 5, collapsed default state, unchanged frozen candidate prices, conflict NO_TRADE, and no horizontal overflow. TypeScript/build passed with existing circular-chunk and bundle-size warnings. Browser evidence is fixture-driven, not a live cycle or profitability qualification.

## Group 3 verification (2026-09-18)

Ported DH1 source/tests/package changes from `b13f64a3daef3a78bfca8540d57b16727ad59fb5`. Did not import historical acceptance reports. Manually reconciled activation and operator changes with P1: retained the existing stall/absolute-deadline guard rather than the older replacement watchdog.

The live planner unions consumer timeframe requirements into six requests with default concurrency three, separates live and historical-validation tiers, excludes forming/future bars from canonical research facts, and shares timeframe snapshots. Activation defers duplicate HTF hydration to the planner. The cycle start timestamp is passed through the worker and used as the actual range-fetch cutoff. Non-worker packet construction now uses the same context builder.

Added abort propagation through context fetching, queued timeframe work, date-range HTTP and successive history chunks. Aborts are rethrown rather than converted into partial/disconnected results. Tests cover pre-abort, mid-queue abort, underlying range-fetch abort, no subsequent chunks, signal identity and fixed request cutoff. Replaced quadratic duplicate-bar scanning with deterministic set-based deduplication without changing duplicate selection order.

Passed: `test:dh1-data-planner`, `test-ict-multi-timeframe-context.mjs`, `test-ict-activate-market-source-independence.mjs`, `test-ict-current-read-flow.mjs`, `test:operator-console`, `test:int-3b-runtime`, `test:int-3c-context`, `test:int-3d-charter-profiles`, `test-operator-browser-p1.mjs`, desktop/mobile `test-int-3a-2-production-browser.mjs`, and `npm run build` (including TypeScript). Existing circular-chunk/large-bundle warnings remain. These are deterministic/mock-provider and browser-fixture checks, not a measured live MT5 performance claim.

## Group 4 verification (2026-09-18)

Ported source/tests/package changes from `5a6ae18a909b755f9637ecf5c1cfa29ba0b2a3f4`, without importing historical acceptance claims. Canonical snapshots now produce range-relative PD_LOCATION facts with reference-candle/range lineage and classification-policy identity. Diagnostics distinguish missing ranges, unavailable price locations and unresolved transition semantics.

Added symbol/timeframe ownership guards to PD classification. Strengthened the positive fixture to require actual production of a PD fact, its diagnostic count, range binding and candle lineage; a missing fact can no longer silently skip the assertions. Negative tests cover invalid ranges, future references/ranges, cross-instrument/timeframe requests, and out-of-range prices. Fixed-asOf future-extension equality passes. IRL/ERL transition constructors enforce causal endpoint/range timestamps, while the ordinary producer remains SOURCE_OR_SEMANTIC_BLOCKED rather than inventing a transition rule.

Passed: `test-dh2-canonical-fact-completeness.mjs`, `test:dh1-data-planner`, `test-ict-multi-timeframe-context.mjs`, `test:int-3b-runtime`, `test:int-3c-context`, `test:int-3d-charter-profiles`, `test:operator-console`, `test-operator-browser-p1.mjs`, desktop/mobile `test-int-3a-2-production-browser.mjs`, `npm run build` (including TypeScript), and `git diff --check`. Existing circular-chunk/large-bundle warnings remain. Frozen IFVG and ICT 2022 fixture geometry remains unchanged. Verification uses fixtures, not a live trading or profitability acceptance run.

## Group 5 verification (2026-09-18)

Ported source/tests/package changes from `5fc11da5268a0b43a1bc57f19446c59c1490da99`, excluding historical acceptance documents. MMBM/MMSM now use an explicit strategy-owned liquidity/displacement/FVG sequence, with same-range ownership and prerequisite identities preserved through candidate and activation summaries. Generic IRL_ERL_TRANSITION production remains semantically blocked; this integration does not enable it. IFVG and ICT 2022 frozen parameters remain untouched.

Found and reproduced a qualification bypass: replacing PD-location source lineage caused sequence rejection but still emitted actionable geometry. Added a mandatory QUALIFIED check before geometry construction. The new regression failed before the repair and passed after it. Negative coverage checks foreign-source PD location, engineering liquidity and objectives for both bullish and bearish models; each must yield blockers and no geometry.

Passed: `test:dh4-market-maker-delivery` (sequence and candle-to-production-pipeline fixtures), `test:int-3b-runtime`, `test:int-3c-context`, `test:int-3d-charter-profiles`, `test:dh1-data-planner`, `test-dh2-canonical-fact-completeness.mjs`, `test:operator-console`, `test-operator-browser-p1.mjs`, desktop/mobile `test-int-3a-2-production-browser.mjs`, and `npm run build` including TypeScript. Existing circular-chunk/large-bundle warnings remain. Natural synthetic-candle fixtures exercise canonical facts through Activate Market and Charter 6/7 attribution; they do not establish live-market qualification or profitability.

## Groups 6-7 verification (2026-09-18)

Ported source/scripts/package changes from `038be65` and `53b65fd`, excluding historical acceptance documents. Five live-owner coverage contracts remain separate from research-only IFVG v4. Added historical geometry adapters and fold infrastructure without connecting broker execution or changing frozen parameters.

Hardened evidence compatibility: malformed mandatory fields and invalid/non-increasing timestamps return INSUFFICIENT_IDENTITY; unknown tiers cannot fall through to forward-evidence policy. Added negative regressions. The historical SSR test uses an isolated Vite cache because node_modules is shared with primary.

Passed: `test-rc1a-research-coverage.mjs`, `test-rc1b-historical-evaluation.mjs`, `test:operator-console`, `test:dh4-market-maker-delivery`, desktop/mobile `test-int-3a-2-production-browser.mjs`, and `npm run build` (including TypeScript). Existing circular-chunk and large-bundle warnings remain. Primary tracked diff hash and HEAD are unchanged.

Acceptance limits: RC1B uses synthetic candles, certified-identity metadata, and injected detector geometry. It verifies adapter price preservation and deterministic fresh/resumed outputs, NOT actual certified-data execution or complete detector parity. London target-policy parity remains blocked. Fold checkpoint content/schedule binding, outcome partition boundaries, and scoring/accounting require P3 review before certified evidence execution. Identity compatibility does not establish profitable or readiness-qualified evidence.

## Group 8 verification (2026-09-18)

Ported source/scripts/package changes from `9f94cb2`, excluding historical acceptance reports. London v1 selects the nearest declared native liquidity objective independently of required R:R, preserves its canonical geometry through historical adapters and Current Opportunity, and labels below-threshold geometry non-actionable. Policy version is now `2.0.0-nearest-native-objective`; old policy evidence is invalidated rather than reused. Readiness and broker authority are not promoted.

The production-owner synthetic fixture retains its London-low target at 98.1 and 0.4402R despite farther objectives exceeding 2R. Live/historical entry, stop, target, geometry identity, policy and blockers match. Tests cover ordering, consumed primary without fallback, wrong-class/future objectives, repeatability, future-extension causality and downstream no-signal behavior. Added an invalid-asOf regression and fail-closed candle filter; malformed evaluation time no longer admits all candles. Isolated Vite cache preserves the shared primary dependency directory.

Passed: `test:london-raid-v1-target-policy`, `test-session-raid-reversal.mjs`, `test-rc1a-research-coverage.mjs`, `test-rc1b-historical-evaluation.mjs`, `test:operator-console`, `test:int-3b-runtime`, `test-ict-current-read-flow.mjs`, desktop/mobile `test-int-3a-2-production-browser.mjs`, `npm run build` including TypeScript, and `git diff --check`. Frozen IFVG and ICT 2022 regressions remain passing. Existing circular-chunk and bundle-size warnings remain.

MT5-dependent live audit scripts were not executed. Synthetic owner parity is not certified-data performance acceptance. P3 checkpoint/scoring repairs remain prerequisites for certified evidence. Primary tracked diff hash and HEAD remain unchanged; no primary adoption, commit, push or execution authority changes.

## Group 9 verification (2026-09-18)

Ported source/scripts/package changes from `cc73d38`, excluding historical acceptance reports. Manually reconciled operatorCycle and console snapshot with P1/DH1 changes: retained pre-activation stall/absolute deadlines, abort racing, shared-fetch cancellation, quota fallback and cycle-bound context/profile identity. Added five-owner status rows with a separate IFVG v4 research-only lane. Plan publication no longer waits for all research lanes. Completed-with-blockers is amber; removed unnecessary explanatory UI copy and unsupported validation/readiness completion timestamps.

Scheduler hardening beyond the port: cancellation races a pending task and aborts its child signal; a stalled owner aborts its signal and halts later tasks to avoid overlap with an unresponsive executor. Terminal tasks ignore late progress callbacks. Evidence must match the executing task's owner, profile and tier, not merely another valid registry contract. New tests cover mid-run cancellation, single execution after stall, frozen terminal state after late callbacks, and foreign-owner evidence quarantine.

Passed: `test:rc1c-operator-research`, `test:operator-console`, `test-operator-browser-p1.mjs`, `test:int-3d-charter-profiles`, `test:london-raid-v1-target-policy`, desktop/mobile `test:rc1c-production-browser`, desktop/mobile `test-int-3a-2-production-browser.mjs`, TypeScript/build, and `git diff --check`. Browser fixture servers use isolated caches and block backend/external traffic. Existing circular-chunk/large-bundle warnings remain.

Scope remains PARTIAL: the browser has no certified dataset binding/execution backend and therefore reports DATASET_UNAVAILABLE for historical owner checks. The scheduler pilot tests use synthetic candles, not certified evidence. Worker/process termination, durable orchestration, P3 scoring/checkpoint repairs, owner readiness and real-cycle performance acceptance remain pending. No historical validation/readiness acceptance is inferred from a task completion label. Primary tracked diff hash and HEAD unchanged; no commits, pushes or broker execution.

## Groups 10-11 verification (2026-09-18)

Ported source/scripts/package changes from `1f1fbcc` and `52285a0`, excluding historical acceptance reports. Operator validation evaluates five distinct owners without hiding current geometry. Technical evidence, quantitative performance, policy availability and readiness are distinct. IFVG v4 remains research-only/not applicable; the other four owners do not inherit IFVG thresholds.

Corrected unsafe inherited assumptions: the static technical inventory no longer claims checkpoint, causal, dataset-integrity or fill-semantic acceptance from source labels. These remain NOT_EVALUATED pending actual acceptance. Task identity alone does not prove parity or causality. A one-outcome evidence record with PASSED flags cannot yield VALIDATION_PASSED or research readiness. Canceled/running/quarantined upstream tasks are blocked; stale-cycle task records are excluded. Invalid/future evidence timestamps and invalid counts fail closed.

Policy evaluation requires nonempty run/checkpoint identities, ordered timestamps, valid tiers, finite nonnegative sample counts and fills/outcomes consistent with candidates. Only complete OOS evidence may satisfy the current IFVG quantitative policy; forward/readiness-tier records cannot substitute. Capacity/source blocks prevent evaluated OOS claims even with favorable metrics. No readiness or execution gates were lowered. Technical inventory now honestly reports zero fully accepted owners in this integration state.

Passed: `test:owner-validation-policy`, `test:multi-strategy-validation`, `test:operator-console`, `test:rc1c-operator-research`, actual Chromium `test-operator-browser-p1.mjs`, desktop/mobile owner-policy and multi-strategy-validation browser fixtures, TypeScript/build and `git diff --check`. Fixed SSR test dependency-scan shutdown noise with isolated cache/noDiscovery and reran cleanly. Existing build circular-chunk/large-bundle warnings remain.

P2 remains PARTIAL. Quantitative policies for four owners, certified evidence acceptance, P3 checkpoint/scoring repairs and verified technical inventory are pending. No certified dataset execution, broker activity, primary adoption, commit or push occurred. Primary HEAD and tracked diff hash remain unchanged.

## Group 12 verification (2026-09-18)

Integrated performance-policy source changes from `d775fe3` while preserving local safeguards rather than replacing the evaluator blindly. Five policies distinguish frozen IFVG, ICT 2022, independently identified MMBM/MMSM, and London session evidence. Definitions have version/hash, sample/calendar/independence requirements, declared stress rules, and separate forward-evidence requirements. No observed outcomes were used to tune thresholds; historical acceptance reports were not adopted as fresh proof.

Preserved malformed-identity, finite-count, timestamp, evidence-tier and blocked-source checks. Extended numeric validation to optional OOS counts and [0,1] shares. Complete OOS evidence is required before performance can pass; capacity blocks cannot produce evaluated OOS status. Nested forward-evidence definitions are frozen. Technical inventory remains NOT_EVALUATED; legacy requirement flags cannot produce readiness. Policy definition is distinct from evidence acceptance.

Passed: `test:owner-validation-policy` including boundary/hash/owner checks and added malformed metric/tier/source-block regressions, `test:multi-strategy-validation`, `test:operator-console`, desktop/mobile `test:owner-validation-policy-browser`, TypeScript/build and `git diff --check`. Existing circular-chunk/large-bundle warnings remain. Primary HEAD and tracked diff hash are unchanged. Nothing committed or pushed; no broker or certified evidence execution.

Next: P3 evidence-accounting/checkpoint repair before certified accumulation. Groups 13-14 are historical reports only; group 15 execution package remains deferred. Full P2/production acceptance remains PARTIAL, not implied by completing the twelve code integrations.
