# GoTrader V2 Phase 2A Context Compatibility Policy

## Purpose

Phase 2A builds canonical market facts in shadow. The legacy research pipeline
remains authoritative. This policy defines how compact legacy observations are
compared with V2 facts before any strategy caller may enter a Phase 3 canary.

The comparison artifact never accepts or stores candle arrays. Legacy code may
read candles internally and must normalize its result into compact metrics before
calling the comparator.

## Outcomes

- `exact_parity`: every normalized legacy metric equals the complete V2 summary.
- `semantic_parity`: all supplied comparison metrics match, while the legacy
  observation is intentionally less detailed than the V2 summary.
- `documented_variance`: non-strict metrics differ under one named, reviewed
  policy listed below.
- `regression`: source identity, authority, a strict semantic metric, or an
  unreviewed policy differs.
- `insufficient_comparison_data`: a family, V2 fact set, or required strict
  comparison metric is missing.

`regression` and `insufficient_comparison_data` block Phase 3.

## Strict Invariants

The following differences cannot be accepted as policy variance:

- requested symbol;
- broker symbol;
- source fingerprint;
- authority other than `none / none / none`;
- session identifiers;
- opening-price identifiers;
- liquidity sides;
- latest displacement direction;
- latest FVG direction;
- explicit higher-timeframe set.

Each family must also supply at least one required comparison metric. Dealing
range must include geometry even though its geometry may differ under the named
session-scoping policy. Missing required metrics fail closed as insufficient
comparison data.

## Reviewed Variances

| Family | Policy ID | Reason |
|---|---|---|
| Dealing range | `legacy_full_window_vs_v2_session_scoped_range_v1` | Legacy selects one full-window range; V2 emits session-scoped ranges with explicit anchors. |
| Liquidity | `legacy_swing_selection_vs_v2_session_pool_lifecycle_v1` | Legacy combines swing, prior-period, session, and gap pools; V2 tracks explicit session pool lifecycle facts. |
| Displacement | `legacy_latest_match_vs_v2_causal_fact_set_v1` | Legacy returns the latest qualifying candle; V2 emits all causally confirmed facts using a fixed ten-candle baseline. |
| Fair value gap | `legacy_selected_pd_array_vs_v2_gap_lifecycle_v1` | Legacy returns one selected FVG; V2 emits gap facts with lifecycle state. |
| Higher-timeframe bias | `legacy_full_window_vs_v2_explicit_last_five_v1` | Legacy uses the full supplied window; V2 uses five explicit closed candles and never synthesizes a missing timeframe. |

The allowlist is closed. A new variance requires a new policy ID, deterministic
coverage, and review. Merely attaching a variance label cannot excuse a strict
metric mismatch.

## Compatibility Artifact

`buildV2ContextCompatibilityReport` returns:

- the V2 context artifact and source identity;
- one entry for every Phase 2A fact family;
- compact legacy and V2 summaries;
- exact differences and reviewed policy ID;
- Phase 3 blockers and warnings;
- a stable report ID;
- `legacyAuthoritative: true`;
- `v2ShadowOnly: true`;
- `rawCandlesSerialized: false`;
- authority `none / none / none`.

The report creates no evidence, readiness, paper-demo eligibility, execution
intent, broker capability, or strategy output.

## Phase 3 Gate

A context artifact is ready only for canary review when:

1. all seven families are represented;
2. every result is exact, semantic, or reviewed variance;
3. source identity and authority match;
4. no raw candles are serialized;
5. no production caller imports the comparator or V2 context builder;
6. frozen positive and negative strategy baselines remain unchanged.

Canary review is not production adoption. Phase 3 must still compare profile
detection, geometry, blockers, replay, OOS, provenance, and authority under the
repository-wide migration parity policy.
