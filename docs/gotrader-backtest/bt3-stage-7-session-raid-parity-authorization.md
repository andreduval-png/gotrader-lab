# BT3 Stage 7 Session Raid Parity Authorization

Date: 2026-08-12

Branch: `codex/gotrader-backtest-bt3-session-raid-parity`

Parent CISD Stage 6 acceptance: `8f687c9cf96d87852409ed86380b2eaae14ee6e8`

## Decision

```text
ACC-BT3-SESSION-RAID-PARITY-STAGE-7
APPROVED FOR ISOLATED FIXTURE IMPLEMENTATION
```

Stage 7 may freeze compact deterministic fixtures for
`nasdaq_london_raid_ny_reversal_v1` and the filtered research wrapper
`nasdaq_london_raid_ny_reversal_v2_filtered_research`.

The v1 adapter may translate native complete-candidate short geometry into the
BT2 canonical opportunity contract. Representative no-raid and no-MSS paths
must remain blocked and emit no opportunity. V1 remains strict research: its
audited 12 candidates, 3 target-first outcomes, 9 invalidation-first outcomes,
25% target-first rate, and blocked walk-forward verdict remain authoritative.

The v2 wrapper owns filtering telemetry but does not expose independent trade
geometry. Its fixture may preserve status, failed filters, thresholds, and
outcome only. The adapter must not borrow v1 entry, stop, target, or timing to
create a v2 opportunity. V2 remains insufficient-sample research with one
retained candidate on one unique date.

Stage 7 may not contact MT5, run historical simulation or replay, alter detector
thresholds, perform search/statistics, make new performance claims, authorize
Paper Demo/readiness, adopt runtime behavior, mutate broker state, place orders,
or execute. Phase 2 and BT3A remain unauthorized.

## Acceptance Gate

1. V1 and v2 compact fixtures are deterministic and byte-stable.
2. Eligible v1 native geometry, source-close timing, and blockers match exactly.
3. Blocked v1 fixtures and every v2 fixture emit no canonical opportunity.
4. V1 and v2 audited evidence identities remain unchanged and non-promotable.
5. New hashes use a separate Stage 7 manifest; prior snapshots remain frozen.
6. Fixture certificate and dataset identities remain synthetic.
7. Raw candles, account data, outcomes beyond frozen telemetry, PnL, readiness,
   and trading authority are absent.
8. Focused Session Raid, complete BT3/BT2, time, typecheck, build, syntax, hash,
   and diff validation pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
promotionAllowed: false
```

No later strategy adapter is authorized by this decision.

## Completion Record

Stage 7 passed under implementation commit
`5b3553642cebf3af00d1b69fd2cda1394d131a67` and report
`sha256:31806046e7195833634e68fc9a04cc983f2d2ed25617897e37b4f38238905954`.
Phase 2 remains separately gated and unauthorized.
