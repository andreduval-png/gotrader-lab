# GoTrader Paper-Demo Preparation Gateway

## Boundary

The local gateway is the second safe phase of the GoTrader control plane:

1. An LLM may propose a compact scenario through MCP.
2. GoTrader validates the scenario and computes an operator-owned paper-sizing preview.
3. The Paper-Demo gateway may prepare that scenario after every deterministic gate passes.
4. GoTrader writes one hashed, immutable paper request to `.gotrader/paper-demo-outbox`.
5. The independent `go-trader` paper consumer revalidates the request, simulates fills from MT5 read-only candles, and writes compact receipts to `.gotrader/paper-demo-receipts`.
6. An optional, separately enabled MT5 demo handoff may also be written after those same gates pass.
7. The sibling independent MT5 gateway must then verify an exact allowlisted demo account and its own risk policy before any protected pending order can be submitted.

The browser and research gateway do not expose account, order, position, cancellation, closing, or broker-mutation tools. The independent MT5 gateway owns the narrow demo broker operation. Research authority is always:

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
```

## Default State

The gateway fails closed:

- `GOTRADER_PAPER_DEMO_GATEWAY_ENABLED` is not `true`.
- The kill switch is active unless explicitly set to `false`.
- Daily loss and request limits are unconfigured.
- Paper sizing is unconfigured.
- Missing readiness or untouched forward evidence blocks preparation.

An LLM cannot change these settings through MCP.

## Required Operator Configuration

These settings enable only local paper request preparation:

```powershell
cd "C:\Users\andre\OneDrive\Documents\gotrader"

$env:GOTRADER_PAPER_DEMO_GATEWAY_ENABLED="true"
$env:GOTRADER_PAPER_DEMO_KILL_SWITCH="false"
$env:GOTRADER_PAPER_MAX_DAILY_LOSS_R="4"
$env:GOTRADER_PAPER_MAX_REQUESTS_PER_DAY="3"
$env:GOTRADER_PAPER_SIGNAL_MAX_AGE_MS="300000"

$env:GOTRADER_PAPER_RISK_BUDGET_USD="300"
$env:GOTRADER_PAPER_POINT_VALUE_USD="2"
$env:GOTRADER_PAPER_MAX_UNITS="5"

$env:GOTRADER_PAPER_DEMO_OUTBOX_DIR=".gotrader/paper-demo-outbox"
$env:GOTRADER_PAPER_DEMO_RECEIPT_DIR=".gotrader/paper-demo-receipts"

npm.cmd run mcp:trade-proposal
```

Configuration does not bypass evidence gates. The current IFVG v3 validation report is `not_ready`, so the gateway remains blocked even when these variables are configured.

## Evidence Inputs

The gateway reads GoTrader-generated compact evidence rather than trusting LLM claims:

- Validation report: `.gotrader/ifvg-v3-profile-oos.json`
- Untouched forward-evidence report: `.gotrader/ifvg-v3-forward-evidence.json`

Paths can be changed with:

```powershell
$env:GOTRADER_PAPER_VALIDATION_REPORT=".gotrader/ifvg-v3-profile-oos.json"
$env:GOTRADER_PAPER_FORWARD_EVIDENCE_REPORT=".gotrader/ifvg-v3-forward-evidence.json"
```

Paths must remain inside the repository. Raw candle arrays are neither copied into gateway state nor returned through MCP.

### Exporting Browser-Collected Forward Evidence

The IFVG v3 frozen-profile card includes **Export gateway evidence**. The downloaded report contains only the compact deterministic evaluation; it excludes ledger entries, raw candles, accounts, orders, positions, and secrets.

Import the downloaded report into the local validator with:

```powershell
cd "C:\Users\andre\OneDrive\Documents\gotrader"
npm.cmd run import:forward-evidence -- "C:\Users\andre\Downloads\ifvg-v3-forward-evidence.json"
```

The importer validates the report contract, frozen profile identity, disabled auto-promotion, and authority `none/none/none` before writing `.gotrader/ifvg-v3-forward-evidence.json`. Importing evidence does not grant readiness.

## Required Gates

A preparation is blocked unless all checks pass:

- safe MCP proposal
- canonical `mt5_read_only / MNQ / USTECH / 5m` identity
- allowlisted frozen strategy profile
- valid entry, stop, target, and minimum 2R geometry
- operator-owned paper sizing configured
- proposal no older than the configured freshness window
- completed validation report
- exact validation binding derived from the same report
- exact source-fingerprint equality between proposal and validation evidence
- passed walk-forward/OOS verdict
- at least 30 validation trades
- at least 20 validation dates
- at least two active rolling windows
- strong Monte Carlo robustness
- deterministic Paper-Demo readiness granted
- at least 40 causally verified untouched forward outcomes
- at least 20 forward dates and two forward windows
- forward recommendation `reassess_for_paper_demo`
- kill switch inactive
- daily loss and preparation-count limits available
- authority none/none/none throughout

## Idempotency And State

The compact state file is `.gotrader/paper-demo-gateway-state.json`. A proposal and authoritative validation-binding pair can be prepared once per day. Repeated requests return `already_prepared` and do not create duplicates. MCP preparation calls are serialized with a local process lock, and state replacement is atomic.

Each passed preparation creates one `gotrader.paper_demo_execution_request` document. Its SHA-256 hash covers the complete request payload. A retry with identical content returns `already_queued`; a request ID collision with different content is rejected. Atomic rename prevents the consumer from reading a partially written request.

State contains only scenario geometry, sizing preview, timestamps, compact IDs, status, and authority. It excludes raw candles, runtime snapshots, credentials, account data, orders, positions, and broker responses.

## MCP Tools

- `gotrader_paper_demo_gateway_status`
- `gotrader_prepare_paper_demo_simulation`
- `gotrader_list_paper_demo_receipts`

The preparation tool can return:

- `blocked`
- `already_prepared`
- `prepared_for_local_paper_simulation_review`

None of these statuses means a broker order was submitted. Every result returns `brokerSubmissionAttempted: false`. See `docs/gotrader-cycle-to-paper-execution-flow.md` for the complete process diagram and the `go-trader` paper-consumer command.

## Future Broker-Demo Phase

Broker-demo submission remains a separate future phase. The current paper consumer cannot import or call broker adapters. Broker-demo requires a new reviewed contract, demo-only credentials outside frontend storage, acknowledgements, reconciliation, disconnect lockout, cancellation policy, and independent monitoring. Live execution remains out of scope.
