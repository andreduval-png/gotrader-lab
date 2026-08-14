# Certified Two-Year Descriptive Baseline

Decision: accept as an identity-bound descriptive baseline. This is not research validation, readiness, or production adoption.

## Bound Evidence

- Strategy: `liquidity_reclaim_scalper_v1`
- Profile: `liquidity_reclaim_scalper_v1_base_research`
- Parameter hash: `sha256:c58d3a0aaff9ba61ece6ea0df2d76145059be36cab9f2347a66a0e6da642f748`
- Dataset certificate: `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`
- Dataset: `sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d`
- Coverage: `2024-08-01T00:00:00.000Z` through `2026-08-01T00:00:00.000Z`
- Implementation HEAD: `fd1f7c4f3047e71aa0390702e823abf65387293a`
- Baseline report: `sha256:8ea97cbf2d8cceb328f0a1a0855c907814fe813fd70e6873a6b1de40d1476b46`
- Scan checkpoint: `sha256:60a70b2c799dd2e19219e5d7cb2d76be3926f15df31444aec523502117742d83`
- BT2 checkpoint: `sha256:52dcabaae6e21b3a94fe227ca3ec3cdfbacde255c199c1bb7d9b8e801b08683f`
- BT2 experiment: `sha256:57a082e7362325578eb1b941494e078e1989af44bf28e7819b93ac890812704c`
- Ledger seal: `sha256:97a4b5978ca9c87f6d0ee92e6da8d352001237acd007f1bb1192712fe47319c4`
- Cost model: `sha256:2d39ed40d613e2ce8868f54521e1a7089fb6b57f4ba5a4c145ffe8991b60d87b`

## Descriptive Results

- Unique candidates: 6,449
- Duplicate detections coalesced: 603
- Setups: 5,016
- Unique eligible candidates and BT2 records: 521
- Filled and exited: 395
- Expired unfilled: 126
- Blocked, ambiguous, or insufficient-data records: 0
- Wins / losses: 43 / 352
- Net win rate: 10.89%
- Average and expectancy net R: 0.1848R
- Median net R: -0.0514R
- Profit factor: 1.2916
- Maximum drawdown: 83.6312R
- Average hold: 132.56 minutes
- Descriptive frequency: 260.5 records per year

Long records had +0.3632R average net expectancy and 1.4815 profit factor. Short records had -0.0638R average net expectancy and 0.8631 profit factor. London, New York PM, and overnight session groups were negative; the overall result was materially influenced by the after-hours group. These instabilities prohibit treating the aggregate result as a robustness or readiness claim.

## Verification

All 521 candidate, opportunity, record, checkpoint, report, and ledger identities were unique and independently hash-verified. Record-to-opportunity bindings, observed-spread cost-model bindings, conservative stop-first policy, exact certificate/dataset/parameter identities, and authority `none / none / none` passed. Storage was 5,193,016 bytes and final-process peak RSS was 1,004,929,024 bytes, both within fixed bounds. No raw candles or MT5/network contact were used.

Complete LRS, BT1.6, BT2, source, provenance, safety, authoritative-ledger, typecheck, production-build, syntax, diff, and browser validation passed. Existing Rollup circular-chunk and large-chunk warnings remain disclosed.

## Research Decision

`researchValidated` remains `false`. `productionAdoptionAllowed` remains `false`.

The evidence is sufficient to recommend a separately authorized Liquidity Reclaim Scalper Research Track R1 parameter-space discovery study under the governed anti-overfitting pipeline. That recommendation is motivated by adequate event count and a positive aggregate descriptive result, while the high drawdown and direction/session instability require R1 to include null tests, multiple-testing correction, ablation, neighborhood stability, walk-forward/OOS, cold-instrument testing, and a sealed holdout.

This acceptance does not authorize or start R1, parameter search, Paper Demo, runtime adoption, production, broker mutation, trade intent, order placement, or execution.
