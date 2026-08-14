# R1 Bounded Trial Executor Authorization

Decision: authorize implementation and validation of the bounded certified-
dataset R1 trial executor and its preregistered capacity pilot. This decision
does not authorize the full family operator until the pilot and fresh resource
preflight pass.

## Parent Identities

- Parent HEAD: `e0b71bbf188652b2144662bb3a63f4568ec9c052`
- Parent tree: `65f1b30e4d8dad1aa9fd760c5a401094a258cf94`
- Trial-controls acceptance: `sha256:7b6c1fb6a0896f496895eb30d6dc091f08ee804b0d75c10248e17a5fa65a11ae`
- Experiment family: `sha256:e89903741561b76b56adc5feac12b311d7154036e7dff9f4c9cbf75afd405fed`
- Sampling plan: `sha256:2218b36fae572a2411c35da3fae6788090d4b58a452ed1a9a5b2df65edab6476`
- Ordered sample set: `sha256:e844dab5fb0567e012147877a2414ac656b8bb749d5ce8c8fd16102c089f7004`
- Dataset certificate: `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`
- Dataset: `sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d`
- Source fingerprint: `sha256:e164236affb51072322ce78bf297c03b3c403243e206a685b917792ac6db07bd`

## Authorized Scope

- Fail-closed identity validation for the accepted family, plan, sample set,
  dataset, certificate, source, code, and per-trial parameter hash.
- Exactly one concurrent trial with controlled scan-segment and BT2-record
  process recycling.
- Integrity-hashed per-trial and family checkpoints, append-only disposition
  events, immutable reports, and immutable BT2 ledgers.
- Explicit coalescing of the three retained duplicate attempts without
  reclassifying their preregistered ordinals.
- A separate capacity pilot restricted to the earliest unique ordinals, with
  restart proof and measured duration, RSS, and governed storage.
- A full-family start only after the pilot and a fresh concurrency, memory,
  disk, and identity preflight pass without weakening fixed bounds.

## Fixed Bounds

- One trial and one child process at a time.
- Child RSS at or below 1 GiB.
- Governed control evidence at or below 128 MiB.
- No raw candle serialization and no MT5 or network contact.
- BT2 retains ownership of fills, costs, expiry, intrabar ambiguity, records,
  and ledger seals.

## Exclusions

No parameter mutation, adaptive search, budget change, holdout use, multiple-
testing decision, null test, ablation, OOS decision, cold-instrument test,
Paper Demo, runtime adoption, production, broker mutation, trade intent, order,
or execution is authorized. Authority remains `none / none / none`;
`researchValidated` and `productionAdoptionAllowed` remain false.
