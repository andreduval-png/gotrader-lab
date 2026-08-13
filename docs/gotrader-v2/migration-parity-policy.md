# GoTrader V2 Migration Parity Policy

## Outcomes

- **Exact parity**: normalized outputs match byte-for-byte.
- **Acceptable normalized variance**: only approved unstable fields differ and normalization explains the difference.
- **Intentional behavior change**: separately authorized, documented, and compared against the old implementation.
- **Non-inferiority**: candidate identity and safety are preserved while measured research outcomes meet an agreed statistical bound.
- **Regression**: an unapproved difference in recognition, geometry, outcomes, provenance, or authority.
- **Insufficient comparison data**: parity cannot be decided; the profile remains blocked.

## Required comparison dimensions

Every migrated strategy/profile must compare candidate count and timestamps, direction, detection flow state, blockers, supporting conditions, entry, invalidation, target, theoretical RR, later realizable RR where available, replay trade count, target-first rate, average R, profit factor, maximum drawdown, walk-forward/OOS result, source/profile provenance, and authority.

## Profile-scoped hybrid migration

Migration is adapter-first and profile-scoped. Old and new paths run in shadow where feasible. Detection Flow is compared separately from Research Lifecycle. Live confluence cannot substitute for historical evidence. A cleaner architecture is not permission to change strategy behavior.

Positive canaries must not degrade. Negative controls must not become promotable merely because a new path emits a candidate. Placeholders and diagnostics must remain unable to create active plans, evidence, readiness, or authority.

## Decision rule

Any mismatch in source fingerprint, profile version, parameter fingerprint, cost model, or authority prevents an automatic parity claim. Ambiguous results are `insufficient comparison data`, not a pass.
