# GoTrader V2 Phase 2A Completion Report

## Decision

Phase 2A shadow canonical market-context construction is complete and is ready
for a profile-scoped Phase 3 canary review.

This decision does not replace the legacy research pipeline. No Dashboard,
Advisor, detector, replay, walk-forward, evidence, readiness, paper-demo, or
execution caller has adopted V2 context.

## Delivered Scope

Phase 2A now provides deterministic, source-bound, shadow-only facts for:

1. sessions;
2. opening prices;
3. session dealing ranges;
4. liquidity pools and sweeps;
5. displacement;
6. fair value gaps and lifecycle;
7. explicit higher-timeframe bias.

The context identity includes source fingerprint, requested and broker symbols,
closed-candle window identities, time normalization policy, requested fact
families, and fact-policy versions. Missing required windows and unverified time
contracts fail closed.

## Compatibility Review

The deterministic compatibility fixture runs the legacy session-range,
liquidity-pool, dealing-range, displacement, and FVG helpers against the same
underlying candle fixture used by the V2 context builder. Opening prices are
normalized from the same boundary candles. Higher-timeframe legacy observations
use the existing full-window bias formula against the same explicit timeframe
fixtures.

| Family | Result | Review |
|---|---|---|
| Session | Exact parity | Same five session identifiers and complete-session set. |
| Opening price | Exact parity | Same Sunday, New York midnight, and 09:30 boundary prices. |
| Dealing range | Documented variance | Legacy full-window geometry versus V2 session-scoped anchored ranges. |
| Liquidity | Documented variance | Legacy mixed pool selector versus V2 session pool lifecycle. Liquidity sides remain invariant. |
| Displacement | Documented variance | Legacy latest-only result versus V2 causal fact set. Latest direction remains invariant. |
| Fair value gap | Documented variance | Legacy selected FVG versus V2 lifecycle fact set. Latest direction remains invariant. |
| Higher-timeframe bias | Documented variance | Legacy full-window policy versus V2 explicit last-five policy. Explicit timeframe set remains invariant. |

The fixture produces 5 session facts, 3 opening-price facts, 5 range facts,
12 liquidity facts, 5 displacement facts, 2 FVG facts, and 5 higher-timeframe
bias facts.

Negative controls prove that direction mismatch, source-fingerprint mismatch,
missing family data, and an unknown variance policy all block Phase 3.

## Safety And Compatibility

- Legacy remains authoritative.
- V2 remains shadow-only.
- No production adoption was found.
- Raw candle arrays are absent from compatibility artifacts.
- Account, order, position, secret, and credential data are absent.
- Authority remains `none / none / none`.
- The comparison creates no evidence or readiness.
- Frozen IFVG v3 positive, IFVG v2 negative, and strategy-catalog hashes must
  remain unchanged in the full preservation matrix.

Because Phase 2A is additive and unused by production callers, rollback is the
removal of the isolated V2 modules; no legacy runtime switch or data migration is
required.

## Residual Limits

This is context-fact compatibility, not strategy parity. It does not establish
that a V2-backed detector preserves candidate timestamps, trade geometry,
blockers, replay outcomes, OOS results, or readiness. Those comparisons belong
to Phase 3 and must use positive and negative profile controls.

Live MT5 shadow observation collection also remains diagnostic-only. A live
comparison may block a canary if source identity, time verification, or family
coverage is insufficient.

## Recommended Next Step

Begin Phase 3 with one IFVG v3 compatibility adapter:

- keep the legacy IFVG v3 detector authoritative;
- construct V2 facts from the same closed-candle windows;
- adapt only the facts required by IFVG v3;
- dual-run detection in shadow;
- compare candidate identity, causal timestamps, geometry, blockers, replay,
  frozen OOS, provenance, and authority;
- retain IFVG v2 as the negative control;
- provide an immediate rollback switch;
- do not expose the adapter to readiness, paper-demo, or execution.

Any unexplained mismatch must stop the canary.
