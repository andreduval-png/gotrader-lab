# BT1.5 Historical Time Authority Decision

Date: 2026-08-07

## Decision

```text
historicalTimeVerified: false
historicalDstVerified: false
timeAuthorityId: NOT_SEALED_FROM_LIVE_EVIDENCE
```

The result is blocked because no actual MT5 historical winter, summer, DST
transition, or maintenance-boundary package has been collected and reviewed.

## Implemented Identity Rules

The BT1.5 time authority is now canonical and binds:

- provider ID and version;
- provider historical timestamp basis;
- source timezone or fixed-offset interpretation;
- timestamp DST policy separately from session/calendar DST policy;
- normalization policy ID, version, and hash;
- evidence-package ID;
- market-calendar ID and version;
- verification version and authority `none / none / none`.

UTC timestamps may classify timestamp DST as `not_applicable`; this does not
verify broker-session or America/New_York DST behavior. Any material evidence,
provider, calendar, or policy change creates a different `timeAuthorityId`.

Fixture validation passed for identity tampering, missing periods, ambiguous
fall wall-clock time, nonexistent spring wall-clock time, and unverified
maintenance evidence. Fixtures do not satisfy the operational gate.
