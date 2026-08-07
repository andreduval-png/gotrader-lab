# GoTrader Architecture Roadmap

Status: frozen implementation roadmap

Governing index:
`docs/gotrader-runtime/architecture-index.md`

## 1. Current Position

GoTrader has an implemented read-only runtime foundation, a deterministic
canonical market-context engine, an IFVG shadow-canary path, and accepted
read-only GBrain research-memory integration.

The A3.2 operational gate, Runtime Freeze, and Baseline Review are complete:

```text
A3.2 ACCEPTED WITH LIMITATIONS

RUNTIME FROZEN

BASELINE ACCEPTED

B1.0 CONTRACTS AND IDENTITY ACCEPTED

B1.1 LOCAL ENGINE AND REPOSITORY ACCEPTED

B1.2 LIVE CONTEXT-LINEAGE CANARY IMPLEMENTED

B1.2 OPERATIONAL ACCEPTANCE PENDING

BT1 DATASET FOUNDATION COMPLETE WITH HISTORICAL TIME LIMITATIONS

BT2 BLOCKED
```

The exact runtime baseline is frozen at
`e605c10ed6681512da89fa2a4b29791b03a67168`. The preserved observer artifact
remains `observation_incomplete`; one distributed break-transition sample is
accepted under change record `A3.2-ACCEPTANCE-2026-08-03`. B1.0 is accepted at
`25b2c1acab0bbf76e9d65860995b51d12431b1d4`, and B1.1 is accepted at
`92da83b7b550eac31d3114acffc4e8748d880cfe`. B1.2 is implemented at
`820a6278fcdadf061c354c4e30c89af034d20780` with its authorization record at
`89ba4b276fdfdc5dd5396959636fb0e86bdba436`. Its four-hour live operational
observation remains pending; no later milestone is authorized.

The independent BT1 historical dataset foundation is complete at
`3f6b3d87ff4d23b17908c5fa01fd95d7092e60aa`, with accepted reports at
`9ea4a4356cb3c8c1b7e8a069c7ba8df87135106f`. Actual MT5 broker-historical
time/DST and a two-year dataset remain unverified, so BT2 is blocked.

## 2. Milestone Namespace Rules

Milestone labels are immutable identifiers.

- `A1-A3.2` govern always-on runtime infrastructure.
- `Phase 0-3F` govern compatibility-first V2 migration and shadow canaries.
- `G1-G3` govern GBrain research-memory integration.
- `B1.0-B1.6` govern future canonical autonomous research implementation.
- `B1-L1` is a lineage planning subtrack, not a replacement for `B1.2`.
- `BT0-BT2` govern the separate canonical historical backtesting track.
- `B2-B4` are reserved names only.

A new document may refine a milestone but may not silently reuse its number for
a different responsibility.

## 3. Completed Foundation

```mermaid
flowchart LR
  P0["Phase 0/0.5<br/>baseline and isolation"]
  P1["Phase 1/1.5-1.7A<br/>candle and time contracts"]
  P2["Phase 2A<br/>canonical context"]
  P3["Phase 3A-3F<br/>IFVG shadow canary"]
  A1["A1<br/>runtime foundation"]
  A2["A2<br/>continuous feed"]
  A31["A3.1<br/>partial acceptance"]
  A32["A3.2<br/>accepted with limitations"]
  RF["Runtime Freeze<br/>complete"]
  BR["Baseline Review<br/>accepted"]
  B10["B1.0<br/>accepted"]
  B11["B1.1<br/>accepted"]
  B12["B1.2<br/>implemented, ops pending"]
  BT1["BT1<br/>dataset foundation complete<br/>time limitations"]
  P0 --> P1 --> P2 --> P3
  A1 --> A2 --> A31 --> A32 --> RF --> BR --> B10 --> B11 --> B12
  P1 --> BT1
```

These tracks established compatibility and operational evidence. They did not
grant production, evidence, readiness, broker, or execution authority.

## 4. Implementation Milestone Map

