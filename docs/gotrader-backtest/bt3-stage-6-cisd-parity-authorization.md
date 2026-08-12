# BT3 Stage 6 CISD Parity Authorization

Date: 2026-08-12

Branch: `codex/gotrader-backtest-bt3-cisd-parity`

Parent Turtle Soup Stage 5 acceptance: `44ae07bbe3b787959927770aa61d465b538bd952`

## Decision

```text
ACC-BT3-CISD-PARITY-STAGE-6
APPROVED FOR ISOLATED FIXTURE IMPLEMENTATION
```

Stage 6 may freeze compact deterministic CISD v1 fixtures and translate
eligible native detector geometry into the BT2 canonical opportunity contract.
Native long/short geometry and representative weak-CISD/no-retest blocked paths
may be covered.

CISD v1 must remain a rejected negative control. Its audited 109 candidates,
72.48% invalidation-first rate, degraded OOS verdict, and rejected robustness
classification remain authoritative. Synthetic fixtures are contract evidence,
not historical strategy evidence.

Stage 6 may not alter detector gates, run historical simulation/replay, make
performance claims, perform search/statistics, authorize Paper Demo/readiness,
adopt runtime behavior, mutate broker state, place orders, or execute. Session
raid and later adapters remain unauthorized.

## Acceptance Gate

1. Valid and blocked compact fixtures are byte-stable.
2. Native side, entry, stop, target, timeframe close, and blockers match.
3. CISD remains `negative_control` and non-promotable.
4. Audited candidate/outcome/OOS identities remain unchanged.
5. New hashes use a separate BT3 manifest; prior hashes remain frozen.
6. Fixture certificate/dataset identities remain synthetic.
7. Raw candles, outcomes, PnL, readiness, and trading authority are absent.
8. Focused CISD, complete BT3/BT2, typecheck, build, syntax, and hash checks pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
promotionAllowed: false
```

No later strategy adapter is authorized by this decision.

## Completion Record

Stage 6 passed under implementation commit
`0a3ff40ebe2b27707708c7de1eb3c2ba1fd13fdb` and report
`sha256:56956f1d91a28a379595727b86371d821a08ce6b76bd285007667c641109a539`.
No later strategy adapter is authorized by this completion.
