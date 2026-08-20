# I0 Strategy Model Audit

## Known Or Previously Present

| Model | Classification | Identity / finding | Required action |
| --- | --- | --- | --- |
| Silver Bullet | FULLY_IMPLEMENTED | v1 and refined v2 research profiles | Integrate accepted adapter registry; preserve profiles |
| Turtle Soup | FULLY_IMPLEMENTED | turtle_soup_v1 | Integrate accepted adapter; preserve detector semantics |
| One Shot One Kill | IMPLEMENTED_BUT_NOT_BT2_WIRED | ict-one-shot-one-kill legacy engine | Adopt accepted adapter/parity before claiming integrated BT2 |
| Bread & Butter Buy/Sell | IMPLEMENTED_BUT_NOT_BT2_WIRED | Two legacy engines | Same as OSOK |
| IFVG models | FULLY_IMPLEMENTED | v1-v4; v2 negative control, v3 canary, v4 experimental | Preserve distinct identities and evidence |
| CISD | FULLY_IMPLEMENTED | cisd_v1 | Reuse; do not create separate "change in delivery" alias |
| CMD | FULLY_IMPLEMENTED plus PARTIAL profile | high-displacement v2 complete; short watchlist v1 partial | Retire or complete watchlist only through separate source-bound slice |
| Nasdaq London Raid / NY Reversal | FULLY_IMPLEMENTED | v1 and filtered v2 | Reuse |
| Grinch family | IMPLEMENTED_BUT_NOT_RUNTIME_WIRED | Three confluence/context profiles | Keep confluence-only unless separately specified |
| Order Block Retracement | DUPLICATE_OR_ALIAS | B&B consumes block/retracement semantics; no separate authoritative model | Source-disambiguate before registration |
| SMT | CONCEPT_ONLY / shadow context | S1 canonical context, not a trade model | Consume one S1 artifact; do not duplicate |
| Liquidity Reclaim Scalper | IMPLEMENTED_BUT_NOT_RUNTIME_WIRED | Accepted-unintegrated lrs v1 with adapter/state machine | Integrate only after R1 acceptance and explicit governance |

## Missing Or Questionable

| Requested model | Classification | Existing reusable parts | Missing complete-model work |
| --- | --- | --- | --- |
| ICT 2022 Mentorship Model | PARTIAL | liquidity, displacement, FVG, MSS/CISD, PD context, C1 | Source-bound ordered state machine, geometry, expiry, parameters |
| OTE trading model | PLACEHOLDER | dealing range, premium/discount, Model One context | Exact retracement source, confirmation, invalidation, target, adapter |
| Judas Swing | MISSING | session windows, sweep, displacement | Source definition and complete causal sequence |
| Power of Three / AMD | PARTIAL | Model One/Power Three context and CMD | General long/short state machine and source-defined variants |
| Market Maker Buy Model | MISSING | CMD/Grinch/context facts | Distinct source packet and full model |
| Market Maker Sell Model | MISSING | Same | Distinct source packet and full model |
| Generalized MMXM | MISSING | Same | Decide framework versus executable model; do not alias MMBM/MMSM |
| Unicorn Model | MISSING | breaker and FVG facts | Exact overlap/order/confirmation/geometry contract |
| Breaker + FVG Model | PARTIAL | breaker classification, FVG, session-raid composite | Determine whether alias of Unicorn or distinct source model |
| Breaker Block trading model | PARTIAL | breaker fact | Complete setup sequence or classify as fact-only |
| Mitigation Block trading model | PARTIAL | mitigation fact | Complete setup sequence or classify as fact-only |
| NDOG trading model | MISSING model / PARTIAL fact | calculateNewDayOpeningGap | Canonical clock/identity then source-defined model |
| NWOG trading model | MISSING model / PARTIAL fact | calculateNewWeekOpeningGap | Canonical clock/identity then source-defined model |
| TGIF / Friday model | MISSING | session and opening-gap facts | Source-defined Friday timing, direction, geometry, expiry |
| IRL to ERL delivery | MISSING | FVG/BPR and external targets | Canonical IRL/ERL facts plus transition state machine |
| ERL to IRL delivery | MISSING | Same | Directionally distinct transition contract |
| Generic PD Array execution | CONCEPT_ONLY | PD hierarchy/recognition | Prefer profile/policy; create strategy only with unique causal sequence |
| PO3 High/Low-of-Day variant | MISSING variant | AMD context and daily projections | Source packet proving distinction from generic PO3 |
| Charter Models 1-12 | INSUFFICIENT_DEFINITION | Unknown | Accepted definition packets before any implementation |

## Complete Model Contract

Every complete model must have strategyId, strategyVersion, classification, required/preferred/optional timeframes,
required canonical facts, ordered state machine, long and short paths, setup/confirmation/invalidation/expiry,
native entry/stop/target geometry, versioned parameter schema, feature dependency graph, causal fixtures, lossless
adapter, BT2 request identity, Current Read projection, C1/C1.1 narrative policy, S1 SMT policy, provenance, and
authority none/none/none.

Strategy code owns detection, state progression, and geometry intent. BT2 alone owns fills, same-bar ambiguity,
stop/target ordering, spread, slippage, commission, expiry resolution, and trade outcome.

## Parameter Classification

| Class | Meaning | Examples |
| --- | --- | --- |
| SOURCE_DEFINED | Rule explicitly fixed by accepted source definition | named session or ordered setup event |
| CANONICAL_GOTRADER_RULE | Shared platform contract | closed-candle rule, timestamp identity, fail-closed freshness |
| RESEARCH_PARAMETER | Preregistered bounded dimension | tolerance, displacement multiple, retracement depth, expiry bars |
| UNRESOLVED | No accepted source or governed range | arbitrary OTE band, macro minute windows, MMXM thresholds |

Future parameter spaces must list every behavior-changing value, units, bounds, default rationale, interactions,
and identity fingerprint. Frozen profiles cannot be silently edited or optimized from observed outcomes.

## Baseline Finding

Fixtures, replay/OOS references, rolling windows, and accepted adapter parity exist unevenly. No requested model has
a repository-wide two-year certified baseline contract. A two-year baseline is an I7 acceptance input, not proof
that may be inferred from implementation completeness.
