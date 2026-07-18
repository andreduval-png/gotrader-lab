# GoTrader Cycle To Paper Execution Flow

## Implemented Boundary

The implemented path follows this rule:

> The LLM proposes and initiates. GoTrader validates and sizes. The independent paper gateway simulates and monitors.

The final clause is deliberately paper-only today. The gateway has no broker imports, credentials, or live mode. Current IFVG v3 evidence remains `not_ready`, so no request is emitted until deterministic readiness and untouched forward-evidence gates pass.

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
    P --> Q["Independent go-trader paper gateway"]
    Q --> R["Revalidate hash, expiry, authority, source, profile, and risk"]
    R --> S{"Consumer checks pass?"}
    S -- "No" --> S1["Compact blocked receipt"]
    S -- "Yes" --> T["Read closed candles from MT5 read-only wrapper"]
    T --> U["Simulate limit fill"]
    U --> V["Monitor stop / target / expiry"]
    V --> W["Compact paper outcome receipt"]
    W --> X["Forward evidence and Results surfaces"]
    X --> F

    Y["Broker adapter"]:::disabled
    Z["Live account"]:::disabled
    Q -. "not connected" .-> Y
    Y -. "disabled" .-> Z

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

## Future Broker-Demo Boundary

A real broker-demo gateway is not implemented by this change. It must be a separately reviewed service that independently revalidates the same deterministic approval, uses demo-only credentials, reconciles acknowledgements and positions, and fails closed on disconnect. Live execution requires a later explicit authorization project; neither the LLM nor this paper gateway can grant it.
