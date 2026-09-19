# Full-Session And Multi-Date Capacity Acceptance

Date: 2026-09-19. Scope: bounded, sequential certified research execution only.
Disposition: FULL_SESSION_CAPACITY_VERIFIED and TWO_DATE_CAPACITY_VERIFIED.
This does not admit the full 936-observation protocol or certify profitability,
untouched holdout performance, broker execution, or production readiness.

## Fixed Scope

- Five existing owners, with strategy source, frozen parameters, geometry,
  performance policies and readiness gates unchanged.
- First fixed protocol session: 2026-04-06, 78 five-minute observations per owner.
- Two-date scope: 2026-04-06 and 2026-04-13, 156 observations per owner.
- The two-date run uses one continuous fold, including intervening history and
  the unchanged scoring interval. No date replacements or outcome-driven search.
- Certified USTECH proxy data remains proxy evidence, not CME MNQ market truth.
- Limits remain one worker, 120 seconds per worker, 768 MiB observed RSS,
  128 MiB governed output and 4 GiB free-RAM admission.

## Full Session

Evidence: `.gotrader/bt-g1-3r/isolated-1789781944273-21816` (implementation fd22016).
All 13 six-observation stages completed: 390 owner-observations, no missing
ordinals. Maximum observed RSS: 620,253,184 bytes. Final supervisor output size:
53,876,337 bytes. All stderr files empty; package identities unchanged.

Continuation: `sha256:1810cd759e5a6d7968f48ba9d2e3103de11a1aba3a272affa85a9bf7c1fb8997`.
Pilot: `sha256:cf7270977acfc708e533b5f5d4e55330224ff041f734a283b863320817127fbe`.
Reconciliation: `sha256:5d78afb7061e14b21c90182c885a1a3cd07ad0af1c384f8a9f4dbe05958af14c`.

## Preserved Failures And Remediation

1. `isolated-1789782939980-484`: second-date stage 14 exceeded the internal RSS
   check at 828,727,296 bytes. Supervisor sampling alone had not caught that peak.
   The existing collection hooks were ineffective because Node lacked --expose-gc.
2. `isolated-1789784239964-12296`: exposing collection reduced the stage-14 peak
   to 807,583,744 bytes, still above the ceiling. This remained a failed run.
3. `isolated-1789785392029-4116`: reducing old-space from 512 to 256 MiB kept
   sampled RSS at 363,454,464 bytes but stage 14 hit TIME_LIMIT at 120,468 ms.
   Mixed owner cursors and the killed worker's lock were preserved, not reused.
4. `isolated-1789786756827-27928`: three-observation batches and a shared compiled
   runtime reduced memory and output growth. Stage 19 stopped with
   DISK_TELEMETRY_UNAVAILABLE. The original scanner did not retain its underlying
   error code, so attribution to an individual filesystem error is not proven.
   A reproducible listing-versus-atomic-rename race was fixed with at most three
   complete rescans on ENOENT. Persistent absence and other errors still fail.

No failure was relabeled successful, no uncertain child was automatically
restarted, and no failed-stage cursor or stale lock was removed or adopted.
The heap test initially assumed an incorrect total V8 heap size; it was corrected
to check the actual 256 MiB old-space argument plus a compatible total-heap bound.

## Accepted Two-Date Continuation

Evidence: `.gotrader/bt-g1-3r/isolated-1789788464511-28596`.
Final implementation: 22cb9df. Three observations per worker, 52 stages total.
Stages 1-18 were explicitly reviewed and byte-copied from the last attempt;
stages 19-52 ran under the disk-scan correction. Source and destination have
identical `src` trees, lockfile and Node/compiler identities. The adoption manifest
records the source package, source manifest hash, completed-stage boundary and
every copied artifact hash. The historical runner independently validates each
seed checkpoint's fold identity. The failed stage and live batch-state directory
were excluded. All original evidence remains intact.

All five owners reached cursor 156: 780 owner-observations. Maximum observed RSS
was 542,826,496 bytes (517.7 MiB); slowest worker 80,758 ms. Sum of accepted worker
durations, including adopted stages, was 3,542,089 ms. Final supervisor output
size was 41,613,893 bytes (39.7 MiB). Every stderr file was empty. Owner locks and
the active supervisor lock were released normally. No concurrent workers used.

Manifest: `sha256:dc227fb47d6a50b178bc5c426da9fae6531de2f746404c1392247f62d8b786d0`.
Adoption: `sha256:e95d8d13600daf46aa85faaacb328c14025fee90b0638126fd4810130198b115`.
Continuation: `sha256:497f4816a17e40e45785d9b7decc082fe477c6c9621bcc5b6d7f96bb4ba16c49`.
Pilot: `sha256:c78827dce8652704a33f207397002d06217bbe161da130bd123b35608934dfa8`.
Reconciliation: `sha256:b61cf6691bc9fe2afda407c75421cec72e2635f5dc9b6848839433cf5af62536`.

## Verification And Research Results

Independent verifier checked exact owners and schedule, availability, every
checkpoint cursor/hash, result hashes, state hashes, provenance bindings,
admission identity, safety fields, resource reports and copied adoption bytes.
Recomputed aggregate counts and metrics matched recorded reconciliation.
Compiled runtime files matched their package-bound inventory. First-session
detections, geometry envelopes and outcomes exactly matched the standalone
full-session run despite the longer admitted history and smaller worker batches.

IFVG: seven unique candidates and 149 geometry-complete detections. ICT 2022:
13 candidates, all with missed entry. Other owners: no candidates. All five
owners: zero eligible candidates, fills or completed trades. Average R and win
rate remain null. These results establish mechanics/capacity, not an edge.

Passed tests: p4-qualification-plan, p4-bound-runtime, p4-disk-budget,
p4-probe-supervisor, p4-expanded-protocol, p4-capacity-preflight,
p3-fold-scoring, and RC1B historical evaluation (including reviewed seed resume
equivalence and rejection of a seed against existing dispatcher state).
No application `src` drift versus 87ca7c7. No frontend change or browser test was
needed; the application build was not rerun for these orchestration-only edits.

## Remaining Boundary

The first full session and the two named dates are qualified under this bounded
configuration. Longer calendar-history growth and all 12 protocol dates remain
unqualified; fullEvaluationAllowed stays false. No automatic extrapolation from
two dates to the full 936-observation schedule. All seven production areas are
not complete. Authority remains none/none/none, researchValidated false and
productionAdoptionAllowed false. Primary was not edited, merged or pushed.
No raw candles or generated run directories are committed.
