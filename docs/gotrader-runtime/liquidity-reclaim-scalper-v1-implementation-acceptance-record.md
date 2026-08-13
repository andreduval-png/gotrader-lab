# Liquidity Reclaim Scalper v1 Implementation Acceptance Record

Decision: accept the deterministic, research-only implementation with documented strategy-semantic limitations.

## Bound Identities

- Feature worktree: `C:\Users\andre\OneDrive\Documents\gotrader-liquidity-reclaim-scalper-v1`
- Feature branch: `codex/gotrader-strategy-liquidity-reclaim-scalper-v1`
- Accepted feature HEAD: `4cbcc2863427dc01e330199362880cea69071a01`
- Accepted feature tree: `d3dc4f4db53898a9958af88be4fdade067616fbb`
- Authorization commit: `22070f1b4a3e948ce1e875169afb448678b92a2a`
- Contract commit: `a5de208a8ddd76ee78caed5d28a92c2e9f2f2d20`
- Detector commit: `bad86fd354ffe541a3fae6be994fff4c0fe860da`
- BT2 integration commit: `667a9afc8a6f90667ebcf61c25b8bf3afb26f02d`
- V2 isolation correction: `9f7a660f4802a0d84f1dd970931b15849f9167d0`
- Safety and baseline-versioning commit: `37eab541e211ab45bf7e83e0c46c1a7477d61ee5`
- Acceptance commit: `4cbcc2863427dc01e330199362880cea69071a01`
- Acceptance report: `sha256:f395c5f98504d903303bd0cf82ce382a76880e3e511267dd804cebf814452c79`
- Strategy ID: `liquidity_reclaim_scalper_v1`
- Profile ID: `liquidity_reclaim_scalper_v1_base_research`
- Parameter hash: `sha256:c58d3a0aaff9ba61ece6ea0df2d76145059be36cab9f2347a66a0e6da642f748`
- Dataset certificate: `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`
- Dataset: `sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d`

## Accepted Scope

The accepted scope is limited to typed contracts, immutable parameters, a causal shadow-only detector, a deterministic state machine, exact long/short geometry, BT2 adaptation, additive strategy registration, fixture baseline coverage, and safety/causality validation. Complete repository validation passed, including BT1.6, BT2, source/provenance/safety, authoritative ledgers, typecheck, production build, and sequential browser smoke.

The original frozen strategy catalog remains unchanged. The additive v2 catalog snapshot is separately hash-bound. Honest pre-acceptance failures and existing Rollup circular/large-chunk warnings remain disclosed.

## Pending And Prohibited

- The certified two-year descriptive baseline is pending because the implementation preflight found low memory headroom and shared active runtime services.
- No baseline performance metric, validation result, profitability claim, or readiness claim exists.
- Parameter search and Liquidity Reclaim Scalper Research Track R1 are not authorized.
- Runtime adoption, Paper Demo, production, broker mutation, trade intent, order placement, and execution are not authorized.
- Authority remains `none / none / none`.
- `researchValidated` remains `false`.
- `productionAdoptionAllowed` remains `false`.

The next permissible action is a separately bounded, resource-safe two-year descriptive baseline using the exact accepted strategy/profile and certified dataset identities. Baseline observations must not be used to mutate the strategy in place.
