# Results Source-of-Truth Remediation Authorization

Authorized by the user on 2026-08-16.

## Scope

- Bind every Results workspace section to an explicit source and research identity.
- Mark unmatched, stale, missing, or unsupported evidence unavailable instead of rendering plausible zero values.
- Remove silent frozen-profile substitution and preserve historical evidence only under its exact profile identity.
- Expose compact provenance and identity status in the Results UI.
- Strengthen focused contract tests and the validation manifest.

## Boundaries

- Research-only authority remains `none/none/none`.
- No strategy semantics, frozen profiles, readiness thresholds, broker state, Paper Demo, orders, or execution are changed.
- Raw candles and sensitive runtime payloads remain excluded from Results snapshots.
- The dirty primary worktree and active R1 evidence are not modified.

The simulation-runbook evidence redesign is a separate follow-on slice and is not authorized by this record.