| Milestone | Prerequisite | Governing specification | Implementation | Gate |
| --- | --- | --- | --- | --- |
| A1 | V2 baseline | A1 runtime design | complete | accepted with limitations |
| A2 | A1 | A2 continuous feed and scheduler designs | complete | accepted with limitations |
| A3 | A2, verified-time contracts | A3 verified-time context design | complete | superseded operationally |
| A3.1 | A3 | A3.1 acceptance report | complete | partial acceptance |
| A3.2 | A3.1 | A3.2 operational report and operator decision | complete | accepted with limitations |
| Runtime Freeze | A3.2 accepted | freeze manifest and baseline record | complete | accepted |
| Baseline Review | Runtime Freeze | baseline review and change control | complete | accepted |
| B1.0 | Baseline Review | B1 plan, fixtures, pipeline, authority matrix, authorization record | complete | accepted |
| B1.1 | B1.0 | B1 local engine/repository design and authorization record | complete | accepted |
| B1.2 | B1.1 | B1 live shadow context-lineage canary and authorization record | complete | blocked pending four-hour operational observation |
| B1.3 | B1.2 | IFVG v3 canonical research adapter | not_started | blocked |
| B1.4 | B1.3, historical time authority | historical job design | not_started | blocked |
| B1.5 | B1.4 | compatibility projection design | not_started | blocked |
| B1.6 | B1.5, GBrain baseline review | memory projection design | not_started | blocked |
| BT0 | Architecture audit | forensic audit and architecture recommendation | complete | passed with documented limitations |
| BT1 | BT0, ACC-BT-B1.4 | canonical historical dataset foundation | complete | passed with documented historical time limitations |
| BT2 | BT1 historical time and dataset acceptance | separate simulation architecture | not_started | blocked |
| B2 | New accepted specification | reserved | not_started | unspecified / blocked |
| B3 | New accepted specification | reserved | not_started | unspecified / blocked |
| B4 | New accepted specification | reserved | not_started | unspecified / blocked |
| Future Execution | Separate explicit architecture | none accepted | not_started | unimplemented / blocked |

## 5. Immediate Next Milestone

### 5.1 A3.2 operational acceptance - complete

Completed evidence:

1. 14,400-second operational observation;
2. scheduled market maintenance break coverage;
3. 100% active-market proof uptime;
4. fail-closed maintenance pause and fresh-proof resume;
5. 35 verified M5 closes and 32 completed contexts;
6. zero verification, transport, hydration, restart, duplicate, conflict,
   ledger-gap, or authority failures;
7. integrity-valid observer and operator-decision records.

One observer-transition sample is retained as an explicit limitation. It does
not waive any other acceptance predicate or authority boundary.

### 5.2 Runtime freeze - complete

The exact runtime commit, profile, allowlisted files, evidence, and decision
identities are frozen in the Runtime Freeze records.

### 5.3 Baseline review - complete

The review proved:

- A3.2 evidence matches the frozen runtime;
- Phase 2A and Phase 3 compatibility remains intact;
- GBrain remains derived and read-only;
- no hidden runtime profile grants new authority;
- B1 prerequisites still match the accepted specifications.

### 5.4 B1.0 contracts and identity - complete

The fixture-backed contracts, authority invariants, validators, canonical
identity, lineage identity contracts, and accepted fixture oracle are frozen in
the isolated B1.0 branch. The signed record proves an exact 20-file implementation
diff, zero production consumers, and authority `none / none / none`.

### 5.5 B1.1 local engine and repository - complete

The local deterministic seven-stage engine and compact bounded repository are
accepted in the isolated B1.1 branch. The signed record proves an exact 10-file
implementation diff, recovery and lease safety, zero production consumers, and
authority `none / none / none`.

### 5.6 B1.2 operational observation - next

The live read-only context-lineage canary is implemented and authorized only in
its isolated profile. The next action is one integrity-hashed four-hour
observation spanning the maintenance break. B1.3 remains blocked until every
B1.2 acceptance check passes.

### 5.7 BT1 historical dataset foundation - complete with limitations

