# BT3 Stage 5 Turtle Soup Parity Authorization

Date: 2026-08-12

Branch: `codex/gotrader-backtest-bt3-turtle-soup-parity`

Parent Silver Bullet Stage 4 acceptance: `91e27fd25906951f1fd0da43f4c871f9079a8a96`

## Decision

```text
ACC-BT3-TURTLE-SOUP-PARITY-STAGE-5
APPROVED FOR ISOLATED FIXTURE IMPLEMENTATION
```

Stage 5 may freeze compact deterministic Turtle Soup v1 detector fixtures and
translate eligible native detector geometry into the BT2 canonical opportunity
contract. Native long/short geometry and representative no-sweep/no-MSS blocked
paths may be covered.

The profile must remain a diagnostic control. Its audited 90-day result of zero
valid candidates, zero unique dates, and `needs_more_data` remains authoritative.
Synthetic fixture eligibility is contract evidence only and cannot be presented
as historical strategy evidence.

Stage 5 may not change setup-range, sweep, rejection, MSS, retest, news, or RR
gates; run historical simulation/replay; make performance claims; perform
comparison/search/statistics; authorize Paper Demo/readiness; adopt runtime
behavior; mutate broker state; place orders; or execute. CISD and later adapters
remain unauthorized.

## Acceptance Gate

1. Valid and blocked compact fixtures are byte-stable.
2. Native side, entry, stop, target, timing, and blockers match exactly.
3. The profile remains `diagnostic_control` and non-promotable.
4. The audited zero-candidate result is preserved without reinterpretation.
5. New fixture hashes use a separate BT3 manifest; prior hashes remain frozen.
6. Fixture certificate/dataset identities remain synthetic.
7. Raw candles, outcomes, PnL, readiness, and trading authority are absent.
8. Focused Turtle Soup, complete BT3/BT2, time normalization, typecheck, build,
   syntax, and hash validation pass.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
promotionAllowed: false
```

No later strategy adapter is authorized by this decision.

## Completion Record

Stage 5 passed under implementation commit
`ca5d6733b4428b7cb64e0f940b9d382948bc0e15` and report
`sha256:ee7eac7d3f0c2e405695d23fa062b3b9b6dea86b0ec03592058724bb0d492b14`.
No later strategy adapter is authorized by this completion.
