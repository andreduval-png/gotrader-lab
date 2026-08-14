# R1 Parameter-Space Discovery Authorization

Decision: authorize the bounded Liquidity Reclaim Scalper Research Track R1 as a staged research program. This record does not authorize an unbounded search or any trading authority.

## Bound Parent Evidence

- Parent feature HEAD: `15f05fe1ed21e017ace99690fe0e3df6b8136b90`
- Parent feature tree: `1830d496af86006aafd8d9624145ac8cbbfb223c`
- Baseline acceptance: `sha256:db9c6d1be37a3e77ef0003bfab035ab1fe0b02b9e996bfbb9347af9ab396d7ef`
- Baseline report: `sha256:8ea97cbf2d8cceb328f0a1a0855c907814fe813fd70e6873a6b1de40d1476b46`
- Baseline ledger: `sha256:97a4b5978ca9c87f6d0ee92e6da8d352001237acd007f1bb1192712fe47319c4`
- Strategy: `liquidity_reclaim_scalper_v1`
- Profile: `liquidity_reclaim_scalper_v1_base_research`
- Base parameter hash: `sha256:c58d3a0aaff9ba61ece6ea0df2d76145059be36cab9f2347a66a0e6da642f748`
- Dataset certificate: `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`
- Dataset: `sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d`

## Authorized Stages

R1 may proceed only through separately accepted sequential stages:

1. Immutable experiment-family, parameter-schema, sampling-plan, budget, seed, checkpoint, and complete trial-ledger contracts.
2. Deterministic bounded random or low-discrepancy sampling with no adaptive escape from the family.
3. Causal BT2 evaluation with all attempted configurations and rejection reasons retained.
4. Sample sufficiency, net performance, drawdown, concentration, and daily-Sharpe gates.
5. Multiple-testing correction, preregistered null tests, and ablation.
6. Neighborhood stability and chronological walk-forward/OOS.
7. Cold-instrument evaluation.
8. One-way sealed-holdout consumption and an explicit R1 decision.

Every stage requires an exact clean preflight, bounded resources, focused and complete validation, preserved failures, exact evidence identities, and separate implementation and acceptance commits. A failed stage does not advance.

## Explicit Exclusions

- No R1 operator may start before the experiment family, sampling plan, budget, seed, stopping rule, and retention policy are accepted.
- The certified baseline profile and its evidence are immutable; R1 uses separate research configurations.
- No baseline or R1 result may mutate a frozen profile in place.
- No readiness, calibration, Paper Demo, runtime adoption, production, broker mutation, trade intent, order placement, or execution is authorized.
- Authority remains `none / none / none`.
- `researchValidated` remains `false` and `productionAdoptionAllowed` remains `false` until the complete anti-overfitting chain passes and a separate decision is accepted.
