# Liquidity Reclaim Scalper v1 R1 Evidence Capacity Correction Authorization

Authorization date: 2026-08-15

Parent acceptance: `749df7be1321ad69700eb9c2188576ac90efea3d`

## Authorized Scope

Implement a semantics-preserving governed-evidence capacity correction for the
accepted R1 bounded executor. The correction may losslessly compact immutable
per-child telemetry into deterministic, integrity-bound archive chunks and add
the manifests, restart logic, and verification needed to reopen those chunks.

The implementation must preserve every telemetry object, telemetry ID, hash
chain link, stage sample summary, resource decision, failure reason, event,
checkpoint, trial report, BT2 ledger seal, and accepted experiment identity.
Compaction may remove a plaintext telemetry file only after its exact canonical
content is present in a verified archive whose manifest is atomically committed
to the controller checkpoint. Archive reopen must independently reconstruct and
verify the original object and ID. Active/uncommitted telemetry, failures,
terminal evidence, and controller state must fail closed and must never be
silently discarded.

Add focused tests for deterministic archive identity, roundtrip reconstruction,
hash-chain verification across plaintext/archive boundaries, crash windows,
idempotent reopen/retry, corruption rejection, retention of failures, and fixed
resource accounting. Run complete regression before operation. Then run a new
isolated restart-capable capacity pilot and project the exact accepted 125 unique
trials and 128 dispositions from measured evidence. Start one full family
operator only if the new projection and fresh clean/concurrency/resource/disk
preflight pass all existing fixed bounds.

## Fixed Boundaries

- Preserve family `sha256:e89903741561b76b56adc5feac12b311d7154036e7dff9f4c9cbf75afd405fed`.
- Preserve plan `sha256:2218b36fae572a2411c35da3fae6788090d4b58a452ed1a9a5b2df65edab6476`.
- Preserve sample set `sha256:e844dab5fb0567e012147877a2414ac656b8bb749d5ce8c8fd16102c089f7004`.
- Preserve dataset certificate `sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193`.
- Preserve dataset `sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d`.
- Preserve source `sha256:e164236affb51072322ce78bf297c03b3c403243e206a685b917792ac6db07bd`.
- Keep the 1 GiB child RSS and 128 MiB governed-evidence limits unchanged.
- Preserve pilots v1-v5 and every honest failure unchanged.
- Never serialize raw candles or contact MT5/network services.
- No parameter mutation, adaptive search, holdout use, multiple-testing/null/
  ablation/OOS/cold-instrument decision, Paper Demo, runtime adoption,
  production, broker mutation, trade intent, order, or execution is authorized.
- Authority remains `none / none / none`; `researchValidated` and
  `productionAdoptionAllowed` remain `false`.
