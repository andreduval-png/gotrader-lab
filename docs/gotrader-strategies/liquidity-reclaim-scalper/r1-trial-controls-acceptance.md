# R1 Deterministic Trial Controls Acceptance

Status: `ACCEPTED_NON_EXECUTABLE_TRIAL_CONTROLS`

Acceptance ID: `sha256:7b6c1fb6a0896f496895eb30d6dc091f08ee804b0d75c10248e17a5fa65a11ae`

Implementation commit `bab4fb806ca6a8f36970683100506aa3e9fa491d`
deterministically materializes the preregistered 128 Halton ordinals. The set
contains 125 unique parameter hashes and three explicitly retained,
coalesced-duplicate attempts. Its ordered sample-set identity is
`sha256:e844dab5fb0567e012147877a2414ac656b8bb749d5ce8c8fd16102c089f7004`.

The accepted controls provide canonical trial identities, immutable
attempt/reject/cancel/fail/complete events, duplicate preservation, atomic
integrity-hashed checkpoint/restart state, exact family/plan/dataset/source
checks, a fixed budget, and one-concurrent-trial policy. Corrupt checkpoints,
lineage gaps, immutable conflicts, and ordinals outside the budget fail closed.

Complete LRS, baseline, BT1.6, BT2, source, provenance, safety,
authoritative-ledger, strict typecheck, production-build, syntax, diff, and
sequential browser validation passed. Existing Rollup warnings remain
disclosed.

No dataset scan or BT2 trial simulation was implemented or started.
`researchValidated` and `productionAdoptionAllowed` remain false, authority
remains `none / none / none`, and all trading/runtime authority remains
disabled. A bounded execution operator requires a separate authorization and
acceptance slice.
