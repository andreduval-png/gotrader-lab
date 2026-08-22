# G2.2 Geometry Freeze Record

- Freeze identity: `gotrader-canonical-trade-geometry-v1`
- Status: `G2.2 PASSED WITH DOCUMENTED NON-ACTIONABLE LEGACY LIMITATIONS`
- Accepted baseline commit: `7b7e912bf043a54dd4bbf823b79fb9c259d05b7f`
- Accepted baseline tree: `5c40ccfec11ddaf98f30e1d2ed11ae9d0d8521d7`
- Pre-freeze certification commit: `c6571c9201ae494fc8dcf0165b92db384a799fab`
- Pre-freeze certification tree: `3b1345f923bb17095a3ca60da94137a7d45d4ba5`
- G1.1 implementation version: `g1.1.1`
- Schema: `gotrader.trade-geometry.v1`
- Producer inventory SHA-256: `16fbd6ba5289deccb7daf0983de56e9301c5b33f90f25337f5380f28a2a2f4bc`
- Static construction scan SHA-256: `8fdcfd7caeb81bcf287fb6baa22d1dc22c985384deb360bc9c014038259d025d`
- Executable certification SHA-256: `3664fc252f538b2eb4219d0227cd9ef358a821da4db740aea8648121dc18110a`
- Producer entries: 23
- Canonical direct: 5
- Canonical lossless adapters: 10
- Source blocked: 5
- Non-executable: 3
- Actionable legacy numeric: 0
- Downstream actionable constructors: 0
- BT2 parity: passed for G1.1, I2, I3, and Charter adapters
- Browser acceptance: passed with deterministic fixture coverage
- Historical acceptance: deferred
- Authority: `none/none/none`

## Frozen Contract

An executable strategy/profile selects native entry, structural stop, primary target, declared intermediate targets, fallback policy, and expiry from causal canonical facts. G1.1 validates and seals that intent. All downstream systems consume the sealed geometry unchanged. Failure to establish source-native geometry produces source blocked, geometry incomplete, and no trade.

## Known Limitations

- advisor-era replay is legacy diagnostic and migration-pending;
- configurable legacy walk-forward/backtest geometry is not authoritative canonical validation;
- replay and phase-2 generated smoke harnesses have isolated module-resolution defects;
- the legacy MCP numeric proposal validator remains non-executable;
- existing Rollup warnings remain unrelated.

No limitation can create or modify canonical actionable geometry. The freeze artifact cannot self-reference its own commit hash; the final handoff records the commit and tree containing this record.
