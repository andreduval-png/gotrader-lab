# P4 Evidence Qualification: Preflight

Status: CAPACITY_BLOCKED / NOT_QUALIFIED. P3 acceptance remains partial.
This is preparatory qualification work, not acceptance of P3 or owner evidence.

## Implemented

- Removed unmeasured safe-worker assertions from the capacity helper.
- Added a conservative preflight policy: 4 GiB free memory and 4 GiB free disk
  are required for probe eligibility, with at most one probe worker.
- These limits are operational admission limits, not measured workload needs.
- Eligibility never grants full-dataset authorization or qualified workers.
- The file-based pilot checks preflight before compilation or partition work.

## Observation

At 2026-09-18T19:08:52.085Z:

- Free memory: 3,376,967,680 bytes.
- Free disk at worktree: 17,360,564,224 bytes.
- Outcome: INSUFFICIENT_FREE_MEMORY_FOR_PROBE.
- Node v24.15.0, Windows, approximately 16 GiB installed RAM.
- Certificate/manifest metadata verified. No partition or certified fold run.

## Verification

Capacity tests cover missing/nonfinite/negative measurements, threshold
boundaries, and the distinction between eligibility and qualification.
No source data or secrets are included in this report.

## Remaining

Provide sufficient headroom or a qualified isolated host; remeasure immediately
before a supervised bounded probe. Add parent-enforced memory/time limits and
exclusive ownership before treating the probe as capacity qualification.
Measure throughput, peak memory, and output size using the repaired immutable
package. Do not infer full-run duration from free-memory snapshots.

Operator-side trusted result ingestion, outstanding P3 acceptance, and actual
owner evidence qualification remain open. No broker authority, primary adoption,
commit, or push is authorized by this preflight.

## Supervisor Implementation

Added a separate-process supervisor and explicit supervised-pilot command.
The command rechecks preflight, uses one shared exclusive lock, preserves stdout,
stderr and a terminal report in a unique output directory, and enforces a
120-second deadline and sampled 768 MiB RSS ceiling (512 MiB V8 heap limit).
It does not automatically resume or remove existing locks.

Lock release requires confirmed worker exit and matching ownership token.
Unavailable RSS fails closed; successful completion without an RSS sample is
UNMEASURED, not qualified. Completion still requires independent review and
never authorizes a full-dataset run.

Synthetic subprocess tests passed for normal/nonzero exit, synchronous infinite
loop timeout, RSS breach, missing telemetry, concurrent exclusion, and preserved
stale locks. Windows RSS sampling was separately smoke-tested successfully.
The actual dataset pilot command was not executed.

Limits: sampled RSS is not an OS-enforced allocation ceiling; transient peaks may
be missed. Abrupt supervisor/host death leaves a lock requiring diagnosis.
This supervisor targets a single Node worker, not arbitrary process trees.
Disk/output limits, immutable-package identity, and independent acceptance are
still required before qualification. The earlier capacity block remains the last
measured host disposition.

## Disk And Package Guards

The supervised command now requires a clean Git checkout (including untracked
files), records HEAD/tree, package-lock SHA-256 and Node executable SHA-256, and
rechecks identity after execution. A changed/dirty package fails qualification
while preserving the terminal report. The current development worktree is dirty,
so it is intentionally ineligible; no project commit was made.

Independent disk polling enforces a sampled 128 MiB output budget and 2 GiB free
disk reserve. Final output is checked after worker exit. Output symlinks and
unavailable telemetry fail closed; recursive inspection has an entry bound.

Tests passed for disk boundaries, output exhaustion during a supervised worker,
unavailable disk telemetry, and clean/dirty package states. Package tests create
and remove an isolated temporary Git fixture, not a commit in GoTrader.

Residual limits: these are sampled guards, not filesystem quotas. Output
accounting covers the probe directory, not shared compiler caches. Pre/post Git
identity does not provide a read-only filesystem or verify installed dependency
bytes; a sealed execution package with verified dependencies is still needed for
qualification. No certified probe, primary adoption or push occurred.

## Authorized Implementation Checkpoint

User authorized review and commit of the isolated implementation checkpoint,
without push or primary changes. Selected 20 regression scripts passed on
2026-09-18: gateway, operator console, I4/I5 context, Charter, DH1/DH2/DH4,
research coverage, RC1B/RC1C, London parity, multi-strategy validation, owner
policy, P3 scoring/checksums/admission, and P4 capacity/supervisor/package/disk.
TypeScript and production build passed with existing chunk warnings.

Review follow-ups: compiled runtime is now inside each probe output directory,
so disk accounting includes it; cleanup validates containment under .gotrader.
Package identity also checks installed TypeScript version against the lockfile
and records compiler bytes. This is not a complete dependency supply-chain audit.
Primary HEAD and tracked-diff SHA-256 remain unchanged.

This commit records implementation, not production or owner-evidence acceptance.
The next authorized action is one bounded supervised pilot if fresh gates pass.
