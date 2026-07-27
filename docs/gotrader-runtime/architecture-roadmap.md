# GoTrader Architecture Roadmap

Status: frozen implementation roadmap

Governing index:
`docs/gotrader-runtime/architecture-index.md`

## 1. Current Position

GoTrader has an implemented read-only runtime foundation, a deterministic
canonical market-context engine, an IFVG shadow-canary path, and accepted
read-only GBrain research-memory integration.

The immediate gate is not feature development. It is the incomplete A3.2
operational acceptance:

```text
TRACK A3.2 BLOCKED - OPERATIONAL ACCEPTANCE INCOMPLETE
```

The A3.2 runtime produced real M5 close events and complete five-timeframe
contexts, but the prescribed fresh observation has not yet spanned a scheduled
market break. Until that gate passes, B1 implementation and later tracks remain
unauthorized.

## 2. Milestone Namespace Rules

Milestone labels are immutable identifiers.

- `A1-A3.2` govern always-on runtime infrastructure.
- `Phase 0-3F` govern compatibility-first V2 migration and shadow canaries.
- `G1-G3` govern GBrain research-memory integration.
- `B1.0-B1.6` govern future canonical autonomous research implementation.
- `B1-L1` is a lineage planning subtrack, not a replacement for `B1.2`.
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
  A32["A3.2<br/>implemented, acceptance blocked"]
  P0 --> P1 --> P2 --> P3
  A1 --> A2 --> A31 --> A32
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
| A3.2 | A3.1 | A3.2 operational report | complete | blocked pending final observation |
| Runtime Freeze | A3.2 accepted | architecture index and A3.2 evidence | not_started | blocked |
| Baseline Review | Runtime Freeze | architecture index and change control | not_started | blocked |
| B1.0 | Baseline Review | B1 plan, fixtures, pipeline, authority matrix | not_started | blocked |
| B1.1 | B1.0 | B1 local engine/repository design | not_started | blocked |
| B1.2 | B1.1 | B1 live shadow context-lineage canary | not_started | blocked |
| B1.3 | B1.2 | IFVG v3 canonical research adapter | not_started | blocked |
| B1.4 | B1.3, historical time authority | historical job design | not_started | blocked |
| B1.5 | B1.4 | compatibility projection design | not_started | blocked |
| B1.6 | B1.5, GBrain baseline review | memory projection design | not_started | blocked |
| B2 | New accepted specification | reserved | not_started | unspecified / blocked |
| B3 | New accepted specification | reserved | not_started | unspecified / blocked |
| B4 | New accepted specification | reserved | not_started | unspecified / blocked |
| Future Execution | Separate explicit architecture | none accepted | not_started | unimplemented / blocked |

## 5. Immediate Next Milestone

### 5.1 A3.2 operational reacceptance

Required work:

1. run the prescribed clean operational observation;
2. span a scheduled market maintenance break;
3. preserve fresh terminal-time proof behavior;
4. prove safe pause during the break;
5. prove fresh-proof resume after reopening;
6. preserve supervisor, feed, scheduler, and context continuity;
7. retain zero duplicate, conflict, and ledger-gap counts;
8. produce an integrity-hashed final report;
9. update the A3.2 operational report honestly.

Failure does not authorize bypassing the gate. It creates a new diagnosis and
reacceptance cycle.

### 5.2 Runtime freeze

After A3.2 passes:

- record the exact accepted runtime commit;
- verify a clean worktree;
- freeze required configs, contracts, tests, and reports by blob ID;
- run the baseline safety and authority suite;
- update this index through change control.

### 5.3 Baseline review

The review must prove:

- A3.2 evidence matches the frozen runtime;
- Phase 2A and Phase 3 compatibility remains intact;
- GBrain remains derived and read-only;
- no hidden runtime profile grants new authority;
- B1 prerequisites still match the accepted specifications.

Only then may B1.0 be proposed for implementation.

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

- A3.2 operational observation and report correction;
- documentation and frozen-hash verification;
- fixture validation;
- non-runtime architecture review;
- diagnosis of a failed acceptance observation.

### Blocked now

- B1 runtime implementation;
- B1 repository or scheduler services;
- lineage runtime persistence;
- new always-on profiles;
- GBrain production-baseline merge;
- historical B1 jobs;
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
  FUT["B2-B4<br/>reserved, new specs required"]
  A32 --> RF --> BR --> B10 --> B11 --> B12 --> B13
  HT --> B14
  B13 --> B14 --> B15 --> B16 --> FUT
```

## 9. Exit Criteria For Planning

Planning is complete only in the narrow sense that the accepted architecture is
indexed and governed. Runtime progression remains conditional.

```text
GOTRADER ARCHITECTURE INDEX FROZEN

Accepted Architecture Indexed

A3.2 Operational Acceptance Blocked

B1 Runtime Implementation Not Authorized
```
