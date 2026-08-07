# BT1.5 Architecture And Concurrency Preflight

Date: 2026-08-07

Branch: `codex/gotrader-backtest-bt1-5-historical-qualification`

Parent BT1 commit: `edd2d8d508db6b876303d42f56aedc2fb90e1cf6`

Qualification tooling commits:

- `40838521267361b0c1882a718609a70d4743b317` - canonical BT1.5 qualification identities;
- `be8d96b340622519578f8f3a102800a002594aee` - bounded diagnostics,
  preflight, ingestion, progress, restart, and reproduction tooling.

## Decision

```text
BT1_5_SAFE_WITH_RESTRICTIONS
```

BT1.5 is approved as the operational qualification gate between BT1 and BT2.
It may harden qualification identities, add read-only diagnostics, seal
historical-source evidence, retrieve an isolated historical dataset, and
verify deterministic reproduction. It may not implement simulation,
strategy adapters, parameter search, statistics, risk, portfolio behavior,
readiness, production adoption, broker mutation, or execution.

## Required Pre-Execution Corrections

The accepted BT1 foundation does not yet bind every BT1.5 qualification input
inside a canonical identity. Before live qualification, BT1.5 must:

1. bind the evidence-package hash, normalization policy, source time basis,
   timezone or fixed offset, calendar policy, and verification version into
   the historical time-authority identity;
2. construct and verify calendar and timeframe-alignment identities rather
   than accepting caller-supplied identifiers;
3. distinguish UTC timestamp DST, which may be verified as not applicable,
   from broker-session and New York session DST evidence;
4. preserve `MNQ` only as a research alias when mapped to broker CFD symbol
   `USTECH`; no futures execution semantics may be inferred;
5. prove bounded memory and storage with a pilot before a two-year M1 run;
6. report deterministic re-materialization separately from provider re-query
   stability;
7. require a fully closed historical end boundary.

These are compatibility-preserving corrections to BT1 qualification and do
not authorize BT2.

## Observed State

- the primary `gotrader` worktree is heavily dirty and remains off-limits;
- accepted BT1 is clean at `edd2d8d508db6b876303d42f56aedc2fb90e1cf6`;
- B1.2 is clean and stopped at
  `441188ac9890c99493b8737691b5e8af4b32f97a`;
- the B1.2 Monday canary automation remains active and has priority over MT5,
  ports, CPU, memory, disk I/O, and runtime state;
- MT5 Desktop PID 30356 is running and was not restarted or reconfigured;
- ports 7341, 7343, 7344, 7345, and 8000 are free;
- port 4173 is owned by an unrelated preview process and port 4205 by an
  unrelated local HTTP server;
- unrelated GBrain and trade-proposal MCP helpers remain active;
- no GoTrader runtime supervisor, observer, MT5 bridge/upstream, or historical
  download is running;
- approximately 24.67 GB disk is free, but only about 3.03 GB physical memory
  was free and observed CPU load was approximately 59 percent.

## Restrictions For This Run

1. Work only in `gotrader-backtest-bt1-5`.
2. Do not modify the primary, BT1, B1.2, A3.2, GBrain, or planning worktrees.
3. Do not stop or restart MT5 or another worktree's healthy service.
4. Do not use ports 4173 or 4205 and do not run browser tests.
5. Do not start the live MT5 bridge, upstream, or deep-history retrieval while
   the resource and concurrency restrictions above remain.
6. Use fixture-backed, bounded pilot data below this worktree's isolated
   ignored `.gotrader` root for implementation validation.
7. Re-run concurrency, resource, disk, MT5 login, port, and B1.2 checks before
   any live qualification.
8. Never overlap a BT1.5 live job with the B1.2 start window or observer.

## Authority

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
canCreateEvidence: false
canApproveReadiness: false
canApplyCalibration: false
canCreateTradeIntent: false
```

The word "contract" in BT1.5 documentation refers to a software schema or
data agreement. It does not classify the MT5 CFD as a futures contract.

## Live Qualification Gate

Live qualification remains deferred until a fresh preflight proves:

- B1.2 has no running or imminent observer;
- no competing runtime, bridge, upstream, browser, or deep-history work;
- ports and isolated storage are coherent;
- MT5 is logged in and read-only historical access is healthy;
- sufficient memory and disk headroom for the capacity plan;
- exact clean committed BT1.5 candidate;
- authority remains `none / none / none`.

Until then, BT1.5 may produce only offline tooling and deterministic evidence.
BT2 remains blocked.

The implemented live runner now requires an integrity-hashed preflight no more
than fifteen minutes old. It verifies exact branch and HEAD, clean worktree,
B1.2 priority-window exclusion, no observer/runtime/historical/heavy-job
overlap, one MT5 Desktop process, coherent read-only bridge/upstream listeners,
healthy authority-none endpoints, and configured disk/memory/CPU/I/O bounds.
The runner rejects a missing, stale, blocked, mismatched, or tampered preflight.
