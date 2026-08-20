# AI Research Cycle Pipeline

The dashboard **Run AI Research Cycle** control runs a local, simulation-only research pipeline. It automates research evidence gathering, but it never places orders, connects to a broker, enables paper/demo/live mode, or overrides readiness gates.

## Pipeline Order

1. Generate or refresh the research thesis.
   - Uses the active Backtest Lab symbol, timeframe, session filter, and market regime.
   - Builds deterministic ICT context.
   - Produces a CIO thesis with bias, confidence, invalidation, target, and risk notes.
   - Saves the thesis into local AI Lab memory.

2. Run the active-source backtest.
   - Requires an explicit eligible canonical source, a source fingerprint, and sufficient candles.
   - Rejects mock/sample data as research evidence.
   - Uses active/default Backtest Lab config.
   - Stores a compact summary only: trades, win rate, average R, max drawdown, skipped signals, best/worst R.
   - If this step fails, candidate scoring stops because downstream optimization would not be trustworthy.

3. Run LLM advisory review.
   - Uses the local LLM bridge if available.
   - If unavailable, the step records a warning and the pipeline continues through deterministic simulation checks.
   - Missing LLM review is never marked as passed.

4. Run multi-pass Auto Research.
   - Quick, standard, and deep modes control candidate count.
   - Candidate configs are bounded to research settings only.
   - Ranking favors stability over profit.
   - Any created calibration proposal remains approval-required.
   - Imported historical data defaults to quick mode, 5 candidates, and one adaptive follow-up pass unless Advanced full research mode is enabled.

5. Run Validation Suite.
   - Stores strongest/weakest scenarios and recommended thresholds.
   - Uses the identity-bound validation source selected for the active research profile.

6. Run Research Quality Review.
   - Produces readiness grade, top weaknesses, top strengths, and next action.

7. Run Self-Improvement Evaluation.
   - Checks whether Auto Research created or found a proposal.
   - Does not apply settings automatically.

8. Update Simulation Runbook.
   - Marks the research pipeline timestamp and AI Lab thesis generation.
   - Does not self-certify any simulation-runbook check or carry checks forward from an earlier cycle.
   - After the runtime mirror is accepted, the local GoTrader Research MCP derives only thesis-generated and signal-logged evidence from the exact completed cycle artifact.
   - Handoff checks require an immutable handoff receipt. Scheduler completion, broker skipped, positions zero, trades zero, and shutdown complete require an immutable scheduler receipt for the exact active cycle.
   - Missing receipt evidence is reported as unavailable; it is not interpreted as an observed nonzero position/trade or failed shutdown.

9. Update Readiness Gate.
   - Calculates Not Ready, Research Ready, or Paper-Demo Candidate.
   - LLM advisory missing keeps Paper-Demo Candidate blocked.
   - No readiness override is applied.

10. Produce Final Cycle Result.
   - Final status is `completed`, `completed_with_warnings`, or `failed`.
   - Includes readiness, blockers, best candidate, proposal status, and next action.

11. Persist research memory.
   - Appends the compact source-of-truth cycle record to the immutable Research Evidence Ledger.
   - Queues applicable `research_cycle`, `walk_forward`, `self_improvement`, and `gap_analysis` advisory packets.
   - Optional delivery is operator-enabled, manual, loopback-only, and disabled by default.

## What Is Automated

- Thesis generation
- Eligible active-source backtest
- Local LLM bridge attempt
- Auto Research candidate search
- Validation suite
- Research quality review
- Proposal creation when stability improves
- Runbook research timestamp
- Readiness recalculation
- Communications audit entry

## Imported Data Safe Mode

When imported MNQ or other historical candles are active, the dashboard runs the pipeline in Safe mode by default:

- latest 500 raw candles
- 5m aggregation
- about 100 processed candles
- quick search only
- maximum 5 candidates
- one adaptive pass
- compact audit traces

This keeps the browser responsive while still proving whether the current research setup can generate and evaluate simulated trades. Standard and Advanced modes remain available from Market Data and Backtest Lab, but the dashboard requires the Advanced full research toggle before allowing larger imported-data runs.

If a phase fails, the pipeline records the failed or warning step and continues where safe. It should not crash the page or silently mark missing work as passed.

## What Still Requires Approval

- Calibration proposal acceptance
- Any active setting change
- Any future paper-demo bridge decision
- Any readiness blocker acknowledgement

## Safety Boundary

The pipeline cannot:

- Execute trades
- Connect to brokers
- Enable demo/live mode
- Modify API keys
- Change broker risk settings
- Approve its own proposals
- Override readiness gates

## Final Readiness Results

- **Not Ready**: Research evidence is incomplete or unstable. Continue simulation work.
- **Research Ready**: Deterministic validation may be usable for continued research, but Paper-Demo Candidate remains blocked until all required checks pass.
- **Paper-Demo Candidate**: All required checks pass, including LLM advisory review. This is still not permission to execute trades; it only means the research package can be reviewed for a future paper-demo architecture.
