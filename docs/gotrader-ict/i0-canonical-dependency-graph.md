# I0 Canonical Dependency Graph

```mermaid
flowchart TD
  A["Certified closed-candle source"] --> B["Canonical timestamped facts"]
  B --> L["Liquidity: pools, IRL, ERL, sweeps, reclaim"]
  B --> S["Structure: swings, BOS, MSS, CISD"]
  B --> I["Imbalance: FVG, IFVG, BPR, void"]
  B --> O["Blocks: OB, breaker, mitigation"]
  B --> T["Time: sessions, killzones, macros, NDOG, NWOG"]
  B --> R["Range: dealing range, equilibrium, premium/discount"]
  L --> D["Draw and delivery context"]
  S --> D
  I --> D
  O --> D
  T --> D
  R --> D
  D --> C1["C1/C1.1 narrative"]
  D --> S1["S1 SMT artifact"]
  D --> P["PD hierarchy"]
  L --> M2022["2022 model"]
  I --> M2022
  S --> M2022
  R --> OTE["OTE model"]
  I --> OTE
  T --> PO3["PO3 / AMD / Judas"]
  L --> PO3
  S --> PO3
  D --> MM["MMBM / MMSM / MMXM"]
  I --> U["Unicorn / Breaker+FVG"]
  O --> U
  T --> G["NDOG / NWOG / TGIF"]
  L --> X["IRL-to-ERL / ERL-to-IRL"]
  I --> X
  C1 --> Q["Registered strategy detector"]
  S1 --> Q
  P --> Q
  M2022 --> Q
  OTE --> Q
  PO3 --> Q
  MM --> Q
  U --> Q
  G --> Q
  X --> Q
  Q --> C["Immutable candidate and native geometry"]
  C --> AD["Lossless canonical adapter"]
  AD --> BT2["BT2 fills, costs, ambiguity, outcome"]
  BT2 --> E["Identity-bound evidence"]
  E --> UI["Results / Current Read / Advisor"]
```

## Shared Dependency Estimate

I1 has eight shared ownership packages: time identity, swing/structure, liquidity/IRL/ERL, imbalance, block taxonomy,
dealing-range/PD hierarchy, C1 projection contract, and S1 projection contract. A ninth cross-cutting package is the
strategy model/adapter identity contract. Reusing these nine packages avoids detector forks across roughly twenty
requested model names.

## Boundary Rules

- Facts are closed-candle causal and expose validFrom/confirmedAt where recognition needs later candles.
- C1/C1.1 provides structuralBias, currentFlowDirection, setupMaturationDirection, retracementState,
  continuationState, and liquidity path. Strategies declare policy; they do not rebuild flat timeframe voting.
- S1 is the only SMT owner. Models declare disabled, optional, required, or opposing-blocks.
- Strategies own detection, state progression, blockers, expiry, and geometry intent.
- Adapters are lossless and fail closed. BT2 owns fills, spread, slippage, commission, same-bar ordering, and outcome.
- Evidence and UI may not repair, override, or reinterpret a detector identity.

## Critical Path

Canonical time/swing/liquidity identity precedes IRL/ERL, opening-gap models, 2022, PO3, MMXM, and TGIF. Block and FVG
parity precedes Unicorn. Dealing-range parity precedes OTE. Charter work remains off the graph until source packets
resolve whether its labels map to existing nodes.
