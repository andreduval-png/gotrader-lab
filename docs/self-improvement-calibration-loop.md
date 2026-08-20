# Self-Improvement Calibration Loop

GoTrader AI Lab converts source-bound research findings into local calibration proposals, tests concrete changes against the active eligible non-mock research source, compares them with the current baseline, and requires user approval before active simulation settings change. The interface is agent-neutral; no specific AI agent is part of the calibration authority.

This workflow is simulation/research only. It does not add broker execution, order placement, readiness overrides, API keys, websocket feeds, Tradovate, TopStep, or live trading.

## Inputs And Ownership

Research-cycle quality attribution, bounded Auto Research, and replay-validated ICT hypotheses may identify weaknesses such as high drawdown, weak average R, stop-hit concentration, attributed avoidable losses, poor session performance, confidence calibration gaps, unstable agent weights, or overfitting risk.

AI Lab converts those findings into a `CalibrationProposal` with:

- a target problem
- a small proposed change
- expected improvement
- safety notes
- baseline metrics
- approval requirement

## How Proposals Are Tested

Concrete proposals are evaluated on the active eligible canonical candle source. Mock/demo candles are rejected as research evidence. The comparison includes:

- total trades
- win rate
- average R
- max drawdown
- profit factor
- skipped signals
- stop-hit count
- attributed avoidable-loss count
- confidence calibration
- readiness score
- stability score

The proposal is not accepted just because profit improves. It must improve stability or readiness without worsening sample quality, and its source/profile/parameter identities must match the validation evidence.

## ICT Hypothesis Bridge

ICT hypothesis replay and calibration are separate layers. Replay statuses `promising` and `paper_watchlist_recommended` may create a deterministic draft calibration intent only when the hypothesis and latest validation report have the same non-empty source fingerprint.

The draft contains no invented parameter patch, cannot be approved or auto-applied, and retains none/none/none authority. Bounded Auto Research must produce a concrete candidate for that exact identity before the normal validation and approval flow can begin. Weak, discarded, needs-more-data, missing-validation, and identity-mismatched hypotheses do not enter calibration.

## One Variable At A Time

The safest calibration flow changes one variable, or one small grouped set, at a time. Examples:

- raise confidence threshold only
- raise confluence and confidence together as a stricter evidence gate
- switch session filter only
- compare stop model only
- nudge agent weights only

Avoid mixing session, stop, thresholds, and agent weights in one proposal because it becomes impossible to know what actually helped.

## What Can Change

Allowed simulation calibration changes:

- confluence threshold
- confidence threshold
- session filter
- stop model
- target R multiple
- internal agent weights
- ICT scoring weights

## What Cannot Change

The proposal cannot:

- alter broker settings
- alter execution permissions
- override the readiness gate
- enable paper/demo trading
- enable live trading
- place orders
- control go-trader
- add broker API keys

## Approval Flow

1. Create a proposal.
2. Run the simulation test.
3. Review before/after metrics.
4. Confirm the comparison improves stability.
5. Approve or reject manually.
6. If approved, only local simulation calibration settings are updated.
7. Revert if the accepted calibration later proves unstable.

Execution authority stays separate from research authority at every step.
