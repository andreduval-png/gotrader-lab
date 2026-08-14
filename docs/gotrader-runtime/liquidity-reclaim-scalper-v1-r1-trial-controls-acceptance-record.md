# Liquidity Reclaim Scalper v1 R1 Trial Controls Acceptance

Decision: accept deterministic sample generation and durable trial-control
contracts. This record does not authorize or start the BT2 trial executor.

## Accepted Identities

- Feature branch: `codex/gotrader-lrs-v1-r1-trial-controls`
- Accepted feature HEAD: `e0b71bbf188652b2144662bb3a63f4568ec9c052`
- Accepted feature tree: `65f1b30e4d8dad1aa9fd760c5a401094a258cf94`
- Slice authorization: `6506b11b9ea14a80d63500448621e5e5501fd860`
- Implementation: `bab4fb806ca6a8f36970683100506aa3e9fa491d`
- Acceptance: `sha256:7b6c1fb6a0896f496895eb30d6dc091f08ee804b0d75c10248e17a5fa65a11ae`
- Preregistration acceptance: `sha256:a756b117574f330357bc2b39534a405e71f0e23b8fa7f81e618d5772576386a1`
- Experiment family: `sha256:e89903741561b76b56adc5feac12b311d7154036e7dff9f4c9cbf75afd405fed`
- Sampling plan: `sha256:2218b36fae572a2411c35da3fae6788090d4b58a452ed1a9a5b2df65edab6476`
- Ordered sample set: `sha256:e844dab5fb0567e012147877a2414ac656b8bb749d5ce8c8fd16102c089f7004`
- First trial: `sha256:a33876dcec34121da7f5c97a135518c817e1bc1220a21a38833a0813d63e517b`
- Last trial: `sha256:2c5a98804db870ade1cac8f07f47486168b7cb794f8fe4b5d2625baeff2ec1c3`

## Accepted Result

The fixed Halton plan materializes exactly 128 ordinal attempts: 125 unique
parameter hashes and three explicitly retained duplicate dispositions. Trial
and event artifacts are immutable; checkpoint state is atomically replaced and
integrity hashed; family, plan, schema, dataset, source, generator, seed, skip,
budget, controller commit, and authority are fail-closed identity inputs.

Complete LRS, baseline, BT1.6, BT2, source, provenance, safety,
authoritative-ledger, strict typecheck, production-build, syntax, diff, and
sequential browser validation passed. Existing Rollup warnings remain
disclosed.

## Authority And Next Slice

- Authority remains `none / none / none`.
- `researchValidated` remains `false`; `productionAdoptionAllowed` remains
  `false`.
- The next separately authorized slice may implement the bounded certified
  dataset scanner and BT2 trial executor for the accepted sample set, with one
  concurrent trial, controlled recycling, complete disposition retention, and
  fresh resource/concurrency/disk preflight.
- No executor has started. Holdout use, adaptive search, Paper Demo, runtime
  adoption, production, broker mutation, trade intent, orders, and execution
  remain unauthorized.
