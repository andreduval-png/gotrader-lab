# R1 Preregistration Acceptance

Status: `ACCEPTED_NON_EXECUTABLE_PREREGISTRATION`

Acceptance ID: `sha256:a756b117574f330357bc2b39534a405e71f0e23b8fa7f81e618d5772576386a1`

The first Liquidity Reclaim Scalper R1 slice is accepted at implementation
commit `9679563c4729bb0f45baf5e097f20693e0ad9b56`. It establishes the complete
25-field parameter schema, freezes detector inputs whose advertised semantics
are not implemented, and preregisters an exact 128-trial Halton plan with seed
1729 and no adaptive budget extension.

The audit corrected candidate identity so every request parameter set is
validated and bound to its own parameter hash and candidate ID. The accepted
base profile hash remains unchanged.

## Bound Identities

- Parameter schema: `sha256:dcb5ca7c7d181a81a8d347208d703224576ae3a26ed7b7ccaae4488c0dbcf137`
- Experiment family: `sha256:e89903741561b76b56adc5feac12b311d7154036e7dff9f4c9cbf75afd405fed`
- Sampling plan: `sha256:2218b36fae572a2411c35da3fae6788090d4b58a452ed1a9a5b2df65edab6476`
- Dataset certificate: `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`
- Dataset: `sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d`
- Source fingerprint: `sha256:e164236affb51072322ce78bf297c03b3c403243e206a685b917792ac6db07bd`

## Validation

Focused R1 schema/identity tests, complete LRS and baseline tests, BT1.6, BT2,
source integrity, provenance, safety, authoritative ledgers, strict typecheck,
production build, sequential browser smoke, syntax, JSON, and diff checks all
passed. Existing Rollup circular-export and large-chunk warnings remain
non-failing and unchanged. The first focused run's incorrect synchronous
assertion of an async rejection is preserved as an honest harness failure.

No sample generator, trial ledger, checkpoint operator, or simulation search
has been accepted or started. `researchValidated` and
`productionAdoptionAllowed` remain false. Paper Demo, runtime adoption,
production, broker mutation, orders, and execution remain unauthorized.
