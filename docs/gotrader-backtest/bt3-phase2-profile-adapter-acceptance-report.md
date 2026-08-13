# BT3 Phase 2 Profile Adapter Acceptance Report

Date: 2026-08-13

Branch: `codex/gotrader-bt3-strategy-profile-coverage`

Coverage authorization: `833619e93c3b302762b0f6c543f86526a47e8589`

Gap report: `28a4aacdb2be38c34f8d809414094fae6058b127`

Slice authorization: `b71cfeed51ae58cb1989c9a50b0df2b0ba2b9913`

Implementation: `2deb96b5987231feb26930d1a9cd47354647232b`

## Decision

```text
ACC-BT3-PHASE-2-PROFILE-ADAPTER
ACCEPTED FOR CANONICAL FIXTURE AND PARITY COVERAGE
```

## Accepted Evidence

- Fixture snapshot: `sha256:a38c562ea2c5f8a066a62e18f77ee215d1de0fceae1fde7ef11db0c9cb37bfcb`.
- Parity report: `sha256:734638458582675aac8f1ce4d735339ecb1200c639ed0384e90e203edec53b00`.
- Full validation log: `sha256:6428438718e4238575c416de669a9e35bb24a6bcbd1149fc34f838b60bb43611`.
- Three compact, byte-stable fixtures cover Bread and Butter buy, Bread and Butter sell, and One Shot One Kill.
- All three frozen detector fixtures remained `no_trade` and emitted zero canonical opportunities because native liquidity-sweep and target gates were not satisfied.
- The positive contract probe proved an approved directional signal can preserve detector-owned entry, stop, target, and side.
- The inverted-geometry and rejected-geometry probes failed closed.
- No raw candles were serialized, no historical dataset was claimed qualified, no MT5 or network contact occurred, and promotion remained disabled.
- Complete aggregate BT3 and BT2 suites, both authoritative ledgers, MT5 time contracts, strict typecheck, production build, syntax/diff checks, and sequential 44-test browser smoke passed.
- Production build emitted only the previously disclosed Rollup chunk-size warning.

## Preserved Failure

The first full validation wrapper had a 120-second command timeout while the aggregate suite was still running and had reported no failing gate. It was preserved as an orchestration failure. The exact sequential matrix was rerun with a sufficient bound and exited zero in 177.2 seconds before browser smoke ran separately.

## Boundary

This acceptance adds canonical coverage, not strategy promotion. Detector thresholds, approved-profile thresholds, and native geometry were unchanged. Grinch models remain confluence-only and cannot emit standalone opportunities.

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
promotionAllowed: false
runtimeAdoptionAllowed: false
paperDemoAllowed: false
executionAllowed: false
```

