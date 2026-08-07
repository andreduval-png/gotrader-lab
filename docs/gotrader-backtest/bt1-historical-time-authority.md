# BT1 Historical Time Authority

Date: 2026-08-07

Schema: `gotrader-historical-time-authority-bt1-v1`

## Rule

Historical time verification is explicit evidence, never an inference from a
successful download or a parseable timestamp.

Every dataset records:

```text
historicalTimeVerified
historicalDstVerified
timeAuthorityId
providerTimeBasis
dstPolicy
```

An unverified time authority may preserve a blocked dataset for diagnosis, but
that dataset is not accepted for BT2.

## Supported Provider Time Bases

- `utc_iso`: explicit UTC ISO instant;
- `epoch_utc`: Unix seconds or milliseconds representing UTC;
- `iso_with_offset`: ISO instant with an explicit offset;
- `mt5_server_wall_clock`: broker wall clock requiring an IANA timezone or a verified fixed offset;
- `unknown`: always blocked.

Normalized output is always UTC. The policy identity includes discovery
method, DST policy, source timezone or fixed offset, clock-skew limit, and
closure tolerance.

## Required Evidence Checks

Historical time is verified only when winter, summer, and maintenance-boundary
checks are verified. Historical DST is verified only when historical time is
verified and spring/fall transition checks are verified, unless DST is proven
not applicable.

Each check has a stable ID, status, evidence ID where verified, and blockers.
Blocked checks must explain why they are blocked.

## DST Behavior

IANA timezone rules are deterministic for a declared timezone. Fixture tests
proved:

- New York winter 09:30 maps to 14:30 UTC;
- New York summer 09:30 maps to 13:30 UTC;
- a spring-forward nonexistent time blocks;
- a fall-back ambiguous time blocks.

These tests verify the normalization algorithm. They do not prove which time
basis or timezone the broker used for historical MT5 bars.

## Closed And Partial Candles

BT1 accepts only candles with explicit `isClosed: true`. The normalized close
must follow the open, must not exceed the repository reference clock, and must
remain within the requested half-open range. Partial and future bars are
blocking integrity events.

The MT5 adapter requests windows whose final eligible open time closes by the
request end. It does not grant trust to returned bars; the repository still
normalizes and verifies every candle.

## Sessions And Maintenance

Missing bars are accepted as expected closures only when a verified calendar's
closed intervals completely cover the gap. Maintenance, weekend, holiday, and
early-close labels are preserved. An unverified calendar or incompletely
covered gap blocks as unclassified.

Daily and weekly derived bars use an explicit alignment policy. Weekly bars
are Monday-aligned. Derived buckets with missing parent bars are accepted only
when every missing interval is covered by a verified closure.

## Current Limitation

The current implementation did not contact MT5 or run a deep-history download.
Therefore no accepted broker-history package yet proves:

- provider timestamp basis across two years;
- winter and summer offsets;
- both DST transitions;
- maintenance boundaries;
- historical session alignment;
- holiday behavior.

Current classification:

```text
NORMALIZATION ALGORITHM VERIFIED

MT5 BROKER-HISTORICAL TIME NOT VERIFIED

MT5 BROKER-HISTORICAL DST NOT VERIFIED
```

BT2 remains blocked until that evidence is sealed into a time-authority ID and
the resulting two-year manifest verifies without time, calendar, or integrity
blockers.
