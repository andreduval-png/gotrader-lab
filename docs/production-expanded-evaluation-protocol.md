# Expanded Diagnostic Evaluation Protocol

Status: DEFINED / NOT EXECUTED / NOT ADMITTED.

Executable definition: `scripts/lib/p4-expanded-evaluation-protocol.mjs`.
Canonical protocol hash:
`sha256:b9d94fb05ef714e54f179b75840bdf418eaf5c011cde3ec42c3d31e545b33c0b`.

## Research Correctness Review

Added mandatory fixture assertions for range-anchor EXTERNAL versus interior
INTERNAL liquidity. Boundary/outside prices without anchor lineage are not
silently reclassified as EXTERNAL. Consumed external liquidity cannot become a
draw; an available equal-level fallback retains EQUAL_HIGH_LOW classification.
Removed the draw test's conditional skip so absent fixture facts fail the test.

Passed canonical facts, ICT 2022 frozen core models, market-maker delivery
sequence, market-maker production-path E2E and owner-validation policy tests.
These verify selected contracts, not an independent statistical acceptance of
all strategy logic. No owner or geometry implementation changed.

## Sampling

Five existing owners, first four Mondays in April, May and June 2026, every
five minutes from 09:30 through 15:55 America/New_York. This produces 936 planned
observations per owner, 4,680 owner observations total. All selected dates are
in daylight saving time; automated tests verify the wall-clock conversion.
May 25 is deliberately not replaced. Holiday/data availability must be recorded
explicitly, not counted as NO_TRADE or silently dropped from the planned schedule.

This is chronological diagnostic research on previously accessed certified proxy
data, not untouched holdout or CME MNQ truth. The selection is fixed before this
expanded execution, not claimed to precede all historical access to the dataset.
Twelve dates are insufficient for several existing owner performance policies;
no evidence floor or policy is relaxed to accommodate this diagnostic sample.

## Execution Admission Still Required

- Bind the clean code/tree, dependencies, dataset certificate/checksums, exact
  owner parameter/geometry/session/performance-policy hashes and this protocol
  hash into an immutable execution manifest before evaluating observations.
- Reuse one supervised worker, six observation checkpoints, 4 GiB preflight,
  120-second child deadline, 768 MiB sampled RSS and 128 MiB output limit.
- A checkpoint batch must not become a new scoring fold boundary. Preserve the
  declared evaluation/scoring horizon and up to 48 future bars for resolution;
  missing future data remains unresolved. No crossing into a protected partition.
- Preserve cross-batch geometry deduplication and reconcile owner candidate/fill/
  outcome counts. Prove batched/resumed results equal an uninterrupted fixture
  before enabling expanded execution. Repeated detections are not independent trades.
- Verify and record missing scheduled timestamps before adapters run. Never use
  the runner's default all-candle schedule when the explicit schedule is absent.
- No automatic date replacement, threshold changes, target changes, selective
  reruns, or termination after a favorable sample. Preserve failures and retries.
- Initial expanded workload capacity and aggregate runtime/storage remain
  unqualified. Do not extrapolate the six-observation pilot into a throughput claim.

Costs remain the pilot's one tick each for spread, slippage and commission,
tick size 0.25, 48-bar resolution and ten-day warmup. These are a declared
diagnostic model, not measured broker costs or a new performance-acceptance policy.

Protocol tests verify deterministic hashing, exact date/window/owner counts,
uniqueness, certificate date bounds, NY times and disabled admission/authority.
No expanded dataset job was started by this checkpoint.

## First-Batch Qualification Follow-Up

Implemented owner policy/content hashing and adapter/parameter/geometry/session
binding into the fold configuration identity. Tests reject altered protocols,
duplicate/missing owners and mismatched strategy versions. Scheduled timestamp
availability is explicit and missing data stops the qualification run.
Actual interruption plus serialized-checkpoint resume matches uninterrupted
fixture results, outcomes and deduplicated envelopes for all five owners.

Initial first-batch probe at commit db07cfa failed with
CANONICAL_GEOMETRY_PARITY_FAILURE. Preserved evidence:
`.gotrader/bt-g1-3r/supervised-1789779379699-18696`.
The runner incorrectly attempted to envelope an invalid rejected geometry.
Fix a65c1a7 preserves that record diagnostically, excludes it from complete
geometry and scoring, and rejects contradictory invalid-but-actionable geometry.
Valid geometry still passes through strict parity checks. Policy identity changed
to prohibit resuming pre-fix checkpoints under the corrected disposition.

