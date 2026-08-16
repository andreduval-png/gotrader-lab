# I0 Canonical Dependency Graph

```mermaid
flowchart TD
  A["Certified or fresh read-only OHLCV"] --> B["Canonical closed-candle facts"]
  B --> B1["Structure: swings, BOS, MSS, CISD"]
  B --> B2["Liquidity: pools, sweep, reclaim, targets"]
  B --> B3["Imbalance: FVG, IFVG, BPR, void"]
  B --> B4["Blocks: OB, breaker, mitigation taxonomy"]
  B --> B5["Time: session, killzone, opens, news risk"]
  B1 --> C["Derived market context"]
  B2 --> C
  B3 --> C
  B4 --> C
  B5 --> C
  C --> C1["C1/C1.1 narrative context"]
  C --> C2["S1 SMT context"]
  C --> C3["PD hierarchy and draw context"]
  C1 --> D["Registered strategy detector"]
  C2 --> D
  C3 --> D
  D --> E["Immutable candidate: identity, side, geometry, blockers"]
  E --> F["Canonical strategy adapter"]
  F --> G["BT2 request"]
  G --> H["BT2 fills, costs, ambiguity, expiry, ledger seal"]
  H --> I["Identity-bound validation and research quality"]
  I --> J["Results / Current Read / Advisor presentation"]
```

## Boundary Rules

- Data adapters may normalize timestamps and symbols but may not create ICT direction.
- Canonical facts are timestamped and closed-candle causal.
- Context can block or qualify a setup; it cannot manufacture detector geometry.
- Strategy detectors own setup semantics and native entry/stop/target intent.
- Adapters are lossless and fail closed.
- BT2 owns simulation mechanics and ledger truth.
- Evidence binds strategy, profile, parameters, source, dataset/certificate, code, and run.
- Presentation reads immutable records and labels unavailable or historical data honestly.

## Current Dependency Gaps

- Duplicate fact implementations prevent a single canonical lineage across all strategies.
- C1/C1.1 adoption is limited to Current Read.
- S1 cannot supply accepted live/historical context until peer freshness/certification passes.
- Several strategy catalog rows terminate at recognition or placeholder layers.
- Results and readiness remediation remain separate product-integrity slices and are not solved by this audit.
