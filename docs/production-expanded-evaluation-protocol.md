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
