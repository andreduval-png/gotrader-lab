# P3 Historical Evidence Integrity

Status: PARTIAL. Isolated implementation only; no primary adoption, commit, push,
certified dataset execution, broker access, or readiness promotion.

## Completed

- Historical fold identity v2 binds supplied candle content, normalized evaluation
  schedule, and snapshotted narrative inputs in addition to existing policy identity.
- Checkpoint v2 validates its body fingerprint, position, processed prefix, and
  detection timestamps. Legacy checkpoints are not silently adopted.
- Checkpoint callbacks and resumed data are cloned to isolate mutation.
- Scoring sees only candles within the run interval. Run intervals must be valid
  and contained in their declared partition when that partition is supplied.
- Result v2 / runner 2.0.0 computes realized metrics from filled target/stop
  outcomes only. Unfilled attempts and unresolved filled trades do not dilute
  average realized R; no completed trades yields null.

These fingerprints detect accidental changes; they are not authentication or
proof that supplied candles match an external dataset certificate.

## Verification

- Added RC1B regressions for changed schedules and candle contents, checkpoint
  mutation and invalid position, scoring boundaries, and absent resolved averages.
- Reproduced the changed-schedule regression before the implementation.
- Passed: RC1B historical evaluation, RC1C operator research, owner validation
  policy, operator console, TypeScript noEmit, and production build.
- Build retains circular-chunk and large-bundle warnings.
- Tests use synthetic fixtures. They do not certify historical performance.

## Remaining

- Verify wider downstream acceptance of geometry-backed candidate counting.
- Broaden fill-model qualification beyond OHLC synthetic cases; intrabar ordering
  is not observable from OHLC alone.
- Verify content certification at the dataset admission boundary and measure
  full-dataset hashing/checkpoint resource costs on a qualified host.
- Complete certified evidence and wider P3 acceptance before progression.

Authority remains none/none/none; researchValidated remains false.

## Follow-Up: Accounting And Causal Fills

- Candidates now count unique geometry-backed candidate IDs. Diagnostic rows
  without geometry remain in detections/evaluated, not the candidate denominator.
- BT2 scoring v2 requires an observed post-decision touch, even when geometry
  reports ENTRY_TOUCHED_NOT_FILLED. It does not manufacture a historical fill.
- Previously filled positions gapping through a stop lose at the opening price;
  losses can exceed 1R. Ambiguous stop/target bars retain stop-first treatment.
- Expired filled outcomes expose unrealizedR separately and realizedR is zero.
- Invalid indices, horizons, tick sizes and negative/nonfinite costs fail closed.
- Scoring version is included in resume identity, invalidating earlier checkpoints.
- New synthetic scoring tests cover both directions, pre-decision touches,
  ambiguity, expiration and invalid inputs. RC1B covers repeated candidates and
  diagnostic-only rows.

Limitations: pending entries still require an observed price touch (no inferred
gap entry). These tests do not establish broker execution parity or performance.

## Follow-Up: Fold Input Admission

The fold runner now rejects duplicate/unordered candle timestamps, inconsistent
timeframe or symbol within a series, nonfinite/impossible OHLC, negative/nonfinite
volume, and absent primary candles. RC1B exercises these malformed inputs for
each of the five owners and still verifies deterministic fresh/resumed results.

The existing script-level certificate/partition verifier was inspected, not run
against the certified dataset. Fold metadata equality is still not content
certification. Connecting verified partition provenance to fold admission and
measuring resource use remain open P3 acceptance items.

## Follow-Up: Mandatory Partition Checksums

Removed the verifier's checksum bypass: verifyChecksums=false now fails closed
instead of returning verified using checksums copied from the manifest.
All successful partition verification calls now compute streamed content hashes.
Repository search found no production caller explicitly disabling checksums.

The new dataset-verification regression proves rejection before dataset access,
streamed/canonical hash parity, content-change detection, and finalization safety.
No certified dataset was read or evaluated for this change. P3 remains partial;
this closes a verifier bypass, not the executor-to-certified-provenance gap.

## Follow-Up: Pilot Evidence Publication Gate

The operator historical pilot previously emitted HISTORICAL_VALIDATION identities
from caller-supplied candles and matching certificate labels. It now retains
diagnostic progress but returns BLOCKED / CERTIFIED_CONTENT_PROVENANCE_UNAVAILABLE
with no evidence. This is a fail-closed interim gate, not a verified-loader bridge.

RC1C asserts all five synthetic owner pilots remain blocked without evidence.
Separate forged cross-owner evidence still exercises scheduler quarantine.
RC1C, operator-console, and TypeScript/production build passed; existing build
warnings remain. No certified data, broker operations, primary edits, commits,
or pushes were performed.

Next required implementation: a trusted execution-side loader must verify the
certificate and partitions, bind the exact loaded slice to the run, and publish
results through a verified provenance path. Do not restore evidence publication
with a caller-supplied boolean or matching metadata alone. Qualification follows
that integration and host-capacity measurements; P3 is not accepted yet.

## Follow-Up: Trusted File-Based Admission

Implemented scripts/lib/p3-verified-fold-admission.mjs and wired the file-based
BT-G1-3R pilot through it. Each admission freshly verifies the certificate,
manifest, and all partition checksums before loading any requested slice.
The pilot no longer reuses the unverified partition-integrity JSON shortcut.
Partition identity and timeframe are checked again when loading.

Loaded candles are immutable. An in-process WeakMap grants admission only to
objects produced by this loader; serialized receipts and matching metadata
cannot authorize a run. The wrapper replaces caller data with admitted slices.
Each pilot result now has a provenance sidecar binding admission, exact slice
hashes, and persisted result content. These hashes provide integrity, not
cryptographic signatures against a malicious host.

Passed: synthetic admission orchestration tests (including forged/copied tokens,
mutation, verification failure, and persisted-result hashing), dataset checksum
regressions, RC1B historical regression, and pilot syntax check.
The admission test uses VM-module dependency doubles and does not certify the
real dataset. Node reports its expected experimental VM-module warning.

The browser pilot remains blocked: it has no trusted execution-side transport
for this admission. No certified execution was started. Remaining acceptance:
qualified-host resource measurement, real-dataset bounded execution, and
authenticated result ingestion into the operator workflow. P3 remains partial.

## Post-Pilot Narrative Remediation

The first supervised pilot at checkpoint 7f36072 completed operationally, but
ICT 2022/MMBM/MMSM had no historical narrative input. The runner now builds its
default narrative using the live canonical hierarchical builder from the
as-of fact snapshot. Each detection records narrative and a source/as-of/fact-ID
bound identity. Unavailable directional facts remain unavailable, not invented.
MMBM/MMSM adapter 1.1.0 adds required 15m intermediate context.

Historical inputs now exclude forming bars. Certified loading retains explicit
closeTimeUtc; fixed timeframe durations are only the fallback for candles without
that field. Malformed explicit close times fail closed. Resume identity includes
the new closed-bar/narrative policy, preventing old checkpoint reuse.

Regressions cover close boundaries, explicit close times, missing narrative
default construction, future-candle isolation, and deterministic resume.
The prior pilot is preserved and is not evidence for the corrected semantics.
User authorized the isolated follow-up checkpoint and one gated bounded rerun.
RC1B, RC1C, ICT 2022 freeze, checksum/admission regressions and production build
passed; existing build warnings remain. The certified rerun is a separate
operational result and cannot be inferred from these tests.
