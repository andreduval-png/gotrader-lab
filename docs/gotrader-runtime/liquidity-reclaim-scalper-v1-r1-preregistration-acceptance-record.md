# Liquidity Reclaim Scalper v1 R1 Preregistration Acceptance

Decision: accept the first R1 slice as a non-executable, identity-bound
preregistration. The bounded R1 program is authorized, but no parameter sample
generation, trial operator, or simulation search is accepted or started by
this record.

## Accepted Identities

- Feature worktree: `C:\Users\andre\OneDrive\Documents\gotrader-liquidity-reclaim-scalper-v1`
- Feature branch: `codex/gotrader-lrs-v1-r1-parameter-discovery`
- Accepted feature HEAD: `4fe6c600d9d4aab2e715a7480733fdbdb9ac1683`
- Accepted feature tree: `f1f7054518fb168d8b6fab192aeb1a6701c646ed`
- R1 authorization commit: `3dd4bbf059af618ca477188c3a2ed5859fde06ed`
- R1 preregistration implementation: `9679563c4729bb0f45baf5e097f20693e0ad9b56`
- R1 preregistration acceptance: `sha256:a756b117574f330357bc2b39534a405e71f0e23b8fa7f81e618d5772576386a1`
- Parameter schema: `sha256:dcb5ca7c7d181a81a8d347208d703224576ae3a26ed7b7ccaae4488c0dbcf137`
- Experiment family: `sha256:e89903741561b76b56adc5feac12b311d7154036e7dff9f4c9cbf75afd405fed`
- Sampling plan: `sha256:2218b36fae572a2411c35da3fae6788090d4b58a452ed1a9a5b2df65edab6476`
- Baseline acceptance: `sha256:db9c6d1be37a3e77ef0003bfab035ab1fe0b02b9e996bfbb9347af9ab396d7ef`
- Dataset certificate: `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`
- Dataset: `sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d`
- Source fingerprint: `sha256:e164236affb51072322ce78bf297c03b3c403243e206a685b917792ac6db07bd`

## Accepted Boundary

The complete 25-field strategy parameter contract is classified. Five
dimensions are directly sweepable, three are conditional, and seventeen are
frozen because their distinct advertised behavior is not implemented by the
current detector or certified runner. The fixed plan uses
`halton_low_discrepancy_v1`, seed 1729, sequence skip 64, an exact maximum of
128 trials, one concurrent trial, append-only retention, and no adaptive
budget extension.

Candidate construction now validates the supplied parameter set and binds the
actual parameter hash into candidate identity. This prevents distinct R1
geometries from collapsing into the base profile identity.

Complete LRS, baseline, BT1.6, BT2, source, provenance, safety,
authoritative-ledger, strict typecheck, production-build, syntax, diff, and
sequential browser validation passed. Existing Rollup warnings remain
disclosed. The initial focused test's async-assertion harness failure remains
preserved.

## Authority And Next Slice

- Authority remains `none / none / none`.
- `researchValidated` remains `false`.
- `productionAdoptionAllowed` remains `false`.
- The next separately accepted slice may implement deterministic Halton sample
  generation, immutable trial identities, append-only disposition records,
  and atomic checkpoint/restart contracts.
- No trial generation or BT2 search operator may start until that slice passes
  focused and complete validation and receives separate acceptance.
- Paper Demo, runtime adoption, production, broker mutation, trade intent,
  orders, and execution remain unauthorized and human-gated.
