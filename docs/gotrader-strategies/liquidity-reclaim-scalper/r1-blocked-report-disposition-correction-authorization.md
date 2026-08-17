# R1 blocked-report disposition correction authorization

Authorized: 2026-08-17

## Scope

This correction may separate immutable trial-report integrity acceptance from the
trial's research disposition. An integrity-valid report whose status is
`blocked` must be retained and archived without being rewritten, and must be
recorded as an explicit non-passing research disposition rather than an
infrastructure verification failure.

The correction may add focused verification, restart, archive, and family
accounting tests. After the full regression passes, one explicitly preflighted
operator may resume the preserved `r1-family-v2` checkpoint.

## Retained invariants

- Preserve every existing pilot, family-v1 artifact, family-v2 checkpoint,
  trial report, ledger seal, event, telemetry record, archive, and stderr log.
- Preserve the accepted family, plan, sample, certificate, dataset, source, and
  parameter identities.
- Preserve the 1 GiB RSS and 128 MiB governed-evidence limits.
- Preserve `researchValidated: false`, `productionAdoptionAllowed: false`, and
  authority `none/none/none`.
- Preserve the blocked BT2 outcome exactly; do not reclassify it as passed.
- Do not enable holdout, adaptive search, multiple testing, null, ablation,
  OOS, cold-instrument, Paper Demo, runtime adoption, production, broker
  mutation, trade intent, orders, or execution.

## Acceptance requirements

- Integrity-valid `passed` reports remain passing trial dispositions.
- Integrity-valid `blocked` reports become explicit non-passing research
  dispositions with their report, ledger seal, and evidence archive retained.
- Invalid hashes, identities, authority, safety flags, or unsupported report
  statuses still fail verification.
- Restart processing is idempotent and advances the preserved checkpoint only
  after the terminal event and archive are committed.
- Family reporting accounts separately for passed, blocked/non-passing,
  coalesced, and total terminal dispositions.
