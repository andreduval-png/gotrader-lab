# MT5 Execution Adapter Plan

## Role

MT5 is GoTrader's primary demo execution adapter for MNQ-style USTECH research, forex, and CFDs. Broker operations live in a separate local Python gateway, never in the browser or research process.

The app uses the MT5 read-only wrapper for market data. It can emit a compact hashed demo handoff only after every deterministic readiness and untouched forward-evidence gate passes. The independent gateway then verifies the local MT5 terminal is connected to an exact allowlisted demo account before it can submit one protected pending order.

## Source Repo Findings

The inspected MetaTrader MCP repo supports MT5 account information, real-time symbol prices, historical candles, symbol metadata, order placement, position modification, pending orders, closing positions, history, REST API, MCP transports, and websocket quote streaming.

Because it includes direct order and position authority, it must remain behind GoTrader:

- Strategy Evaluator
- Risk Manager
- Broker Router
- Readiness Gate
- Journal/provenance system
- account mode gate

## Current Status

Implemented:

- MT5 route adapter result contract
- demo-gateway-available/live-locked adapter status
- blocked dry-run intent helper
- no credential fields
- canonical MT5 read-only data source
- immutable demo handoff outbox
- independent demo-account verification, risk sizing, protected pending order, and reconciliation gateway
- no credentials in GoTrader
- live accounts hard blocked
- no direct browser, LLM, OpenClaw, or research-process order path

## MT5 Demo Flow

1. GoTrader produces StrategyCandidate.
2. Risk Manager approves only after all checks.
3. Broker Router routes MNQ-style futures research, forex, and CFDs to MT5.
4. GoTrader writes a demo handoff only after readiness and forward-evidence gates pass.
5. The independent gateway validates the hash, source, profile, expiry, demo account, login/server allowlists, symbol, and risk policy.
6. The gateway independently sizes and submits one protected demo pending order.
7. Compact reconciliation receipts are journaled without raw account/order/position data.

## Required Guardrails

- no MT5 credentials in frontend
- no MT5 credentials in journal records
- no raw broker responses in OpenClaw packets
- no order placement without RiskDecision approval
- no execution if readiness gate blocks
- no execution if account mode is research
- no execution if symbol route is unsupported

## Still Locked Or Deferred

- live-account submission
- emergency flatten/close automation
- multi-position portfolios
- TopstepX and Tradovate routing
- readiness overrides
