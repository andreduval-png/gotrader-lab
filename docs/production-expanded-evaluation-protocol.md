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
