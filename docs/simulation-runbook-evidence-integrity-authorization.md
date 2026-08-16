# Simulation Runbook Evidence Integrity Authorization

Status: authorized

Parent acceptance: `38bfbc337074d90d8b291a3d89549eccdf020798`

This slice may replace the port-scoped browser-local simulation-runbook checklist with an origin-independent, durable, append-only evidence model served by the local research-memory sidecar.

Authorized scope:

- bind every completed check to one exact research cycle;
- require immutable evidence identity, source identity, observation time, and hash-chain integrity;
- derive checklist booleans only from accepted current-cycle evidence;
- archive legacy browser state as untrusted migration context and prevent it from satisfying readiness;
- fail closed when the sidecar, cycle identity, or evidence integrity is unavailable;
- remove automated claims that were not independently observed;
- update the runbook UI, readiness packet, runtime consumers, tests, and browser validation.

Not authorized:

- readiness overrides or threshold reductions;
- Paper Demo or production promotion;
- strategy, parameter, risk, or portfolio mutation;
- MT5 writes, broker mutation, trade intent, orders, or execution;
- converting legacy checkbox state into trusted evidence.

Authority remains `none/none/none`.
