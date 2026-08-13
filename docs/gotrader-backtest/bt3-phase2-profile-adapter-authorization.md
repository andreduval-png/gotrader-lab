# BT3 Phase 2 Profile Adapter Authorization

Date: 2026-08-13

## Authorized slice

Add canonical BT3 fixture and parity coverage for:

- `ict-bread-and-butter-buy`
- `ict-bread-and-butter-sell`
- `ict-one-shot-one-kill`

The adapter may consume only compact, generated detector output. It must preserve the detector-owned side, entry-zone midpoint, invalidation, target, reward-risk estimate, blockers, and approved-profile status. It may emit a canonical research opportunity only when the detector decision is `research_only`, the side is directional, all geometry is finite and correctly ordered, reward-risk is at least 2.0, the approved-profile status is accepted by the existing detector contract, and no blocker remains.

## Prohibited changes

- No detector, confidence, target-distance, reward-risk, or approved-profile threshold changes.
- No reinterpretation of rejected or `no_trade` signals.
- No Grinch standalone strategy adapter; Grinch remains confluence-only.
- No raw candle serialization or historical qualification claim.
- No automatic startup, scheduling, network contact, MT5 integration, runtime adoption, strategy execution, Paper Demo, broker mutation, readiness override, or execution intent.

Authority remains `none/none/none`, and all simulation capabilities remain disabled.

