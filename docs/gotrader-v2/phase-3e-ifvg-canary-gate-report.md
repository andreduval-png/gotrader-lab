# GoTrader V2 Phase 3E IFVG Canary Gate Report

## Executive Decision

Phase 3E adds the research-lifecycle and completion gate required before the
IFVG v3 canary can be considered complete. It preserves the frozen IFVG v3
positive canary, preserves IFVG v2 as a negative control, and requires
identity-matched replay/OOS artifacts plus bounded live shadow parity.

The gate is implemented and its deterministic tests pass. Phase 3 is not ready
for completion review because the historical replay/OOS audits do not contain
the source fingerprint needed to prove identity parity, and no accepted live
shadow ledger exists in the current workspace.

```text
Phase 3E implementation: complete
Frozen IFVG v3 positive canary: preserved
Frozen IFVG v2 negative control: preserved
Research-lifecycle parity: insufficient comparison data
Live shadow parity: insufficient comparison data
Phase 3 completion review: blocked
Phase 4 implementation authorization: false
Production adoption: false
Validation-chain evidence: none
Execution authority: none
Broker authority: none
Readiness override authority: none
```

## Frozen Research Behavior

The gate verifies the frozen research summaries exactly. It does not recompute
or reinterpret these metrics.

### IFVG v3 Positive Canary

| Metric | Frozen value |
|---|---:|
| Completed research trades | 172 |
| Target-first rate | 55.23% |
| Average R | 2.805R |
| Profit factor | 5.979 |
| Maximum drawdown | 8.966R |
| Unique trading dates | 95 |
| Positive rolling windows | 11/11 |
| OOS verdict | passed |
| OOS windows | 2/2 |
| OOS trades | 64 |
| OOS unique dates | 34 |
| OOS average R | 3.458R |
| OOS profit factor | 8.081 |
| OOS average after 0.5R additional cost | 2.958R |

The preserved replay drawdown remains above the current conservative research
benchmark. Phase 3E does not hide, lower, or override that blocker.

### IFVG v2 Negative Control

| Metric | Frozen value |
|---|---:|
| Current-window candidates | 16 |
| Current-window target-first rate | 68.75% |
| Current-window unique dates | 15 |
| Independent-window candidates | 6 |
| Independent target-first rate | 33.33% |
| Independent invalidation-first rate | 66.67% |
| OOS verdict | insufficient_data |
| Independent behavior | degraded |
| Promotion allowed | false |

The negative control proves that an attractive current-window result cannot
override weak independent behavior.

## Gate Contract

The completion gate combines four bounded checks:

1. deterministic detection, geometry, and selection parity;
2. exact preservation of the IFVG v3 positive baseline;
3. exact preservation of the IFVG v2 negative control;
4. accepted live shadow parity across at least three distinct closed windows
   and two market dates.

Research-lifecycle parity also requires matching historical source,
strategy-profile, parameter, and cost-model identity. The old audit records
profile, parameter, and cost-model identity, but not the historical source
fingerprint. Phase 3E reports that honestly as
`legacy_audit_missing_source_identity`.

Live closed-window observations are operational canaries. They are not claimed
to be statistically independent research evidence.

## Current Gate Result

```text
status: blocked_insufficient_comparison_data
detection parity: exact_parity
geometry parity: exact_parity
selection parity: exact_parity
research-lifecycle parity: insufficient_comparison_data
live shadow parity: insufficient_comparison_data
```

Current blockers:

- `ifvg_v3_replay_oos_source_identity_missing`
- `ifvg_v2_replay_oos_source_identity_missing`
- `ifvg_v3_live_shadow_ledger_missing`

This is a source-identity and observation-depth blocker, not a claim that the
frozen IFVG v3 metrics regressed.

## Rollback Switch

Set:

```powershell
$env:V2_IFVG_LIVE_SHADOW_MODE = "disabled"
```

The live collector exits before compilation, lock acquisition, network access,
or persistence. Legacy IFVG v3 remains authoritative.

The focused test verifies:

```text
networkRequestsMade: 0
observationPersisted: false
productionAdoptionAllowed: false
authority: none / none / none
```

## Safety And Compatibility

- Legacy IFVG v3 behavior remains authoritative.
- IFVG v2 cannot become promotable.
- No production strategy routing changes.
- No replay result is converted into new evidence.
- No validation-chain entry is created.
- No readiness or Paper-Demo state changes.
- No raw candles, runtime snapshots, credentials, account data, order data,
  position data, secrets, or base64 content are serialized.
- No account, order, position, deal, or broker-mutation API is called.
- Authority remains `none / none / none`.

## Next Recommendation

1. Regenerate IFVG v3 and IFVG v2 replay/OOS artifacts through a V2 diagnostic
   that records the exact historical source fingerprint.
2. Verify the MT5 terminal clock and provider time basis.
3. Collect accepted live shadow observations over at least three distinct
   closed windows and two market dates.
4. Run `review:v2-ifvg-phase3-canary`.
5. If the gate reaches `ready_for_completion_review`, perform a human rollback
   and compatibility review.

Even `ready_for_completion_review` does not authorize production adoption,
Phase 4 implementation, readiness, Paper-Demo progression, or execution.
