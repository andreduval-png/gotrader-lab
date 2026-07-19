# GoTrader Trade-Proposal MCP

## Purpose

This local MCP implements the first safe slice of the operating model:

> The LLM proposes and initiates. GoTrader validates and sizes. The broker gateway executes and monitors.

Codex or Claude may submit a compact research proposal and initiate deterministic validation. GoTrader validates source identity, profile allowlisting, price geometry, minimum RR, safety fields, and an operator-owned paper sizing preview. A second fail-closed gate may prepare a proposal only after readiness and untouched forward-evidence gates pass. With a separate operator opt-in, it may also write an immutable MT5 demo handoff for the independent gateway; the MCP itself cannot call MT5.

## Current Boundary

- Stage: `research_validation`
- Allowlisted profile: `ifvg_fresh_retest_v3_research`
- Canonical source: `mt5_read_only`
- Research identity: `MNQ` requested label, `USTECH` broker symbol, `5m`
- Validation-chain reference: required, but resolved by GoTrader before progression
- Paper sizing: preview only and disabled until the operator configures its local policy
- MT5 demo handoff: disabled by default with a default-active kill switch
- Live MT5 gateway: unavailable
- Execution authority: `none`
- Broker authority: `none`
- Readiness override authority: `none`

The MCP does not expose tools for accounts, orders, positions, broker mutation, cancellation, closing, or execution.

## Tools

### `gotrader_control_plane_status`

Returns the active policy, allowlisted profiles, sizing-policy state, disabled gateway state, and authority contract.

### `gotrader_propose_trade_evaluation`

Accepts a compact proposal containing:

- `requestedSymbol`
- `brokerSymbol`
- `timeframe`
- `strategyProfileId`
- `direction`
- `entry`
- `stop`
- `targets`
- `sourceProvider`
- `sourceFingerprint`
- `validationChainId`
- optional compact `rationale`

Safe proposals are recorded as `queued_for_deterministic_validation`. This is not readiness, Paper-Demo approval, or permission to submit an order.

### `gotrader_list_recent_trade_proposals`

Returns up to 20 compact audit entries from `.gotrader/mcp-trade-proposals.jsonl`. The ledger excludes candles, runtime snapshots, credentials, account data, orders, and positions.

### `gotrader_paper_demo_gateway_status`

Returns operator opt-in, kill-switch, evidence, paper-simulator, and MT5 demo-handoff status.

### `gotrader_prepare_paper_demo_simulation`

Attempts to prepare a safe proposal for local paper review. It independently checks GoTrader-generated validation and forward evidence, freshness, idempotency, sizing, daily limits, and the kill switch. When the separate MT5 demo handoff policy is enabled, it may write a compact request file; only the independent gateway can verify the demo account and submit it.

### `gotrader_list_mt5_demo_receipts`

Returns compact MT5 demo gateway status receipts for monitoring. It exposes request identity, scenario geometry, hashed source identity, compact ticket/volume, status, blockers, and the research authority contract. It rejects receipts containing credentials, balances, raw broker responses, candles, account records, or broker state lists.

## Codex CLI Setup

From PowerShell:

```powershell
cd "C:\Users\andre\OneDrive\Documents\gotrader"
codex mcp add gotrader-trade-proposal -- node "C:\Users\andre\OneDrive\Documents\gotrader\scripts\gotrader-trade-proposal-mcp.mjs"
codex mcp list
```

Restart the Codex CLI session after adding the server. The server uses stdio and does not listen on a network port.

For Claude Desktop or another MCP host, configure the same `node` command and absolute script path in that host's local MCP server configuration.

## Optional Paper Sizing Preview

Sizing values are operator-owned environment settings; an LLM cannot supply or override them:

```powershell
$env:GOTRADER_PAPER_RISK_BUDGET_USD="300"
$env:GOTRADER_PAPER_POINT_VALUE_USD="2"
$env:GOTRADER_PAPER_MAX_UNITS="5"
```

When all three values are configured, GoTrader returns a deterministic `paperUnitsPreview`. The result always has `executable: false` in this phase.

## Rejected Content

The validator rejects raw candle arrays, raw snapshots, screenshots/base64, secrets, API keys, tokens, MT5 credentials, account/order/position data, broker mutation, execution requests, readiness overrides, auto-apply, non-none authority, and imperative order-placement language.

Frozen profiles cannot be mutated through MCP. Any parameter change requires a new candidate profile version and the normal replay, walk-forward, OOS, evidence, maturity, and Paper-Demo gates.

## Paper-Demo Preparation

See `docs/gotrader-paper-demo-gateway.md` for the opt-in environment settings and deterministic gates. The current IFVG v3 report remains `not_ready`, so preparation is expected to stay blocked until untouched forward evidence and readiness review pass.

## Future Phase

GoTrader now owns compact validation-report lookup, operator paper-risk settings, idempotency, stale-signal rejection, a kill switch, and daily preparation limits. These controls currently end at local Paper-Demo preparation.

The independent MT5 gateway now implements demo-account verification, protected pending-order submission, acknowledgement, expiry cancellation, reconciliation, and compact receipts behind a separate explicit opt-in. It remains GoTrader-controlled; an LLM may request evaluation but may not grant authority or bypass policy.

Live execution remains out of scope until independent forward evidence and Paper-Demo operations prove the full lifecycle.
