# Phase 3A IFVG v3 Legacy Mapping

## Boundary

Phase 3A compares IFVG inversion recognition only. It does not compare or emit
entry, invalidation, target, RR, replay, OOS, evidence, readiness, Paper-Demo,
or execution behavior.

Legacy IFVG v3 remains authoritative. The V2 adapter is diagnostic-only and has
no production consumer.

## Legacy Inventory

| Concern | Legacy implementation | Phase 2A representation | Phase 3A treatment |
|---|---|---|---|
| Base detector | `evaluateIctIfvg` | FVG lifecycle facts | Normalize the selected legacy inversion and compare it with V2 inversion artifacts. |
| V3 wrapper | `assessIctIfvgFreshRetestV3` | No retest fact | Fresh-retest eligibility is deferred to Phase 3B. |
| Required primary timeframe | M5 or M15; frozen profile uses M5 | Phase 2A FVG engine emits M5 facts | Phase 3A requires M5. |
| FVG geometry | Strict three-candle gap | `fair_value_gap` fact | Compare a semantic hash of direction, bounds, confirmation time, source, and timeframe. Prices are not exposed in artifacts. |
| Full inversion | Close beyond the far FVG boundary within 36 bars | FVG lifecycle `inverted` and `inversionTime` | Compare direction and causal close time. |
| Pre-inversion use | Any overlap before inversion blocks the zone | Not retained after the final lifecycle becomes `inverted` | Fail closed as `pre_inversion_usage_history_unavailable`. |
| Fresh retest | Clean retest must be the latest closed candle | Not represented | Deferred to Phase 3B; no freshness claim is made. |
| HTF alignment | Legacy candle-derived M15/H1/H4/D1 direction | Explicit HTF facts use a different Phase 2A policy | Not part of detection parity. |
| Displacement | Supporting context in V2 | `displacement` fact and lineage | Reference fact IDs when present; absence is not silently synthesized. |
| Liquidity | Legacy geometry chooses a later target | Pool/sweep facts can support displacement lineage | Only supporting fact IDs are emitted. Target selection is excluded. |
| Candidate selection | Legacy ranks by all blockers and geometry | Context facts do not contain geometry blocker ranking | Multiple inverted facts block deterministic selected-candidate parity. |
| Trade construction | Entry, stop, target, minimum RR | Intentionally absent | Phase 3B or later. |
| Candidate identity | Legacy selected-candidate fields | Stable fact IDs and context identity | Compare a normalized semantic candidate identity. |

## Confirmed Representation Gap

Phase 2A stores the final FVG lifecycle state. When a gap is touched and later
inverted, the final fact is `inverted`; the earlier touch is no longer present
in the compact fact. Legacy IFVG explicitly rejects that reused zone.

Phase 3A therefore may prove inversion identity and causal timing, but it may
not claim complete detection parity until pre-inversion lifecycle history is
available. The adapter reports `insufficient_comparison_data` rather than
assuming the zone was unused.

## Rollback

The adapter is exported only from the isolated V2 namespace and used by
diagnostic scripts. Rollback consists of removing the Phase 3A adapter,
diagnostic, tests, and package commands. No production state, storage, evidence,
readiness, or broker migration is required.
