# Production P1 - Implementation Progress

Status: PARTIAL. No primary adoption, execution activation, commit or push.

## Baseline

- Isolated path: `C:/Users/andre/OneDrive/Documents/gotrader-production-p1-20260918`.
- Branch: `codex/gotrader-production-p1-20260918`.
- Starting HEAD: `f67cc8e9456aa45fc5706cedc54a609e03f4d463`.
- Primary's nine modified files remain in primary, unchanged by this work. They were not implicitly ported into the isolated baseline.
- Primary tracked binary diff SHA256 observed during work: `c07cc42efd81b93ca7327767dc79003c4595c3b9c674e3bbfc7831aea8eaf42b`.
- Existing node_modules is referenced through a junction for testing; no dependency versions were changed.

## Implemented

1. Cycle persistence retains current-document memory if either storage tier fails to save, rather than reading an older stored value. A later successful save to both tiers restores normal persistence reads.
2. Activation-summary reads retain current memory following a failed write.
3. Plan and candidate projections compare the captured canonical cycle fingerprint when available. Tape updates do not change frozen result identity. Different bound source/cycle/candidate identities still fail closed. This is display identity, not execution-time freshness approval.
4. Removed an unused import of the nonexistent `loadPaperSizingPreviewPolicy` export from the gateway. No replacement legacy policy or broader authority was introduced.

## Regression Evidence

`node scripts/test-operator-storage-fallback.mjs` executes actual production functions with unrelated imports isolated. It failed before fixes with stored cycle A replacing B, and with tape drift returning source_mismatch. It passes after fixes, covering both-store and each-store quota failures, update events, recovery after successful writes, summary fallback, tape drift, and bound identity mismatches.

The geometry projection dependency is stubbed in this focused test. This is not a full production-browser cycle or real fingerprint-generator parity test.

- Existing operator-console tests: passed.
- Activate Market pipeline tests: passed.
- Typecheck: passed before the final identity edit; revalidation performed after it.
- Production build: passed with existing circular-chunk/size warnings before final identity edit. No final browser smoke claim.
- Gateway test: still FAILED. Import now succeeds, but legacy fixtures expect `proposal.sizingPreview.riskBudgetUsd`, absent from the canonical proposal contract.

## Remaining Before P1 Acceptance

- Resolve the canonical proposal/gateway contract with fail-closed behavior and updated behavioral fixtures. Do not merely fake the absent sizing preview.
- Broaden cancellation acceptance to production-browser worker teardown and downstream non-cooperative persistence. The operator, activation HTTP fetches and pipeline boundaries are now covered by executable tests, as detailed below.
- Complete true production-browser identity/storage regressions, including generated fingerprints, reload/cross-tab behavior and freshness presentation.
- Run final build, route smoke and integrated regression on the completed increment.
- Finish the reviewed integration ledger for later worktrees and primary local changes. No later branches have been merged.

Frozen parameters and authority remain unchanged. The primary application does not yet contain these isolated fixes.

## Second Increment - Cycle Deadline and Cancellation

Implemented a cycle guard starting before source activation, with a three-minute progress deadline and a provisional fifteen-minute absolute ceiling. The absolute ceiling is an operational fail-closed bound, not a measured performance SLO or a strategy/evidence change. Real stage/progress changes reset the stall timer; heartbeat updates do not.

Cancellation now reaches activation status/quote/symbol/candle requests, higher-timeframe fetches and the advisor worker. Pipeline boundaries check cancellation before further steps and summary persistence. The operator fences late progress callbacks and races cancellation against stalled awaits. Worker failure in the operator's initial full-context step terminates the pipeline rather than retrying it at subsequent steps.

Tests added and wired into `npm run test:operator-console`:

- Stall and absolute deadlines, pre-aborted work and timer cleanup.
- Production MT5 fetch receives abort.
- Actual operator runner cancels a hung activation and ignores its late completion.
- Pipeline cancellation at initial work, market context and summary-save boundaries prevents summary persistence.

Typecheck, build (existing warnings), source-integrity, operator and activation regressions passed during this increment. These fixture tests do not certify live MT5 operation or guarantee that a non-cooperative downstream database write already in flight can be undone. Runtime snapshot resolution and such writes are fenced at the operator boundary, not transactionally canceled. Full browser-cycle proof remains outstanding.

The gateway contract mismatch remained an acceptance blocker at the end of the second increment. It is addressed in the third increment below; no execution authority was added.

## Third Increment - Canonical Gateway Contract and Browser Regression

The gateway now reads canonical proposal records directly, validates their research-only boundary, identity hash, exact supported profile and canonical checks, and revalidates current runtime evidence before preparing a simulation request. Revalidation neither refreshes the original proposal age nor appends duplicate ledger records.

Sizing requires an explicit `GOTRADER_PAPER_SIMULATION_RISK_USD` configuration (default zero/blocked) and an independently approved, matching simulation risk decision. No legacy sizingPreview is synthesized. Existing readiness, forward evidence, loss limits and kill switches remain. Source fingerprints are treated as opaque canonical identities, not parsed using a legacy layout. Defaults remain disabled; no environment configuration or broker connection was enabled.

The gateway suite now uses a real temporary canonical runtime and proposal ledger. Positive cases create only local test outboxes; negative cases cover legacy status, tampered prices, execution authority, absent/oversized budget, absent/mismatched risk approval and readiness revoked after intake. Repeated preparation remains idempotent. Gateway and account-risk suites pass, as does the canonical MCP suite including its HTTP/stdio lifecycle tests.

`node scripts/test-operator-browser-p1.mjs` passes in isolated Chromium with actual modules and real feed/canonical fingerprint generators. It checks quota failures, frozen cycle identity under changed tape, mismatch rejection, NO_TRADE for missing geometry, disabled execution and persistence across reload. It uses a dedicated local origin and blocks external requests. Agent-browser CLI was unavailable, so the repository's installed Playwright was used. This is a browser module fixture, not a real MT5-to-rendered-card full-cycle proof.

P2 dependency inventory is recorded in `production-p2-integration-ledger.md`. No later branch changes are integrated yet. Remaining P1 acceptance scope: real production UI cycle/worker teardown and cross-tab ownership coverage, broader regression and explicit operational deadline qualification. Do not claim production readiness from the passing fixtures.