Separate retry against a65c1a7 completed:
`.gotrader/bt-g1-3r/supervised-1789779520491-26900`.
54,004 ms; peak RSS 553,021,440 bytes; 54 samples; 3,848,127 output bytes;
zero stderr; package unchanged; exclusive lock removed. All five owners processed
the exact first six April observations. Protocol/manifest, admission, provenance,
result-content/result-identity and checkpoint hashes verified. All cursors are 6.

Pilot report canonical hash:
`sha256:82e5f5c4632e348f06ed6ba070402e68d15d6fabe19b8c9f563a35ce652ab268`.
Supervisor report canonical hash:
`sha256:1ced96b3d29be9bca24cf95fe35b67543cf99a790927c12e9021cde5434d8d3d`.

ICT 2022 retained one ENTRY_MISSED diagnostic candidate; IFVG retained one
unique geometry-backed candidate. All owners had zero eligible candidates,
fills and completed trades. No performance acceptance is claimed.

Passed RC1B including bindings/interruption/rejection tests, protocol tests,
P3 scoring, RC1C orchestration, supervisor/capacity tests and TypeScript/build.
Existing circular-chunk and bundle-size warnings remain.

Qualification applies ONLY to this first six-observation batch. Full execution
remains disabled. A multi-batch dispatcher, immutable manifest across processes,
cross-batch deduplication and aggregate reconciliation still require acceptance
before running all 936 observations per owner. This is not an automatic restart
or full-dataset authorization. Raw data and generated evidence remain uncommitted.

## Multi-Batch Dispatch And Reconciliation

Implemented durable single-worker fold dispatch with atomic fsynced state writes,
exclusive per-job locks, binding/schedule/batch-size hashes, monotonic cursors,
and explicit CHECKPOINTED versus COMPLETED dispositions. Resume supplies the full
unchanged schedule and scoring interval; checkpoint envelopes/outcomes retain
geometry deduplication across boundaries. Crashed-process locks require explicit
diagnosis; they are never automatically removed. This is local checkpoint recovery,
not a distributed lease service or a guarantee against filesystem power loss.

Reconciliation requires every expected owner exactly once and exact scheduled
coverage. It rejects duplicate geometry/outcomes and recalculates all lifecycle
counts, wins/losses, unresolved fills, net/gross R, win rate and average R from
terminal records. Owner identities and common dataset/configuration/cost identities
must match. Cumulative batch snapshots are never added together as separate results.

Fixture tests cover one-batch stop plus disk resume, uninterrupted equivalence,
cross-batch repeated geometry, missing/duplicate owners, forged fill counts and
metrics, altered bindings, state tampering and retained stale locks. Synthetic
actionable geometry also verifies a real simulated fill and conservative same-bar
loss resolve identically across batch boundaries; it is not detector performance.

The first two-batch certified probe was terminated at RSS_LIMIT (815,681,536 bytes)
after 78,826 ms. Evidence remains in
`.gotrader/bt-g1-3r/supervised-1789780133079-24912`; four owners reached cursor 12,
London cursor 6. No automatic resume occurred. Explicit collection of transient
fact graphs at batch boundaries was added without changing the 768 MiB ceiling.

Separate retry against cf00c0c completed in 78,400 ms at peak RSS 748,494,848 bytes,
78 samples, output 4,006,543 bytes and zero stderr. Evidence:
`.gotrader/bt-g1-3r/supervised-1789780258389-17728`.
All five owners completed two six-observation batches: 60 owner-observations.
All checkpoint/state/admission/provenance/result hashes, exact schedule coverage,
package identity and lock removal verified; independent reconciliation matched.

Pilot hash: `sha256:159ddec44eddacfdbf84557faca25081400c94be77b345559dcd65ed1e13e30c`.
Supervisor hash: `sha256:9fb3f033cde5308e32549807e83d282fed31f093c14a50e7a8d01d0028b71af6`.
Reconciliation hash: `sha256:28e36694b7ab8647b266d28406f9dd8bea79f2e94a1006e404d3c0e5d9e938c8`.

There were zero eligible candidates, fills or completed trades. The two-batch
dispatch/dedup/reconciliation workflow is verified; whole-schedule capacity is
NOT qualified. The observed memory margin is narrow. The full 936-point run remains
disabled until process-isolated batch capacity and cross-process continuation
are qualified over longer histories. No performance or production approval follows.

## Two-Process Continuation Qualification

