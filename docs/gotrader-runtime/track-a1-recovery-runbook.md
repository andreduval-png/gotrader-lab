# Track A1 Recovery Runbook

## Foreign Worktree Listener

Symptom:

```text
port_owned_by_foreign_worktree
```

Action:

1. Run `npm.cmd run gotrader:runtime:health`.
2. Note the reported PID and service.
3. Go to the owning worktree and use its tracked stop command.
4. Confirm the port is free.
5. Start Track A1 again.

Do not use broad process termination. Track A1 never terminates a foreign listener.

## Unknown Listener

Symptom:

```text
port_owned_by_unknown_process
```

Action:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 8000,7341
Get-CimInstance Win32_Process -Filter "ProcessId=<PID>"
```

Stop it manually only after identifying it. The runtime remains blocked.

## Stale Lock

The lock is worktree-scoped. If its PID no longer exists, startup removes and recreates
the lock atomically, then records:

```text
stale_supervisor_lock_recovered
```

An active lock is never removed.

## Supervisor Crash

Restart the supervisor from the same worktree. Exact surviving service listeners are
adopted only when their absolute script paths and identity tokens match the active
worktree. Otherwise startup blocks.

## Bridge Crash

After three failed process-health intervals, the supervisor consumes one restart attempt
and restarts only the bridge.

## Upstream Crash

The supervisor stops the dependent bridge, restarts the upstream, waits for health, then
restarts the bridge.

## Restart Budget Exhausted

After five attempts within ten minutes:

```text
state: blocked
blocker: restart_budget_exhausted
```

Inspect the bounded service and supervisor logs before restarting manually.

## MT5 Missing or Disconnected

- Missing terminal process blocks startup.
- Terminal IPC or market-data disconnection leaves read-only services alive when safe and
  reports degraded transport.
- Track A1 never enters credentials, mutates MT5, or starts strategy processing.

## Time Contract Unverified

An available but unverified time contract remains degraded. Resolve it through the
terminal clock and historical DST verification track. Do not restart services repeatedly
and do not bypass Phase 3 evidence identity gates.

## Rollback

1. Run `npm.cmd run gotrader:runtime:stop`.
2. Confirm ports `8000` and `7341` are released by this worktree.
3. Revert the isolated Track A1 commit.
4. Continue using the pre-existing local development launcher if required.

No strategy, baseline, evidence, or readiness rollback is needed because Track A1 does
not modify those systems.
