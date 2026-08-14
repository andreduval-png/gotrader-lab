# R1 Memory-Bounding Correction Authorization

Decision: authorize a semantics-preserving correction to the bounded certified-
dataset R1 trial executor and a replacement capacity pilot in a new evidence
root. The correction addresses the fixed 1 GiB RSS failure observed during
ordinal 1 without weakening any accepted gate or changing strategy results.

## Parent Identities

- Parent HEAD: `9626a5aa4f89717769ad77b667c85c9d15aa9ee9`
- Parent tree: `cea0e19081890760ee9d5e0c4afc239f5a42890d`
- Bounded-executor authorization: `cfddfc7f5ade61abccbecf96eed2b40525518b63`
- Experiment family: `sha256:e89903741561b76b56adc5feac12b311d7154036e7dff9f4c9cbf75afd405fed`
- Sampling plan: `sha256:2218b36fae572a2411c35da3fae6788090d4b58a452ed1a9a5b2df65edab6476`
- Ordered sample set: `sha256:e844dab5fb0567e012147877a2414ac656b8bb749d5ce8c8fd16102c089f7004`
- Dataset certificate: `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`
- Dataset: `sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d`
- Source fingerprint: `sha256:e164236affb51072322ce78bf297c03b3c403243e206a685b917792ac6db07bd`

## Authorized Scope

- Add deterministic event-level scan cursors and integrity-hashed checkpoints
  so a dense daily segment can resume without replaying accepted events.
- Add controlled soft-RSS recycling before the unchanged hard 1 GiB RSS gate.
- Release transient context references between events without changing causal
  candle windows, detector parameters, candidate identities, or BT2 behavior.
- Prove checkpoint migration, restart, idempotence, candidate/ledger parity,
  memory bounds, and failure preservation with focused tests and full regression.
- Run one replacement capacity pilot on the same earliest two unique ordinals in
  a new evidence root after a fresh clean, concurrency, memory, and disk preflight.
- Start the full family only if the replacement pilot passes every existing gate
  and a separate fresh preflight passes.

## Preserved Failure

The failed pilot root `r1-capacity-pilot-v1`, its ordinal-0 completion, ordinal-1
RSS failure, controller events, checkpoints, logs, and identities are immutable
evidence. They must not be resumed, edited, cleared, deleted, or reclassified.

## Fixed Bounds And Exclusions

Child RSS remains at or below 1 GiB and governed evidence remains at or below
128 MiB. One parent and one child may run at a time. No raw candle serialization,
MT5/network contact, parameter mutation, adaptive search, holdout, multiple-
testing decision, null test, ablation, OOS decision, cold-instrument test, Paper
Demo, runtime adoption, production, broker mutation, trade intent, order, or
execution is authorized. Authority remains `none / none / none`;
`researchValidated` and `productionAdoptionAllowed` remain false.
