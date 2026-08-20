# I2.1 Judas Swing Source Packet

Decision: `JUDAS_REMAINS_BLOCKED_SOURCE_SEMANTICS`.

## Sources

1. Direct source: The Inner Circle Trader, *ICT Forex - Understanding The ICT Judas Swing*, published 2017-12-10: https://www.youtube.com/watch?v=xJMbva8SjzE
2. Transcript aid: third-party transcription of that direct lesson: https://info.quagmyre.com/xwiki/bin/view/Forex/The-Inner-Circle-Trader/srt/ICT-Market-Maker-Primer-Course-12-Understanding-The-ICT-Judas-Swing-srt/
3. Secondary ambiguity check only: https://forum.ictsharks.com/t/ict-forex-market-maker-primer-course-understanding-the-ict-judas-swing/235

The transcript is an indexing aid, not an official publication. Where it contains the isolated phrase “5 p.m.”, the surrounding five-hour interval and later “5 a.m.” references establish midnight through 05:00 New York as the intended window.

## Classified Rules

| Rule | Classification | Resolution |
| --- | --- | --- |
| Target market/session | `SOURCE_DEFINED` | London-session FX teaching; do not silently generalize it to a Nasdaq NY-reversal model. |
| Session start | `SOURCE_DEFINED` | New York midnight. |
| Eligible setup window | `SOURCE_DEFINED` | 00:00 through 05:00 New York, with London delivery context. |
| Opening reference | `SOURCE_DEFINED` | New York midnight open. |
| Reference liquidity | `SOURCE_DEFINED` | The established Asian range high and low. |
| Initial/deceptive move | `SOURCE_DEFINED` | A false expansion in the direction opposite the higher-timeframe thesis that recruits traders and runs stops/key price levels. |
| Minimum manipulation | `SOURCE_DEFINED` | Price crosses the midnight open and preferably attacks the opposite Asian-range boundary before true delivery. |
| Raid requirement | `SOURCE_DEFINED` | Stop run or return to a key price level is part of the taught manipulation; the lesson does not define a numeric penetration. |
| Required side | `SOURCE_DEFINED` | Bullish thesis: sellside/Asian low; bearish thesis: buyside/Asian high. |
| Reversal confirmation | `UNRESOLVED` | Aggressive movement away is descriptive, but no deterministic close/threshold is specified. |
| MSS requirement | `SOURCE_DEFINED` | Not mandatory in this lesson. |
| Displacement requirement | `SOURCE_DEFINED` | Not a named mandatory gate; energetic/aggressive delivery is descriptive. |
| FVG requirement | `SOURCE_DEFINED` | Not mandatory in this lesson. |
| Entry condition | `UNRESOLVED` | A bullish example mentions entry just below the Asian low, but no symmetric, deterministic, confirmation-safe canonical rule is fully specified. |
| Stop condition | `UNRESOLVED` | “Respectable amount of pips” is not deterministic model invalidation. |
| Target condition | `UNRESOLVED` | The directional daily delivery is taught, but no exact canonical liquidity target is fixed. |
| Expiry | `CANONICAL_GOTRADER_RULE` | A later executable profile must expire at the accepted canonical session boundary without chasing. |
| SMT relevance | `CANONICAL_GOTRADER_RULE` | Optional S1-owned context only; the direct lesson does not require SMT. |
| HTF bias relevance | `SOURCE_DEFINED` | Mandatory directional premise; the false move is opposite the higher-timeframe thesis. |

## Disposition

The direct lesson resolves the session, opening reference, Asian-range context, directional thesis, and deceptive liquidity leg. It does not provide deterministic native geometry or an exact causal reversal trigger. Those are material executable fields, so GoTrader retains `ict_judas_swing_v1` as a distinct, non-executable source-blocked concept. No conventional MSS/FVG stack and no fixed-R target were substituted.
