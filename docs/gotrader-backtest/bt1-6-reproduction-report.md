# BT1.6 Reproduction Report

Status: `PASSED`

Two independent checks are required:

- `deterministic_rematerialization` must match every governed identity;
- `provider_requery` must separately test whether MT5 returned stable history.

Provider drift is not hidden as a pipeline mismatch. During qualification it
quarantines the candidate and requires a new immutable dataset identity. The
original capture remains preserved and is never overwritten.

Both independent roots completed 213 source pages, 217 partitions, 706,422
accepted bars, and zero rejected bars. All governed identities matched dataset
`sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d`.

- deterministic comparison: `sha256:6efa53df39db263a1c4fe4cf88e38d054ca46445c6df7f4b12c4286486ed8dde`;
- provider requery comparison: `sha256:5b7193c15f02d3c8a44b68b7076b21c960982fffbc68a5584d50f4317c84a2e9`.

Provider drift status is `not_detected`.
