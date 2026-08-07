# BT1 Dataset Foundation Report

Date: 2026-08-07

Branch: `codex/gotrader-backtest-bt1-dataset-foundation`

Architecture authorization: `ACC-BT-B1.4 APPROVED`

Implementation commits:

- `8732594` canonical historical dataset repository;
- `d310aa0` dataset identity and manifest verification;
- `3f6b3d8` historical time and restart verification;
- `feac184` BT1-owned authority/time contracts and V2 compatibility verification.

## Final Status

```text
BT1 PASSED
WITH DOCUMENTED HISTORICAL TIME LIMITATIONS

BT2 REMAINS BLOCKED
```

BT1 establishes the deterministic historical dataset subsystem. It does not
claim that broker-historical time or DST is verified for MT5. No two-year live
download was run because the approved concurrency preflight prohibited MT5 and
deep-history operations during this implementation.

## Delivered Foundation

The new library-only subsystem in `src/lib/historicalData` provides:

- bounded, resumable provider paging;
- immutable request, partition, integrity, manifest, and lineage artifacts;
- one deterministic mutable checkpoint per request;
- UTC normalization through a BT1-owned contract with explicit governed V2 parity tests;
- explicit time, DST, symbol, calendar, and alignment snapshots;
- duplicate coalescing and conflicting-duplicate blocking;
- future, partial, invalid OHLC, invalid volume, invalid spread, range, and gap checks;
- verified maintenance/weekend/holiday closure classification;
- stable partition, timeframe, dataset, manifest, and lineage hashes;
- deterministic M1, M5, M15, H1, H4, D1, and W1 construction;
- B1-L1 external-authoritative dataset nodes and parent edges;
- a loopback-only, GET-only MT5 read-only historical adapter;
- an isolated atomic filesystem adapter with no delete capability.

The subsystem persists raw historical OHLC only in its supplied historical
dataset root. It has no runtime, browser, strategy, evidence, readiness,
memory, broker, production, or execution consumer.

## Concurrency Result

The implementation proceeded under:

```text
BT1_SAFE_WITH_RESTRICTIONS
```

It did not touch the dirty primary worktree, B1.2 candidate, B1.2 automation,
MT5 Desktop, runtime ledgers, GBrain, port 4173, or another worktree's data.
All dataset tests used fixture providers and roots below this worktree's
ignored `.gotrader` test directory.

## Deterministic Evidence

`npm.cmd run test:bt1` passed all three suites.

`npm.cmd run test:source-integrity` also passed with zero BT1 production
consumers of the V2 facade. Compatibility is verified in test code rather than
created through a production dependency.

Dataset foundation evidence:

- 15 paged M1 candles normalized from two pages;
- one identical page-overlap candle coalesced;
- deterministic 3 M5 and 1 M15 derived candles;
- exact cross-root dataset ID reproduction;
- exact cross-root dataset checksum reproduction;
- completed request coalesced without a new source fetch;
- changed creation-policy version produced a new request identity;
- B1-L1 external-authoritative lineage node persisted;
- MT5 adapter proved loopback, GET-only, bounded, authority-none behavior with an injected fetch.

Restart evidence:

- interruption injected after immutable partition write and before checkpoint advancement;
- restart action classified as `resumed`;
- only the uncheckpointed page was fetched again;
- the existing partition was accepted only when byte-identical;
- exactly one checkpoint and four final partitions remained;
- 15 canonical source candles remained, with no duplicate from recovery;
- content tampering was detected by envelope, timeframe, count, and dataset checks.

Historical-time evidence:

- `America/New_York` winter 09:30 normalized to 14:30 UTC;
- summer 09:30 normalized to 13:30 UTC;
- nonexistent spring wall-clock time blocked;
- ambiguous fall wall-clock time blocked;
- winter, summer, spring, fall, epoch UTC, explicit UTC, and explicit-offset
  results matched the governed V2 normalization semantics exactly;
- unverified winter, summer, transition, and maintenance evidence kept both verification flags false;
- verified maintenance closure converted a gap to an accepted warning;
- the same gap under an unverified calendar blocked;
- conflicting duplicate candles blocked;
- derived lineage remained identical after parent-candle and partition-ID reordering.

## Required Questions

1. **Can two years now be retrieved deterministically?** The implementation can page and resume a two-year request deterministically within the configured 20,000-page safety bound. The fixture proves the mechanism. An actual two-year MT5 dataset has not yet been retrieved or accepted.
2. **Is historical time trustworthy?** It is trustworthy only when the manifest's historical time authority is verified. The current MT5 broker-history authority is not yet verified.
3. **Is DST trustworthy?** The IANA normalization logic is deterministic and blocks ambiguous/nonexistent times, but MT5 broker-historical DST evidence is still missing.
4. **Can interrupted downloads resume?** Yes. The injected post-partition/pre-checkpoint interruption resumed idempotently with no duplicate candles or checkpoint.
5. **Can datasets be reproduced exactly?** Yes when provider version, source fingerprint, source bytes, request, time policy, symbol specification, calendar, alignment, and normalization version are unchanged.
6. **Are checksums stable?** Yes. Independent roots produced the same request ID, partition identities, timeframe checksums, dataset checksum, and dataset ID.
7. **Can datasets be shared across strategies?** Yes. Dataset identity contains no strategy or parameter identity.
8. **Can multiple strategies reuse one dataset?** Yes. The repository coalesces the same completed request and returns the same immutable manifest without another source fetch.
9. **Can BT2 begin safely?** No. BT2 remains blocked until an actual broker-history time/DST authority is accepted and a two-year dataset passes repository verification. BT2 also requires its own architecture and authorization.

## Authority And Compatibility

Every artifact preserves:

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
canCreateEvidence: false
canApproveReadiness: false
canApplyCalibration: false
canCreateTradeIntent: false
```

No existing strategy hash or runtime behavior changed. B1.2 remains governed by
its own candidate and operational canary. BT1 does not authorize B1.3, B1.4,
BT2, strategy migration, simulation, optimization, statistics, Monte Carlo,
risk, portfolio work, readiness, production, or execution.

## Remaining Gate

The next historical-data action is operational data qualification, not BT2:

1. collect provider-authoritative winter, summer, spring, fall, and maintenance evidence;
2. seal a verified historical time authority and symbol specification;
3. retrieve one isolated two-year dataset without disturbing B1.2;
4. verify its manifest, integrity ledgers, checksums, storage bounds, and lineage;
5. preserve the accepted dataset identity in a separate authorization record.

Until that gate passes, manifests honestly carry
`historicalTimeVerified: false` and `historicalDstVerified: false` for the
unverified MT5 historical source.