BT1 now provides immutable identity, bounded paging, atomic checkpoints,
restart/resume, integrity ledgers, stable checksums, deterministic derived
timeframes, symbol snapshots, explicit time authority, and B1-L1 external
lineage. Fixture validation passed. The broker-history time basis, DST behavior,
and an actual two-year MT5 manifest remain unverified. Operational historical
data qualification may proceed under a new isolated concurrency preflight;
BT2 may not.

## 6. B1 Implementation Sequence

### B1.0 - contracts and identity

Implement accepted fixture-backed contracts, identity derivation, status
enums, and authority invariants. No always-on B1 job processing.

### B1.1 - local engine and repository

Implement a local research-only job engine and compact immutable artifact
repository. Raw candles remain in canonical candle storage and are referenced
by identity rather than copied into research artifacts.

### B1.2 - live shadow context-lineage canary

Consume verified closed-candle events, rebuild canonical context, and persist
shadow lineage/artifacts. It cannot create evidence or readiness. `B1-L1`
supplies the lineage specification for this milestone.

### B1.3 - IFVG v3 canonical research adapter

Run the allowlisted IFVG v3 profile through the canonical B1 path and compare
against frozen legacy behavior. Legacy remains authoritative until explicit
parity acceptance.

### B1.4 - explicit historical jobs

Add resumable historical replay/walk-forward jobs only after historical time
basis and DST authority are verified. Deep history must not be a live-close or
page-load side effect.

### B1.5 - compatibility projections

Project compact B1 results into existing browser-facing validation and research
views through adapters. Do not rewrite the existing domains.

### B1.6 - memory projections

Project accepted compact research artifacts into GBrain as derived memory.
Native deterministic evidence remains authoritative.

## 7. Current Approved And Blocked Work

### Approved now

- documentation and frozen-hash verification;
- fixture validation;
- non-runtime architecture review;
- B1.1 acceptance verification;
- B1.2 operational preflight and four-hour isolated canary observation;
- verification of the B1.2 integrity-hashed final report;
- optional corrected-observer follow-up monitoring that does not alter the
  frozen evidence.
- isolated BT1 broker-history time/DST evidence collection and two-year dataset qualification;
- BT1 manifest, checksum, integrity, storage, and lineage verification.

### Blocked now

- B1.2 production adoption outside its isolated shadow profile;
- B1.3 strategy adapter implementation or authorization;
- GBrain production-baseline merge;
- historical B1 jobs;
- BT2 simulation, strategy migration, parameter search, optimization, statistics, Monte Carlo, risk, or portfolio work;
- B2-B4 design or implementation without new specifications;
- strategy production adoption;
- evidence or readiness promotion;
- broker or execution work.

## 8. Long-Term Governance Sequence

```mermaid
flowchart TD
  A32["A3.2 acceptance"]
  RF["Runtime freeze"]
  BR["Baseline review"]
  B10["B1.0 contracts/identity"]
  B11["B1.1 engine/repository"]
  B12["B1.2 live shadow lineage"]
  B13["B1.3 IFVG adapter"]
  HT["Historical time authority"]
  B14["B1.4 historical jobs"]
  B15["B1.5 compatibility"]
  B16["B1.6 memory"]
  BT1["BT1 dataset foundation<br/>complete with time limitations"]
  BT2["BT2 simulation<br/>blocked"]
  FUT["B2-B4<br/>reserved, new specs required"]
  A32 --> RF --> BR --> B10 --> B11 --> B12 --> B13
  HT --> B14
  BT1 --> HT
  BT1 --> BT2
  B13 --> B14 --> B15 --> B16 --> FUT
```

## 9. Exit Criteria For Planning

Planning is complete only in the narrow sense that the accepted architecture is
indexed and governed. Runtime progression remains conditional.

```text
GOTRADER ARCHITECTURE INDEX FROZEN

Accepted Architecture Indexed

A3.2 Accepted With Limitations

Runtime Frozen

Baseline Review Accepted

B1.0 Contracts And Identity Accepted

B1.1 Local Engine And Repository Accepted

B1.2 Implementation Complete - Operational Acceptance Pending

BT1 Dataset Foundation Complete - Historical Time Limitations Preserved

BT2 Blocked

B1.3 Not Authorized
```
