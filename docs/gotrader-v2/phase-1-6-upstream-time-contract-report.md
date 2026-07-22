# GoTrader V2 Phase 1.6 Upstream Time Contract Report

## 1. Starting State

- Worktree: `C:/Users/andre/OneDrive/Documents/gotrader-v2-phase0-baseline`
- Starting branch: `gotrader-v2/phase-1-5-mt5-time-normalization`
- Starting commit: `02ef325`
- Implementation branch: `codex/gotrader-v2-phase-1-6-upstream-time-contract`
- Implementation commit: this report ships with the Phase 1.6 implementation commit

## 2. Files

Phase 1.6 changes are limited to the read-only Python upstream, read-only wrapper/tool policy, V2 time/identity/candle shadow contracts, dedicated diagnostics/tests, package test registration, baseline suite registration, and Phase 1.6 documentation.

## 3. MT5 Timestamp Semantics

MetaTrader's official Python documentation claims tick and bar timestamps are UTC. The connected USTECH provider emitted tick and M5 candle numeric values approximately three hours ahead of system UTC. Both numeric streams agreed with each other. The terminal exposed connection/build metadata but no safe timezone, GMT offset, DST policy, or independent server UTC field.

The legacy upstream labels the numeric value as UTC using `datetime.fromtimestamp(value, UTC)`. Phase 1.6 preserves that field for compatibility and adds the original scalar for audit.

## 4. Contract and Wrapper

The upstream contract ID is `gotrader-mt5-readonly-time-contract`, version `1.0.0`. The wrapper passes it through without changing semantic fields and adds receive/provenance metadata only. The endpoint and raw scalar fields are additive.

## 5. Configuration and Status Policy

No implicit timezone or offset exists. Operator IANA/fixed-offset configuration remains `configured_unverified`. Live offset inference remains `observed_candidate`. Only deterministically corroborated contracts become `verified`.

## 6. Seasonal Evidence

- Winter observation: unavailable; no provider capture was fabricated
- Summer observation: July 22, 2026 live sample observed `+180` minutes
- DST result: unverified

The dedicated tests cover deterministic winter/summer fixtures but those fixtures are not provider evidence.

## 7. Tick/Candle Basis

Live USTECH tick and M5 candle raw values used the same apparent basis. The contract reported `tickCandleBasisAgreement: true`.

## 8. Bounded Live Diagnostic

Isolated ports `8016/7357` were used without disturbing the existing `8000/7341` services.

Default contract result:

- health/time-contract/quote/latest/range HTTP status: all `200`
- verification: `observed_candidate`
- provider basis: `unknown`
- observed offset: `180` minutes
- latest candles: `1000`
- range candles: `10`
- future count under legacy UTC label: `36`
- current raw M5 partial count: `1`
- V2 retained eligible candles: `0`

Configured `Europe/Helsinki` result:

- provider basis: `mt5_server_wall_clock`
- normalized current provider tick aligned plausibly with system UTC
- verification: `configured_unverified`
- future count under unchanged legacy label: `36`
- current raw M5 partial count: `1`
- V2 retained eligible candles: `0`

No raw candle arrays were printed or persisted.

## 9. Identity and Adoption

V2 market-data identity now changes with contract ID, version, and verification status. Policy ID/version remain part of identity. Volatile clock observations are not identity fields. The legacy source fingerprint is unchanged.

No production strategy, research, evidence, readiness, UI, Paper-Demo, OpenClaw, broker, or execution path adopted this contract.

## 10. Authority and Sensitive Data

No account, order, position, deal, execution, or mutation endpoint was added. The contract excludes credentials and secrets. Authority remains `none / none / none`.

## 11. Push Parity

No independent network push publisher was available. The polling-derived browser adapter is not independent evidence. Result: `insufficient_comparison_data`.

## 12. Validation and Baselines

The dedicated suite covers unknown, configured-unverified, observed-candidate, verified IANA, verified fixed offset, invalid timezone/offset, seasonal mismatch, tick/candle mismatch, wrapper pass-through, raw scalar preservation, identity sensitivity, fail-closed V2 behavior, strict authority, and sensitive-data exclusion.

The full validation matrix passed: TypeScript typecheck, production build, core, strategy baselines, source integrity, provenance, safety, browser smoke, frozen baseline snapshots, V2 candle repository, Phase 1.5 time normalization, and the Phase 1.6 upstream contract suite. The build emitted only the existing Rollup large-chunk advisory.

Frozen baseline hashes must remain:

- IFVG v3: `1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a`
- IFVG v2: `3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224`
- Strategy catalog: `43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de`

## 13. Rollback

Revert the Phase 1.6 commit. Because legacy fields and production consumers are unchanged, rollback removes only the additive endpoint, raw scalars, V2 verifier, tests, and documentation.

## 14. Phase 2 Decision

The provider timezone and year-round DST behavior remain unproven. Independent push parity also remains unavailable.

```text
PHASE 1.6 BLOCKED - PROVIDER TIME CONTRACT NOT VERIFIED
```
