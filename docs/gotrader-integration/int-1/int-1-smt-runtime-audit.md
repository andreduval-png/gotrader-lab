# INT-1 SMT Runtime Audit

The SMT implementation can compare USTECH/US100, US500/SPX proxy, and US30 when aligned comparison candles are supplied. The active runtime does not guarantee that all three feeds are loaded for every cycle; full live SMT wiring is therefore `PARTIAL`.

Missing comparison data is `insufficient_data`/neutral, never confirmation. Profiles that define opposing SMT as a blocker retain that blocker. Compact SMT evidence excludes raw cross-market candle arrays.
