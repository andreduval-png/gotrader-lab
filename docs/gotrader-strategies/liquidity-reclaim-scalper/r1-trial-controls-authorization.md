# R1 Deterministic Trial Controls Authorization

Decision: authorize implementation and validation of deterministic sample
generation and durable trial-control contracts for the accepted Liquidity
Reclaim Scalper R1 family. This authorization does not permit trial execution.

## Parent Identities

- Parent HEAD: `4fe6c600d9d4aab2e715a7480733fdbdb9ac1683`
- Parent tree: `f1f7054518fb168d8b6fab192aeb1a6701c646ed`
- Preregistration acceptance: `sha256:a756b117574f330357bc2b39534a405e71f0e23b8fa7f81e618d5772576386a1`
- Parameter schema: `sha256:dcb5ca7c7d181a81a8d347208d703224576ae3a26ed7b7ccaae4488c0dbcf137`
- Experiment family: `sha256:e89903741561b76b56adc5feac12b311d7154036e7dff9f4c9cbf75afd405fed`
- Sampling plan: `sha256:2218b36fae572a2411c35da3fae6788090d4b58a452ed1a9a5b2df65edab6476`

## Authorized Scope

- Exact deterministic Halton generation for method, seed, skip, dimensions,
  conditional rules, and 128-trial budget already accepted.
- Canonical parameter hashes, immutable trial ordinals and identities, and
  duplicate-parameter coalescing.
- Append-only attempted, rejected, canceled, failed, and completed disposition
  records.
- Integrity-hashed atomic checkpoint/restart state with exact family, plan,
  dataset, source, code, and authority checks.
- One-concurrent-trial and fixed resource limits.

## Exclusions

No dataset scan, BT2 simulation, adaptive search, budget extension, metric
selection, holdout access, strategy mutation, Paper Demo, runtime adoption,
production, broker mutation, trade intent, order, or execution may occur.
Authority remains `none / none / none`; `researchValidated` and
`productionAdoptionAllowed` remain false.
