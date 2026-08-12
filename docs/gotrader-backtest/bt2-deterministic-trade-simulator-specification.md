# BT2 Deterministic Trade Simulator Specification

## State Machine

```text
received -> activation_pending -> active_order
active_order -> filled | expired_unfilled | canceled | insufficient_data
filled -> open
open -> exited | ambiguous | insufficient_data
```

Every transition is append-only, timestamped by identified market data, and
hashed. Terminal records cannot be reopened. Retries replay the same transition
inputs and must produce byte-identical records.

## Fill And Exit Semantics

- Entry activation, trigger, fill status, and fill price are distinct.
- Bid/ask rules and spread source are explicit; missing required spread blocks.
- Gaps fill at the configured conservative executable price, never silently at
  a crossed level.
- Stop, target, expiry, session close, and explicit end-of-window are separate
  reasons.
- Mark-to-market is disabled unless the experiment explicitly selects and
  identifies it.
- MAE/MFE begin at actual fill and remain separate from realized gross/net R.

Partial exits, trailing stops, break-even mutation, swaps, and multi-position
capital contention are unsupported in Stage 1. Encountering an unsupported
instruction blocks the record instead of approximating it.

## Intrabar Policy

Default policy: `conservative_stop_first_v1`.

When one OHLC candle can satisfy incompatible event orders, BT2 either applies
the declared conservative order or emits `ambiguous`; it never selects the
profitable path. Supported policies are:

- `conservative_stop_first_v1`;
- `ambiguous_no_result_v1`;
- `lower_timeframe_resolution_v1`, only when the lower timeframe belongs to the
  same qualified dataset identity and fully covers the parent interval.

The acceptance matrix includes entry/stop, entry/target, stop/target,
entry/stop/target, gap-through-entry, gap-through-stop, gap-through-target,
missing interval, and lower-timeframe disagreement cases for long and short
directions.

## Costs

Stage 1 provides typed, versioned plumbing for spread, slippage, commission,
and swap, each with explicit units and applicability. `none` is a valid identified
model. Missing a required component is a blocker, not zero. Gross R, every cost
component, and net R are stored separately. Futures contract sizing must not be
introduced into the USTECH CFD/proxy path.

## Immutable Records

`TradeSimulationRecord` binds the opportunity ID, dataset certificate, engine
and policy versions, ordered transitions, fill/exit facts, ambiguity, costs,
gross/net R, price/point/pip MAE/MFE, and authority. Its record ID hashes the
complete core.

`TradeLedgerSeal` binds the experiment manifest, deterministic ordered record
IDs, counts by lifecycle outcome, checkpoint lineage, and code commit. Parallel
worker completion order cannot affect the seal.

## Restart And Storage

- deterministic partition keys derive from experiment and opportunity IDs;
- immutable writes are idempotent and conflict-detecting;
- one mutable checkpoint records only cursors and committed partition hashes;
- restart verifies every referenced immutable artifact before continuing;
- controlled interruption must exit at a committed boundary and resume to the
  same final ledger seal as uninterrupted execution;
- raw candle arrays are never embedded in records, checkpoints, or Git.
