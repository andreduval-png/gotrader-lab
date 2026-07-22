# GoTrader V2 Phase 2A.0 Context Eligibility Policy

## Purpose Matrix

| Purpose | Allowed source | Time requirement | Historical use | Evidence |
| --- | --- | --- | --- | --- |
| `current_live_shadow` | MT5 read-only | Fresh current-live terminal verification | Only after the established offset-regime start | None |
| `deterministic_fixture` | Explicit imported, replay, MT5, or mock fixture | Explicit deterministic timestamps | Fixture-scoped only | None |

Mock fixtures are degraded and cannot be treated as authoritative legacy comparison.

Replay, walk-forward, deep research, evidence, and readiness remain outside the context-purpose contract. Existing repository rules for those purposes are unchanged.

## Current-Live MT5 Rules

Current-live shadow eligibility requires all of the following:

- accepted read-only MT5 time contract;
- `currentLiveTimeBasisVerified: true`;
- verification scope `current_live` or `historical`;
- fresh terminal observation, at most 120 seconds old;
- trusted UTC reference clock;
- valid observed terminal offset for server-wall-clock normalization;
- closed-candle proof;
- source and data-quality status not blocked;
- context market time no later than observation expiry;
- window start at or after the verified offset-regime start unless historical DST policy is verified.

Current-live policy is purpose-scoped. It does not set `phase2Eligible`, does not verify historical DST, and cannot authorize historical replay or evidence.

## Historical Rules

Historical MT5 eligibility still requires:

```text
verificationStatus: verified
historicalDstPolicyVerified: true
phase2Eligible: true
timeVerificationScope: historical
```

A current `+180` offset cannot normalize an earlier, unverified provider-offset regime.

## Continuity Limitation

The present terminal observation is valid for 120 seconds. Phase 2A.0 conservatively uses its capture time as the offset-regime start. This permits a small post-capture current-live window but cannot yet establish complete M5/M15/H1 session history.

Before live session/opening engines can be accepted, GoTrader needs one of:

1. a compact immutable offset-regime continuity ledger built from repeated accepted observations; or
2. a historically verified provider timezone/DST contract.

The continuity ledger must prove matching offset and terminal identity without storing raw candles. It must terminate the regime on gaps, conflicting offsets, stale quote clocks, or terminal-instance changes.

## Failure Behavior

Blocked diagnostics are explicit for:

- missing or expired current-live verification;
- stale source/window;
- pre-verification candles;
- missing required timeframe;
- partial/future/invalid candles;
- mixed source identity;
- non-read-only capability;
- non-`none` authority.

No favorable fallback is selected.
