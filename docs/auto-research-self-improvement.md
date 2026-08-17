# Auto Research Self-Improvement Supervisor

The Auto Research Supervisor is a simulation-only optimizer for GoTrader AI Lab. It searches bounded research configurations, runs backtests and validation suites on the explicitly selected research source, compares candidates against the current baseline, and creates approval-gated calibration proposals. Mock/demo results are labeled and cannot support approval.

It cannot execute trades, enable paper/demo/live trading, change broker settings, override readiness gates, approve its own proposals, or modify secrets.

## How It Searches Configurations

The supervisor starts from the active Backtest Lab configuration and generates a small set of candidate settings. Search modes include:

- conservative search
- balanced search
- aggressive research-only search
- session-focused search
- stop-model-focused search
- long/short-bias search

The bounded search space may adjust:

- confluence threshold
- confidence threshold
- session filter
- stop model
- target R multiple
- long/short direction filters
- internal agent weights
- ICT scoring weights

Internal agent weights now favor futures market-context agents over equity-sector agents. Auto Research may tune
session levels, auction/volume profile, macro event risk, intermarket confirmation, positioning/gamma, volatility
regime, and later order-flow weights, but it cannot restore deprecated sector agents into the main futures workflow.

The supervisor must never search over:

- broker settings
- execution permissions
- live mode
- demo mode activation
- contract size
- max daily loss
- API keys
- readiness gate bypass
- manual approval permissions

## Candidate Testing

Each candidate runs through existing simulation-only systems:

1. backtest on the explicitly selected research source
2. validation suite
3. research quality review
4. baseline comparison
5. stability-first scoring

All candidate results are stored in the local audit trail.

## Why Stability Beats Profit

The supervisor does not select a candidate simply because it has the highest profit or best single result. It scores candidates using:

- lower max drawdown
- better average R
- acceptable win rate
- lower false positives
- confidence calibration
- session consistency
- sufficient trade count
- skipped-signal balance
- profit factor
- robustness across scenarios

Drawdown, calibration, false positives, trade count, and robustness have priority over isolated profit.

## Proposal Creation

If the best candidate improves stability enough, the supervisor creates a `CalibrationProposal` in the Self-Improvement workflow.

The proposal:

- remains simulation-only
- has `approvalRequired: true`
- includes before and after metrics
- includes a safety reason and notes
- cannot alter broker or execution permissions
- cannot override readiness gates

The active baseline is not changed when the proposal is created.

## Approval Requirement

Manual acceptance happens through Research Calibration after reviewing before/after metrics. Research calibration auto-apply is disabled by default. When the operator explicitly enables the versioned policy, only allowlisted bounded fields may auto-apply after the normal approval, identity, regression, maturity, and walk-forward checks pass.

Auto Research cannot bypass `canApproveProposal`, frozen-profile protection, identity checks, or safety authority. It cannot auto-apply unless the explicit current operator policy is enabled.

## LLM Supervisor Roadmap

The current implementation uses deterministic candidate generation as a baseline optimizer. Full autonomous research mode requires an LLM supervisor layer that can recommend search directions through a secure provider boundary.

The LLM supervisor may later suggest:

- which search mode to run
- which weak condition to target
- which session or stop model to compare
- which calibration change should be tested next

Even then, LLM output remains advisory only. It cannot execute trades or override readiness gates.

## Safety Rules

1. Auto Research cannot execute trades.
2. Auto Research cannot enable paper, demo, or live trading.
3. Auto Research cannot change broker settings.
4. Auto Research cannot override readiness gates.
5. Auto Research cannot approve its own proposal.
6. Auto Research cannot modify API keys or secrets.
7. Auto Research must log every candidate and decision.
8. Active baseline changes require manual approval by default or explicit current opt-in to the bounded research-only auto-apply policy.
