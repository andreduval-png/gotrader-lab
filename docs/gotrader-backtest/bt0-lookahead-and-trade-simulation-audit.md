# BT0 Lookahead And Trade Simulation Audit

## Causality Findings

| Path | Detector view | Outcome view | Classification |
|---|---|---|---|
| Generic `runBacktest` | Context is sliced through `decisionIndex`; future candles are reserved for outcomes | Future scan starts after decision except profile-specific entry conventions | `CAUSAL_WITH_LIMITATIONS` |
| IFVG/CMD profile-specific generic path | Detector uses bounded context | Outcome starts after decision, but entry is treated as active at decision | `CAUSAL_WITH_LIMITATIONS` |
| ICT rolling replay | Each signal detector receives historical prefix through signal candle; HTF/session narrative is built from prefix | Future candles begin after signal and are capped | `CAUSAL_WITH_LIMITATIONS` |
| Frozen IFVG v2/v3 fixtures | Explicit causal correction and regression fixtures | Bounded outcome window | `CAUSAL_PROVEN` for tested fixtures only |
| Distributed Grinch / placeholder paths | Legacy engines and precomputed context can be distributed across modules | Not one audited adapter contract | `UNVERIFIED` |
| Diagnostic recognition | Context only; cannot construct a trade | None | `CAUSAL_WITH_LIMITATIONS`; not a backtest strategy |

No canonical API prevents a detector from receiving future data. Causality currently depends on each caller slicing correctly. Future work must provide an as-of-only candle/context capability, reject facts with `knownAt > decisionAt`, and test detector invariance when arbitrary future candles are appended.

Potential lookahead domains requiring adapter tests are future HTF closes, swing confirmation, liquidity state, FVG mitigation, session completion, and bias derived from later candles.

## Entry Semantics

| Engine/profile | Entry model | Fill semantics |
|---|---|---|
| Generic consensus | Entry-zone/retracement model | Searches future candles for first touch; unfilled expires at 0R |
| Generic IFVG/CMD profiles | Strategy geometry at decision | Treats trade as entered at decision index; does not require future touch |
| ICT replay | Midpoint, high/low, or signal close reference | Assumes the reference is entered; no order activation/fill queue |
| Phase 2/strategy replay | Shared strategy geometry | Replay classification rather than a broker-order simulator |

No path models quote side, bid/ask trigger rules, order latency, rejection, partial fill, available volume, guaranteed stop behavior, or lower-timeframe path reconstruction.

## Intrabar Ambiguity

The generic outcome evaluator checks stop before target when both are touched in one bar. ICT replay treats invalidation as first when its bar index is equal to the target bar index. This is conservative and should be preserved as a policy option.

Current limitations:

- Entry + stop on one candle can be ordered without knowing whether entry preceded stop.
- Entry + target on one candle has the same uncertainty.
- Stop + target and entry + stop + target use coarse deterministic ordering rather than lower-timeframe evidence.
- Ambiguity is not consistently recorded as a first-class flag.

The canonical simulator should expose `CONSERVATIVE_STOP_FIRST`, `LOWER_TIMEFRAME_RESOLUTION`, and `AMBIGUOUS_NO_RESULT`. Optimistic ordering should not be an acceptance default. Any lower-timeframe resolution must use only data that is part of the identified dataset.

## Outcome Semantics

| Label | Current meaning | Consistency issue |
|---|---|---|
| `target_first` | Target touched before invalidation | Generally consistent |
| `invalidation_first` | Stop/invalidation touched first or same bar | Generally conservative |
| `partial` | ICT MFE reached at least about half target distance | Not a realized partial exit |
| `stalled` | Neither terminal level, but enough future data | End-of-window handling differs |
| `no_trade` | Detector/profile did not produce eligible geometry | Sometimes conflated with filters/insufficient data |
| `insufficient_future` | Too few future candles to evaluate | Not consistently separated from expired/unfilled |
| `expired` | Generic entry never filled or horizon ended | Unfilled may be assigned 0R rather than excluded/fill-status metric |

These labels cannot be combined safely until a canonical lifecycle distinguishes opportunity, order, fill, open trade, exit, expiry, ambiguity, and unavailable future data.

## Stops, Targets, MAE, And MFE

Stops and targets are price levels tested against candle low/high. Generic unresolved filled trades mark to final close with modeled exit friction. ICT replay calculates MFE/MAE over its future window and sets `rrAchieved=MFE/risk`, which is excursion potential rather than realized trade R. Raw price excursion is not consistently normalized to points/pips/R.

Partial exits, multi-targets, break-even moves, trailing stops, session-close exits, weekend gaps, swaps, and gap-through-stop prices are not canonically implemented.

## Canonical Acceptance Requirements

- Immutable opportunity time and geometry before any future candle is exposed.
- Explicit order type and activation time.
- Entry fill status and fill price separate from signal price.
- Versioned intrabar policy with ambiguity counters.
- Gap-aware stop/target behavior.
- Mark-to-market only when explicitly requested.
- MAE/MFE measured from actual fill and stored in price, broker points/pips where applicable, and R.
- One outcome vocabulary shared by every strategy adapter.
- Property tests proving future append invariance and same-bar conservatism.
