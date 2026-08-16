# Liquidity Reclaim Scalper v1 R1 Completion-Bound Correction Authorization

Status: authorized

Date: 2026-08-16

## Parent Identity

- Accepted implementation parent: `41ed6bae33d7bfea08fd8e3c64b763072ca7ae9a`
- Parent tree: `c7191b3383056dd5320c21b7b6a89fabde07ad42`
- Branch: `codex/gotrader-lrs-v1-r1-completion-bound-correction`

## Preserved Failure

- Failed family root: `.gotrader/liquidity-reclaim-scalper-v1/r1-family-v1`
- Controller: `sha256:08806144ea0174b28354b5a61b4df388e6a9939fc16385647b4147b32126e752`
- Position: `8`
- Child runs: `970`
- Maximum observed RSS: `372862976` bytes
- Trial ordinal 8 exhausted the fixed 200-child invocation bound without a family report.
- Its integrity-preserved checkpoints record scan segment `730/731`, `950` eligible candidates, and BT2 opportunity ordinal `635/950`.

## Authorized Correction

- Replace the arbitrary per-trial 200-child bound with a deterministic completion bound derived from immutable checkpoint work and fixed per-child scan/record budgets.
- The bound must fail closed when work cannot be measured, progress is not monotonic, or the derived allowance is exceeded.
- Record the derived bound and work basis in child telemetry or operator evidence sufficient for independent verification.
- Add focused tests for worst-case completion capacity, restart from the preserved checkpoint shape, non-progress rejection, and unchanged resource enforcement.
- Run the complete regression matrix before any operator resume.
- Resume at most one family operator only after exact-clean identity, concurrency, memory, disk, and governed-evidence preflight.

## Invariants

- Preserve all failed pilots and the failed family root unchanged until an explicitly verified resume decision.
- Preserve the accepted family, sampling plan, sample set, dataset certificate, dataset, source, parameter hashes, and strategy semantics.
- Keep child RSS at or below 1 GiB and governed evidence at or below 128 MiB.
- Keep `researchValidated=false`, `productionAdoptionAllowed=false`, and authority `none/none/none`.
- No adaptive search, holdout use, parameter mutation, Paper Demo, runtime adoption, production, broker mutation, trade intent, orders, or execution.
- Never commit raw candles or modify the dirty primary worktree.