Implementation commit `767bec3` adds a sequential two-worker coordinator. Each
worker re-verifies the clean package, capacity admission and certified dataset;
shared owner checkpoints bind the unchanged package, policies and full schedule.
Worker one stops all five owners at observation 6. Worker two resumes them to 12.
Failures stop the coordinator without automatic restart or stale-lock removal.

Certified evidence: `.gotrader/bt-g1-3r/isolated-1789780871135-18400`.
Both workers completed: 54,399 ms and 55,235 ms, respectively. Supervisor sampled
RSS peaks were 566,784,000 and 563,449,856 bytes. The higher worker-internal peaks
were 606,363,648 and 606,552,064 bytes; both remain below 768 MiB. Total governed
output was 7,781,685 bytes. Both stderr files were empty, packages unchanged,
and supervisor/owner locks released normally.

Independent verification checked state/checkpoint/result/provenance hashes,
shared admission and policy identities, cursors 6 then 12, and exact terminal
coverage. Every complete result object equals the earlier same-process two-batch
result. Recomputed aggregate reconciliation equals the recorded reconciliation.
All five owners still have zero eligible candidates, fills and completed trades;
unavailable average R and win rate remain null, not performance passes.

Continuation report: `sha256:97a16571d272210ebd3cef3c76429610477c40bae7e85ed6dc683b9b754b09a3`.
Stage-two pilot: `sha256:5cbb6cddc552a4c884656c1d34ad56544948fc26e6e8b3dab6cd60135e146c9f`.
Reconciliation: `sha256:28e36694b7ab8647b266d28406f9dd8bea79f2e94a1006e404d3c0e5d9e938c8`.

Cross-process continuation is qualified only for this 12-observation-per-owner
slice. Longer-history resource growth and full 936-observation capacity remain
PARTIAL; fullEvaluationAllowed remains false. Authority is none/none/none,
researchValidated false, and productionAdoptionAllowed false. No raw candles
are included in this committed evidence record.

## Four-Process Capacity Extension

Implementation `ca0b2b6` admits an explicit 24-observation qualification only;
the existing 12-observation option remains available. The full schedule gate,
six-observation batches, scoring interval, owner parameters and resource limits
are unchanged. Evidence: `.gotrader/bt-g1-3r/isolated-1789781441233-17948`.

Four sequential workers completed in 54,930 / 56,275 / 55,315 / 55,447 ms.
Maximum supervisor-sampled RSS was 567,975,936 bytes; maximum worker-internal
RSS was 611,020,800 bytes (approximately 583 MiB). Output reached 15,734,515
bytes, below 128 MiB. All packages remained unchanged and stderr files empty.

Independent verification confirmed all five owners at cursors 6, 12, 18, 24;
checkpoint/state/result/provenance hashes; identical admission, policy and
schedule across workers; released locks; and independently recomputed aggregate
counts/metrics. Exactly 120 owner-observations were covered. IFVG yielded three
unique candidates and 18 geometry-complete detections; ICT 2022 yielded one
candidate and one missed entry. No owner produced an eligible candidate, fill,
or completed trade. Average R and win rate remain unavailable.

Continuation hash: `sha256:cb6dfcb52f484d66cde82308287c3b882b428d727bfe27208c5708974b69f17e`.
Final pilot hash: `sha256:dc38dd69adea400e7b6d5a9e5a628a2e5ca47fc7c7141d956a53a2df293b0f06`.
Reconciliation hash: `sha256:e708143daa4faee25705388b064563e1c0339ddb6ffc43c23a971f3512868bf8`.

RC1B historical evaluation regression and runner syntax check passed. This is a
same-day capacity extension, not longer calendar-history or full-schedule
qualification. FullEvaluationAllowed remains false. Whole-session and multi-date
resource growth remain PARTIAL; no performance/readiness gate was relaxed.

## Full-Session And Two-Date Closure

The subsequent full-session and two-date capacity tests passed after bounded
worker, shared-runtime, telemetry-race and reviewed-continuation remediation.
See [capacity acceptance](production-full-session-multi-date-capacity-acceptance.md)
for all preserved failures, exact artifact hashes and scope boundaries.
Accepted two-date coverage is 780 owner-observations, peak observed RSS 517.7 MiB,
slowest worker 80.758 seconds, and 39.7 MiB output. Three-observation operational
microbatches preserve the original fold and schedule; the protocol's research
definition/hash and scoring rules are unchanged. Full 936-observation admission
and performance/production approval remain closed.
