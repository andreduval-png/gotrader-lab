# Simulation Account Risk Control Plane

## Purpose

GoTrader now places a deterministic simulation-account risk governor between a validated research proposal and the existing immutable Paper-Demo/MT5 demo outboxes.

The governor is a pre-dispatch safety boundary. It does not connect to MT5, read broker accounts, submit orders, or grant execution authority. Its sizing output is a simulation preview only. The independent MT5 demo gateway remains responsible for the final broker-aware decision.

## Boundary

```text
LLM or operator proposal
  -> GoTrader source/profile/geometry/readiness validation
  -> simulation account risk governor
  -> idempotent simulation risk reservation
  -> immutable paper outbox
  -> optional immutable MT5 demo outbox
  -> independent MT5 demo gateway revalidation
  -> protected demo order or blocked receipt
```

Authority remains:

```json
{
  "executionAuthority": "none",
  "brokerAuthority": "none",
  "readinessOverrideAuthority": "none"
}
```

## Fail-Closed Defaults

- `GOTRADER_SIM_RISK_GOVERNOR_ENABLED` defaults to `false`.
- `GOTRADER_SIM_RISK_KILL_SWITCH` defaults to active.
- Missing limits or sizing metadata make the policy unavailable.
- Stale simulation-account snapshots block preparation.
- A risk decision cannot approve broker submission or live execution.
- The LLM cannot alter limits, clear the kill switch, or override the decision.

## Operator Configuration

Example research simulation configuration:

```powershell
$env:GOTRADER_SIM_RISK_GOVERNOR_ENABLED="true"
$env:GOTRADER_SIM_RISK_KILL_SWITCH="false"
$env:GOTRADER_SIM_ACCOUNT_ID="primary_simulation"
$env:GOTRADER_SIM_STARTING_EQUITY_USD="50000"
$env:GOTRADER_SIM_MAX_DAILY_LOSS_USD="2000"
$env:GOTRADER_SIM_MAX_OPEN_RISK_USD="600"
$env:GOTRADER_SIM_MAX_RISK_PER_SCENARIO_USD="200"
$env:GOTRADER_SIM_MAX_CONCURRENT_INTENTS="2"

# Simulation preview metadata only. MT5 must recompute final volume.
$env:GOTRADER_SIM_POINT_VALUE_USD="2"
$env:GOTRADER_SIM_VOLUME_MIN="1"
$env:GOTRADER_SIM_VOLUME_MAX="5"
$env:GOTRADER_SIM_VOLUME_STEP="1"
```

Optional policy controls:

- `GOTRADER_SIM_WARNING_DRAWDOWN_RATIO`, default `0.70`
- `GOTRADER_SIM_PRE_BREACH_DRAWDOWN_RATIO`, default `0.90`
- `GOTRADER_SIM_SNAPSHOT_MAX_AGE_MS`, default `30000`
- `GOTRADER_SIM_RISK_TIME_ZONE`, default `America/New_York`
- `GOTRADER_SIM_RISK_STATE_FILE`
- `GOTRADER_SIM_RISK_LEDGER_FILE`

## Risk States

- `monitoring`: capacity is available.
- `warning`: drawdown reached the warning ratio, but projected risk remains inside limits.
- `pre_breach`: drawdown is close to the daily limit; projected risk must still fit.
- `locked`: a current or projected limit is breached.
- `stale_data`: the simulation heartbeat is not fresh.
- `unavailable`: policy, snapshot, or authority is invalid.

An approval reserves risk against the simulation account using an idempotency key. Duplicate commands do not reserve twice. Compact outcomes may later settle a reservation in R units. State and ledger artifacts exclude candles, credentials, account records, orders, positions, and raw broker responses.

## MT5 Execution Requirements

The simulation preview is deliberately non-authoritative. Before any demo submission, the independent MT5 gateway must:

1. Confirm MT5 is connected to the exact allowlisted demo login and server.
2. Reject every live account.
3. Re-read a fresh terminal/account snapshot at dispatch.
4. Resolve the exact broker symbol and current tradability state.
5. Read tick size, tick value, contract size, volume minimum, volume maximum, and volume step.
6. Recompute volume from the approved maximum-risk envelope and stop distance.
7. Run a margin check and reject insufficient capacity.
8. Require a protected stop and target before submission.
9. Use the request hash, expiry, and idempotency key to prevent stale or duplicate submission.
10. Emit a compact receipt and continue reconciliation after acceptance.

The gateway must never trust `simulationVolumePreview`. A disagreement between GoTrader's preview and MT5 metadata is resolved by the stricter MT5-side result or a block.

## Contracts And Persistence

- `gotrader.simulation_account_risk_state`
- `gotrader.simulation_risk_command`
- `gotrader.simulation_risk_acknowledgement`
- `gotrader.simulation_risk_ledger_entry`

Default local artifacts:

- `.gotrader/simulation-account-risk-state.json`
- `.gotrader/simulation-account-risk-ledger.jsonl`

The Paper-Demo gateway status exposed through the trade-proposal MCP includes a compact `accountRiskGovernor` summary. It does not expose broker credentials or broker state.

## Safety Result

The risk governor can reject or reserve simulation risk. It cannot place a trade. The only future demo submission boundary remains the separately started MT5 gateway, which must independently enforce demo mode and broker-aware risk controls.
