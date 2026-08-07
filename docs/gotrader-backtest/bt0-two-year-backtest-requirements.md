# BT0 Two-Year Backtest Requirements

## Scope

The future system must reproducibly evaluate approximately 24 months of closed OHLC for every eligible manifest strategy/profile while preserving native geometry and authority `none/none/none`. It must run headlessly, resume after interruption, and never use profitability to promote readiness or execution.

## Experiment Identity

Every experiment ID must canonically include:

- dataset ID and SHA-256 checksum;
- source/provider fingerprint, requested symbol, broker symbol, and symbol-spec snapshot;
- timeframe set and exact UTC date range;
- historical time-policy/contract ID and offset regimes;
- strategy ID, profile version, frozen strategy/parameter hash;
- geometry mode and RR model/version;
- cost model/version and risk model/version (or explicit `none`);
- engine/schema version and source code commit;
- intrabar policy, warmup policy, and random seed(s).

A changed field creates a different experiment. Derived reports must point to the immutable parent identities.

## Dataset Foundation

- Resumable date/time partitions with overlap-safe pagination.
- Atomic partition writes and checksum verification on read.
- Closed-candle enforcement; duplicate, conflict, gap, revision, future, and partial-bar ledgers.
- Versioned broker calendar for weekends, holidays, and daily maintenance.
- Raw immutable normalized OHLCV/spread dataset plus compact manifest; unlike current live runtime, the historical subsystem may persist research market data under an explicitly authorized isolated store.
- Stable columnar or compact binary representation, not browser object/localStorage authority.
- Separate source and normalized timestamps with verified UTC and America/New_York conversion.

## Time Acceptance

No session-sensitive experiment is eligible until historical MT5 provider time, offset changes, DST, candle-close boundaries, and New York session conversion pass bounded winter/summer/transition fixtures and live-source probes. `history available` must never imply `historicalTimeEligible`.

## CFD / Forex Normalization

A versioned symbol-spec snapshot must retain digits, broker point, pip convention, minimum price increment/tick size where relevant, spread unit, tick value/profit calculation metadata, MT5 lot constraints, and account currency conversion when cash P&L is enabled. The engine must always preserve raw price, broker points/pips, R, and optional cash P&L as distinct quantities. It must not introduce futures sizing into the CFD path.

## Causal Strategy Adapter

- Adapter identity ties to the machine strategy manifest.
- Input exposes only facts/candles known as of `decisionAt`.
- Future-append invariance and HTF-close timing are property-tested.
- Output is an immutable canonical opportunity with decision time, entry order, stop, target(s), native R:R, context lineage, and blocker/no-trade reason.
- Placeholder and diagnostic entries cannot emit trade opportunities.

## Trade Simulation

- Lifecycle: opportunity -> order activation -> fill/unfilled -> open -> exit/expiry/ambiguous/insufficient.
- Market, next-open, limit, retracement, FVG touch/midpoint, OTE, and strategy-specific entries are explicit policies.
- Bid/ask trigger rules, dynamic/static spread, slippage, commission, swap, gaps, session close, and missing-cost behavior are versioned.
- Intrabar policy is explicit and conservative by default; optional lower-timeframe resolution is dataset-identified.
- Native geometry and standardized RR experiments are separate child experiments.
- Immutable trade ledger contains gross/net R, price/point/pip excursion, MAE/MFE, hold time, and costs.

## Analytics And Validation

Required strategy metrics: setup/candidate/fill/trade counts; wins/losses; win/target-first rates; mean/median/expectancy R; PF; drawdown; streaks; MAE/MFE; hold time; exposure; time-under-water; Sharpe/Sortino/Calmar/SQN where sample definition is valid; session, weekday, month, quarter, year, regime, and cost sensitivity.

Walk-forward/OOS must identify development, validation, and untouched test periods, warmup, window overlap, selection objective, trials, minimum samples/dates, and positive-window rule. Monte Carlo must retain seeds and support IID plus block/regime-aware methods. All uncertainty displays include sample counts.

## Risk And Portfolio

Risk is a separate consumer of the immutable trade ledger. It must support fixed R/cash/percent, optional compounding, MT5 lot rounding, loss/drawdown governors, concurrent exposure, capital contention, same/cross-symbol priority, strategy correlation, combined equity, margin/gap assumptions, and policy fingerprints.

## Job Lifecycle

- Headless CLI/service, no browser required.
- Durable queued/running/completed/failed/canceled state.
- Deterministic partitions and idempotent writes.
- Checkpoints after dataset, detection, simulation, and analytics partitions.
- Resume verifies all parent hashes and code/engine identity.
- Bounded retries and honest terminal failure; no artifact editing.
- One writer per artifact with atomic finalize/seal.

## Scale And Execution Model

Planning basis per 24x5 symbol: roughly 927,000 bars across M1/M5/M15/H1/H4/D1. Compact OHLCV/spread is estimated at 50-120 MB/symbol; ordinary JS objects at 230-460 MB/symbol. Six representative symbols imply roughly 300-720 MB compact data or 1.4-2.8 GB if fully inflated as JS objects.

Repeated O(N x lookback) detector scans can reach hundreds of millions of bar visits (for example M1 x 800-bar repeated windows). BT2/BT3 should precompute causal reusable facts or update detector state incrementally. Target planning, to be benchmarked in BT1/BT2: ingest/hash 1-3 minutes per local symbol; optimized strategy/timeframe run 0.5-5 minutes per symbol; current legacy scans may require 20-120+ minutes or fail in browser memory. Full 13-executable-profile, multi-symbol evaluation is an hours-scale batch.

Recommended execution is bounded parallelism: a coordinator plus 2-4 worker threads or child processes, deterministic symbol/strategy partitions, memory limits, and one atomic artifact writer. Child processes are preferred for isolation of legacy adapters; worker threads are acceptable for pure canonical engines. Parallel order must not change IDs or results.

## Acceptance

BT9 must prove two-year completeness/checksums, historical time/DST, deterministic rerun equality, causal invariance, cost/unit fixtures, conservative ambiguity, restart/resume, bounded memory/disk, all eligible strategy adapters, OOS/MC/risk separation, portfolio fixtures, report lineage, zero authority drift, and no production adoption. A missing historical-time or symbol-cost prerequisite blocks acceptance rather than lowering thresholds.
