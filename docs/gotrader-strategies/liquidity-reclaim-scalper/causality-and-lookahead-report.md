# Causality And Lookahead Report

Status: passed focused deterministic fixtures.

The detector filters canonical facts by both causal closed-candle time and
`validFrom` at the requested market time. Future IFVG and future external-target
fixtures cannot affect the current candidate. Raid-less displacement/IFVG input
cannot skip the state machine. Candidate identity excludes receipt time,
runtime process identity, and UI state.

Covered adversarial cases include future IFVG, future liquidity objective,
missing raid, illegal state skips, terminal-state resurrection, and stable
logical identity. Broader certified-dataset replay remains a baseline operation,
not a prerequisite for the causal contract result.
