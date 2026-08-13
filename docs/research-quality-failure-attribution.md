# Research Quality Failure Attribution

## Purpose

GoTrader now derives research-quality failure telemetry from completed simulated trade outcomes while the full replay result is still in memory. It persists only compact aggregates. This replaces two misleading legacy behaviors:

- aggregate losses were estimated from scenario win rate and called false positives;
- every scenario with drawdown was presented as a drawdown cluster.

The attribution artifact is research-only. It cannot create evidence, mutate a profile, promote readiness, size a broker request, or grant authority.

## Canonical Identity

Each artifact is keyed to the validation run and its compact provenance:

- strategy profile and version
- source provider
- requested and broker symbols
- timeframe
- source fingerprint
- parameter fingerprint
- canonical validation scenario

The conservative-confluence scenario is preferred as the canonical completed-outcome sample. If it is unavailable, the scenario with the largest compact completed-trade sample is used.

## Outcome Contract

- `target_hit` is a completed target-first outcome.
- `stop_hit` is a completed invalidation-first outcome.
- `expired` is sample incompleteness, not a false positive.
- skipped signals and diagnostic/context rows are rejected context, not false positives.
- a recorded pre-entry weakness is compared with completed trades where that flag was absent;
- a cause is qualified only when both cohorts contain at least five trades, the exposed stop rate is at least 15 percentage points worse, and its stop-risk ratio is at least 1.25;
- a flag shared by winners and losses, or one with no comparator, is not a causal failure family;
- a stop hit without a discriminating cause is `unattributed_model_loss`; it is an ordinary/unexplained model loss, not automatically a false positive.

This distinction prevents a larger profitable sample from failing merely because it contains more than two losing trades.

## Compact Outputs

The validation report retains:

- target, stop, expired, and neutral counts
- stop-hit rate
- directly attributed and unattributed stop-hit counts
- compact context-evaluation coverage
- separately reported causal-attribution coverage
- exposed/comparator stop rates for every reviewed context flag
- failure-context families ranked by lost R
- per-session completed outcomes
- chronological peak-to-recovery drawdown clusters
- rejected-context reason counts
- one recommended single-variable experiment

It excludes raw candles, full trade records, raw snapshots, secrets, and account/order/position data.

## Readiness Behavior

The false-positive quality gate is fail-closed:

- compact pre-entry context must be evaluated for at least 90% of stop hits;
- directly attributable failure rate must be at most 25%;
- directly attributable recurring families must be at most two.

Ordinary losses do not need to be assigned a cause for this gate to pass. The purpose of the gate is to control reproducible avoidable defects, not to require a profitable model to have fewer than two losing trades.

Legacy reports without compact telemetry retain the prior legacy check and are labeled as estimates. A fresh validation run is required to use the completed-outcome contract.

Passing this quality check does not promote readiness. Validation provenance, walk-forward/OOS, evidence, maturity, conservative drawdown, runbook, and every other existing gate remain independent.

## Operator Workflow

1. Run validation on the active canonical MT5 research identity.
2. Run Research Quality.
3. Inspect context-evaluation coverage and exposed/comparator rates before changing a model.
4. If context coverage is below 90%, add compact pre-entry state telemetry; do not tune blindly.
5. If a direct cause dominates lost R, test only that exclusion in a new candidate profile.
6. Compare the candidate with the frozen baseline using the same chronological OOS and cost model.

Authority is always `none / none / none`.
