# G2.1 Source Resolution Ledger

## Bread & Butter

Accepted Charter 11 and 12 packets establish expansion context, an IRL/PD-array retracement, structural retracement-swing invalidation, and a daily ERL or profile-bounded objective. They do not establish deterministic precedence among multiple eligible FVG, order-block, void, or other PD-array entries. I4 also establishes that an IRL-to-ERL transition alone has no accepted entry/invalidation contract.

| Rule | Classification | Disposition |
| --- | --- | --- |
| Weekly/daily directional expansion context | `SOURCE_DEFINED` | Preserve as context. |
| Entry on retracement to an internal PD array | `SOURCE_DEFINED` | Require canonical PD-array identity. |
| Exact PD-array precedence and price policy | `UNRESOLVED` | `BREAD_AND_BUTTER_PD_ARRAY_PRECEDENCE_SOURCE_BLOCKED`. |
| Stop beyond structural retracement swing | `SOURCE_DEFINED` | Require structural swing identity; recent-eight-bar fallback prohibited. |
| Daily ERL / old daily high-low objective | `SOURCE_DEFINED` | Require canonical objective identity; nearest generic pool prohibited. |
| 20/30-pip bounds | `RESEARCH_PARAMETER` | Cannot replace structural geometry. |
| Existing midpoint/recent-bars/nearest-pool completion | `LEGACY_COMPATIBILITY` | Removed from B&B publication. |

Charter 11 and 12 inherit the source block losslessly. They do not reconstruct geometry downstream.

## One Shot One Kill

The accepted Charter 9 packet establishes a planned weekly objective, a directionally aligned PD-array retracement during the planned opportunity, structural invalidation, and weekly expiry. The compact Phase 2 detector does not carry canonical weekly-objective, PD-array, or structural-invalidation identities.

| Rule | Classification | Disposition |
| --- | --- | --- |
| Predetermined weekly draw/objective | `SOURCE_DEFINED` | Require canonical weekly objective identity. |
| Planned-opportunity PD-array retracement | `SOURCE_DEFINED` | Require canonical entry fact identity. |
| Structural invalidation | `SOURCE_DEFINED` | Require canonical structural source identity. |
| Existing OB midpoint then FVG midpoint fallback | `LEGACY_COMPATIBILITY` | Removed from OSOK publication. |
| Existing recent-eight-bar stop fallback | `LEGACY_COMPATIBILITY` | Removed from OSOK publication. |
| Existing nearest-pool objective | `LEGACY_COMPATIBILITY` | Removed from OSOK publication. |

Charter 9 remains an alias of OSOK and inherits this source gate. No duplicate strategy exists.

## Power of Three

The accepted I2 source packet defines FVG midpoint/confirmation entry, manipulation-extreme stop, and opposite external liquidity as the base objective. A single eligible external-liquidity fact is source-complete. Fact-array order is not target precedence.

| Rule | Classification | Disposition |
| --- | --- | --- |
| Opposite external liquidity base objective | `SOURCE_DEFINED` | Use only when exactly one eligible external objective exists. |
| Precedence among multiple eligible external objectives | `UNRESOLVED` | `PO3_TARGET_PRECEDENCE_SOURCE_BLOCKED`. |
| HOD/LOD profile identity | `CANONICAL_GOTRADER_RULE` profile, incomplete fact binding | `PO3_HOD_LOD_OBJECTIVE_IDENTITY_SOURCE_BLOCKED`. |
| Highest-R:R or farthest-target ranking | `SOURCE_CONFLICT` | Prohibited. |

No performance result, current implementation behavior, or R:R threshold was used to fill an unresolved rule.

