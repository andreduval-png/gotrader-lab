# I0 Strategy Model Audit

## Complete Models

| Model | Status | Key limitation |
| --- | --- | --- |
| Silver Bullet v1/v2 | FULLY_IMPLEMENTED | Research evidence only; v2 sample remains small |
| IFVG v1-v4 | FULLY_IMPLEMENTED | v2 is a negative control; v3/v4 require forward evidence |
| Turtle Soup v1 | FULLY_IMPLEMENTED | Strict false-break model |
| CISD v1 | FULLY_IMPLEMENTED | Research-only |
| CMD high-displacement v2 | FULLY_IMPLEMENTED | Experimental profile |
| Nasdaq London raid / NY reversal v1/v2 | FULLY_IMPLEMENTED | Source-specific session model |
| Bread and Butter buy/sell | FULLY_IMPLEMENTED | Legacy engine with separately accepted BT3 adapter coverage |
| One Shot One Kill | FULLY_IMPLEMENTED | Legacy engine with separately accepted BT3 adapter coverage |
| Liquidity Reclaim Scalper v1 | FULLY_IMPLEMENTED | Accepted-unintegrated; R1 research family not yet accepted |

## Partial Or Context Models

| Model | Status | Required work |
| --- | --- | --- |
| ICT 2022 model | PARTIAL | Components exist, but no authoritative, versioned end-to-end strategy contract |
| OTE strategy | PLACEHOLDER | Define setup sequence, geometry, expiry, blockers, fixtures, and BT2 adapter |
| Judas swing | CONCEPT_ONLY | Mentions/source material only; no registered deterministic model |
| Power of Three / AMD | PARTIAL | Session and Model One components exist; catalog strategy is intentionally non-executable |
| MMBM / MMSM / MMXM | MISSING | No canonical model definitions or detectors |
| Unicorn | MISSING | No canonical detector or source-bound model contract |
| Breaker plus FVG | PARTIAL | Primitive detectors exist but no registered composite model |
| Mitigation model | PARTIAL | Primitive classification exists, no complete setup contract |
| NDOG/NWOG | MISSING | No deterministic gap facts or strategy model |
| TGIF | MISSING | No deterministic strategy model |
| IRL to ERL / ERL to IRL | MISSING | Liquidity taxonomy and delivery transition contract absent |
| Generic PD array model | CONCEPT_ONLY | Recognition context cannot emit trade evidence |
| Generic scalp setup | CONCEPT_ONLY | A holding-period label is not a strategy |
| Cameron's model | PLACEHOLDER | Catalog vocabulary only |
| CRT | PLACEHOLDER | Catalog vocabulary only |
| Grinch Model One | IMPLEMENTED_BUT_NOT_RUNTIME_WIRED | Accepted policy is confluence-only, no standalone opportunity |
| Grinch reversal expansion | IMPLEMENTED_BUT_NOT_RUNTIME_WIRED | Confluence-only |
| Grinch consolidation | IMPLEMENTED_BUT_NOT_RUNTIME_WIRED | Confluence-only |

## Model Completeness Test

A complete strategy model must define all of the following without borrowing UI prose:

1. Stable strategy and profile IDs plus immutable parameter hash.
2. Supported symbols, timeframes, session clock, and source requirements.
3. Required canonical facts and exact causal availability rules.
4. Ordered setup state machine, direction, entry, invalidation, target, expiry, and blockers.
5. Fail-closed behavior for missing, stale, conflicting, or forming facts.
6. Compact candidate identity and provenance with no raw candles.
7. Canonical adapter preserving native geometry.
8. BT2 request identity with BT2 ownership of fills, costs, ambiguity, and outcomes.
9. Deterministic positive, negative, edge, restart, and lookahead fixtures.
10. Explicit authority `none/none/none` and no implicit readiness or promotion.

Concept recognition, a confluence score, a named chart pattern, or a catalog row is insufficient.

## Parameter Governance

- `FROZEN`: accepted IFVG profiles, accepted LRS base profile, and any accepted strategy snapshot.
- `VERSIONED_RESEARCH`: separately authorized variants with preregistered bounds and immutable hashes.
- `CONTEXT_POLICY`: C1/C1.1 narrative allowances and optional/opposing SMT policy; these cannot mutate strategy geometry.
- `FIXTURE_ONLY`: thresholds used solely to prove deterministic detector behavior.
- `UNAUTHORIZED`: adaptive tuning, observed-result parameter mutation, holdout use, and implicit profile promotion.
