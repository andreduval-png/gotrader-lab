# Track A2 Recovery Runbook

## Service Restart

The Track A1 supervisor owns feed and scheduler restarts. It uses the same bounded
five-attempt restart budget as the read-only bridge.

After a feed restart:

1. load the bounded close-event checkpoint and event ledger;
2. rebuild rolling windows from the bridge;
3. establish or reconcile the latest close;
4. suppress emitted close IDs;
5. block conflicting closed payloads.

After a scheduler restart:

1. load processed event and task-run IDs;
2. resume after the last sequence;
3. reject a retained-ledger gap;
4. suppress deterministic cycle IDs.

## Time Contract Lost

Do not restart repeatedly when transport is healthy. The feed must:

1. retain its rolling state;
2. emit `source_blocked`;
3. stop close events;
4. continue health monitoring;
5. refresh the time contract before each candle poll;
6. reconcile closes only after verified recovery.

## Corrupt Checkpoint

Stop the A2 profile. Preserve the corrupt file for diagnosis. Move only the affected
checkpoint out of its state directory, then restart. The feed establishes a fresh
baseline and does not replay all historical candles. The scheduler must not continue if
its cursor is behind the retained ledger.

Do not remove both feed and scheduler state casually; their identity ledgers are the
restart-safety mechanism.

## Foreign Port Owner

If startup reports `blocked_foreign_worktree` or `blocked_unknown_owner`, stop the process
from its owning worktree. Do not use broad process termination and do not adopt it.

## Rollback

1. stop the scheduler profile;
2. confirm managed ports are released;
3. return to `always_on_read_only`;
4. revert the isolated Track A2 commit if required.

No strategy, evidence, readiness, Paper-Demo, or execution rollback is needed because A2
does not own those systems.
