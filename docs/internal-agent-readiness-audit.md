# Internal Agent and Readiness Audit

Date: 2026-07-19

## Decision

The next best step is to address the remaining genuine evidence blockers, but the internal-agent audit had to come first. The audit found that unavailable agents could still dilute CIO synthesis and that real-candle mode retained synthetic external context values. Those defects could distort confidence without improving strategy evidence.

This change does not alter IFVG v3/v4 strategy thresholds, readiness thresholds, walk-forward contracts, or Paper-Demo promotion rules.

## Agent Findings

### Correct and retained

- ICT liquidity, structure, Grinch profile, timing, risk/reward, and candle-derived regime agents remain deterministic research agents.
- Agent output remains advisory/research-only.
- All broker, execution, and readiness authorities remain `none`.
- Missing external evidence remains a blocker or confidence limitation; it is not inferred from price.

### Corrected

1. Unavailable agents previously retained weight in CIO synthesis. Macro, intermarket, positioning/gamma, order flow, SMT, session-level, and volume-profile agents could contribute neutral or placeholder-weighted opinions despite missing verified inputs.
2. Real-candle market context previously retained mock VWAP, session levels, CPI/FOMC events, VIX, DXY, yields, gamma, and intermarket values. Real-candle mode now leaves those fields unavailable instead of fabricating them.
3. The regime classifier previously inspected high-impact events without first confirming that the macro module was verified. Planned/mock events can no longer trigger an event regime.
4. CIO confidence previously used all configured agents in its weighting model. CIO now uses only evidence-participating agents and caps confidence by active configured-weight coverage.
5. Backtest weight overrides could have re-enabled abstaining agents. Abstentions now retain zero active weight.
6. Agent audit traces incorrectly stated that deterministic agents used mock facts only. Traces now show verified, derived, limited, or unavailable evidence and an explicit vote/abstain role.
7. The Research Workbench could fabricate a positive outcome from the thesis's own confidence and feed it back into agent scoring. That circular self-scoring path was removed. Replay or observed paper outcomes are now required.

## Evidence Participation Policy

| Agent family | Participation rule |
| --- | --- |
| ICT/Grinch candle-derived agents | Vote when at least 20 candles are available; explicit demo data is limited and weight-reduced |
| Composite/volatility regime | Vote with sufficient derived data; half-weight when limited; abstain when insufficient |
| SMT/intermarket | Abstain until correlated ES/YM evidence is present |
| Session levels | Abstain until reference levels are canonical candle-derived or verified |
| VWAP/volume profile | Abstain until a verified/calculated profile exists |
| Macro | Abstain until a verified calendar, VIX, DXY, and yield source exists |
| Positioning/gamma | Abstain until verified COT, put/call, and gamma inputs exist |
| Order flow | Abstain until verified DOM/footprint/delta inputs exist |

Abstaining agents remain visible for explainability, but receive zero confidence and zero active synthesis weight. They cannot dilute or steer CIO direction.

With the current 23-agent registry and verified canonical candles, the expected baseline is 16 evidence-participating agents and 7 abstentions, representing about 73% configured-weight coverage before any data-quality reductions. The exact count can fall when candle or regime depth is insufficient.

## Remaining Genuine Blockers

### 1. Untouched forward evidence

The active IFVG v4 profile still requires 40 observed forward outcomes across 20 independent dates and 2 windows. Current forward evidence is 0/40 outcomes, 0/20 dates, and 0/2 windows. Historical replay and frozen OOS results cannot substitute for this ledger.

Next action: keep the profile frozen and collect eligible forward outcomes from new MT5 candles.

### 2. Simulation runbook

The runbook remains a manual operating control and is not complete. Completing it does not grant execution authority.

Next action: finish each operator-verifiable checklist item and retain explicit skipped/not-applicable reasons.

### 3. Independent evidence coverage

Order flow, macro, intermarket, positioning, and volume-profile inputs are not verified. The corrected agent policy now abstains instead of inventing confirmation.

Next action: add a read-only, provenance-labeled source only when it is genuinely available. Do not lower evidence thresholds to compensate.

### 4. Tactical multi-timeframe depth

Deep profile validation has strong explicit 180-day MT5 evidence, but the normal current-read window can still be much shallower. Tactical context must not be presented as deep profile validation.

Next action: preserve explicit deep-history validation and improve bounded W1/D1/H4/H1 context hydration without auto-loading 180 days on page load.

### 5. Maturity across new conditions

IFVG v4 has strong historical and frozen OOS evidence, but maturity requires untouched forward behavior and more independent operating windows.

Next action: collect forward evidence before any Paper-Demo promotion decision.

## Not Genuine Blockers

- Generic Grinch evidence should not block an exact active IFVG profile when IFVG-native evidence exists.
- Imported-source inactivity is informational when the canonical MT5 source is active and eligible.
- An unavailable LLM provider must not prevent deterministic research. Advisory review remains non-authoritative.
- Missing agents must not be interpreted as negative votes.

## Safety

- `executionAuthority: none`
- `brokerAuthority: none`
- `readinessOverrideAuthority: none`
- No order, account, or position mutation was introduced.
- No auto-promotion or strategy-threshold relaxation was introduced.
- Raw candles remain internal and are not serialized into agent audit output.
