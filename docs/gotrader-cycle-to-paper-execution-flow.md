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

    Q -. "separate readiness boundary" .-> BA["Broker adapter readiness probe"]
    BA --> BB["TopstepX auth + allowlisted account + MNQ contract check"]
    BB --> BC["Compact readiness status; no credentials or account data persisted"]
    BC --> BD["Submission locked: TopstepX has no sandbox"]

    Y["TopstepX order adapter"]:::disabled
    Z["Live account"]:::disabled
    BD -. "not connected" .-> Y
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

## Broker Adapter Readiness Boundary

The sibling `go-trader` repository now contains `shared_scripts/gotrader_broker_adapter.py`. It provides a non-network local demo adapter and a TopstepX readiness probe that authenticates, verifies an allowlisted account, and resolves an active MNQ contract. It does not import the existing live adapter and cannot submit, cancel, modify, close, or reconcile broker state.

TopstepX currently has no sandbox, so a real broker-demo submission route cannot be made safe merely by setting `live: false` on contract search. Broker submission remains locked until an account class can be positively verified, the deterministic forward-evidence gate passes, and a separately reviewed gateway can submit protected orders and reconcile acknowledgements independently. Neither the LLM nor the research app can grant that permission.
