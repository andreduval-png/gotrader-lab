# G1.1 Strategy Geometry Matrix

| Strategy | Entry owner | Stop owner | Target owner | R:R owner before G1.1 | Observed fallback or risk |
| --- | --- | --- | --- | --- | --- |
| IFVG | IFVG detector/profile | IFVG invalidation | detector liquidity objective | shared absolute-distance helper | advisor completion when native facts absent |
| Silver Bullet | Silver Bullet detector | sweep/FVG invalidation | detector directional liquidity | detector/shared helper | generic completion remains possible |
| Turtle Soup | Turtle Soup detector | raid/swing invalidation | reversal objective | trade-construction helper | generic completion remains possible |
| CISD | CISD detector | structural invalidation | directional objective | shared helper | generic completion remains possible |
| CMD | CMD detector/profile | displacement invalidation | directional liquidity | shared helper | advisor nearest target completion |
| Nasdaq London Raid | phase-two detector | raid extreme | session liquidity | shared helper | advisor completion |
| OSOK | phase-two detector | model invalidation | nearest draw helper | shared helper | nearest target is explicit in current code |
| Bread & Butter | phase-two detector | model invalidation | directional draw | shared helper | advisor completion |
| Order Block Retracement | order-block detector | block/recent swing invalidation | nearest directional draw | shared absolute-distance helper | nearest draw can be too close |
| ICT 2022 | accepted I2 adapter | accepted I2 invalidation | canonical external draw | I2 adapter/BT2 | explicit canonical target semantics |
| Power of Three | accepted I2 adapter | manipulation invalidation | profile objective | I2 adapter/BT2 | profile semantics must be retained |
| Liquidity Reclaim Scalper | preregistered R1 profile | structural reclaim invalidation | external liquidity | bounded R1 implementation | no generic override is authorized |
| SMT | eligibility/confluence only | none | none | none | must not move geometry generically |

The strategy owns intent. The G1.1 canonical service owns directional validity,
distance, theoretical R:R, identity, and actionability. Current Read, Current
Opportunity, UI, MCP, and BT2 must project the same intended values.

