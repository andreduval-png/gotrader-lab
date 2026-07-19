# GoTrader Cycle To Paper Execution Flow

## Implemented Boundary

The implemented path follows this rule:

> The LLM proposes and initiates. GoTrader validates and sizes. The independent MT5 gateway executes and monitors on a positively verified demo account.

The independent paper simulator remains the first outcome lane. A separate MT5 gateway can submit only protected demo pending orders and monitor their state. It rejects live accounts, defaults disabled, and has its own kill switch, exact account/server allowlists, risk sizing, one-active-order policy, immutable request validation, and reconciliation. Current IFVG v3 evidence remains `not_ready`, so no MT5 request is emitted until deterministic readiness and untouched forward-evidence gates pass.

## Process Diagram

```mermaid
flowchart TD
    A["Operator starts research cycle"] --> B["MT5 read-only canonical candles"]
    B --> C["Market reconstruction and HTF context"]
    C --> D["ICT detector and current-read evaluation"]
    D --> E{"Complete scenario?"}
    E -- "No" --> E1["No-trade / research blocker / hypothesis queue"]
    E -- "Yes" --> F["Replay validation"]
    F --> G["Frozen chronological walk-forward / OOS"]
    G --> H["Evidence, maturity, and Monte Carlo"]
    H --> I["Research Committee and readiness checklist"]
    I --> J{"Paper-Demo gates pass?"}
    J -- "No" --> J1["Collect independent forward outcomes"]
    J1 --> F
    J -- "Yes" --> K["LLM or operator submits compact MCP proposal"]
    K --> L["GoTrader validates payload, source identity, profile, geometry, and freshness"]
    L --> M{"Deterministic checks pass?"}
    M -- "No" --> M1["Blocked audit receipt"]
    M -- "Yes" --> N["GoTrader computes operator-owned paper sizing"]
    N --> O{"Kill switch and paper risk policy pass?"}
    O -- "No" --> O1["Blocked; no request emitted"]
    O -- "Yes" --> P["Atomic SHA-256 paper request outbox"]
    P --> Q["Independent paper simulator"]
    Q --> R["Revalidate hash, expiry, authority, source, profile, and risk"]
    R --> S["Simulate and monitor from MT5 read-only candles"]
    S --> T["Compact paper outcome receipt"]
    T --> U["Forward evidence and Results surfaces"]
    U --> F

    O -- "Yes + explicit demo handoff" --> BA["Atomic SHA-256 MT5 demo request outbox"]
    BA --> BB["Independent MT5 Python gateway"]
    BB --> BC{"Demo mode, exact login/server, symbol, risk, freshness, and hash pass?"}
    BC -- "No" --> BD["Compact blocked receipt; no order"]
    BC -- "Yes" --> BE["Recompute volume from MT5 tick metadata"]
    BE --> BF["order_check protected non-crossing pending order"]
    BF --> BG["Submit entry + stop + target + expiry atomically"]
    BG --> BH["Reconcile pending, fill, close, cancel, or expiry"]
    BH --> BI["Compact MT5 demo receipt"]
    BI --> U

    Y["Live MT5 account"]:::disabled
    Z["TopstepX / Tradovate adapters"]:::disabled
    BC -. "hard rejected" .-> Y
    Z -. "future options; no fallback" .-> BB

    classDef disabled fill:#2b1f25,stroke:#d36b83,color:#f1c5cf,stroke-dasharray: 5 5;
```

## Independent Consumer

From the sibling execution-engine repository:

```powershell
cd "C:\Users\andre\OneDrive\Documents\go-trader"

$env:GOTRADER_PAPER_CONSUMER_ENABLED="true"
$env:GOTRADER_PAPER_CONSUMER_KILL_SWITCH="false"
$env:GOTRADER_PAPER_CONSUMER_MAX_DAILY_LOSS_R="4"
$env:GOTRADER_PAPER_CONSUMER_MAX_ACTIVE="1"

python shared_scripts/gotrader_paper_gateway.py `
  --request-dir "C:\Users\andre\OneDrive\Documents\gotrader\.gotrader\paper-demo-outbox" `
  --receipt-dir "C:\Users\andre\OneDrive\Documents\gotrader\.gotrader\paper-demo-receipts" `
  --state-file "local\gotrader-paper-gateway-state.json" `
  --mt5-wrapper-url "http://127.0.0.1:7341"
```

The default policy is disabled with the kill switch active and zero risk capacity. The consumer only issues HTTP GET requests to the MT5 read-only wrapper. Ambiguous candles that touch both stop and target resolve to the stop, and the entry candle is not used to claim an outcome because intrabar ordering is unknown.

## MT5 Demo Broker Boundary

The sibling `go-trader` repository contains `shared_scripts/gotrader_mt5_demo_gateway.py`. It is the only GoTrader component allowed to import `MetaTrader5`. It consumes the compact MT5 demo outbox, verifies the local terminal is logged into an exact allowlisted demo account and server, independently sizes the request, sends one protected pending order, and reconciles compact status receipts.

Live MT5 accounts are hard blocked. TopstepX and Tradovate remain future options and are not automatic fallbacks. Neither the LLM nor the research app can grant broker authority, change the demo-account requirement, bypass risk checks, or promote readiness.

See the exact setup and operator commands in the sibling repository at `docs/gotrader-mt5-demo-gateway.md`.

The normal `Start-GoTrader.cmd` supervisor starts research and read-only services only. It deliberately does not auto-start the broker-capable MT5 demo gateway. Starting that process requires the separate explicit demo-account configuration and probe described in the runbook.
