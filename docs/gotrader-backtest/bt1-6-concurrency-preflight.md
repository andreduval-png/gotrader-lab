# BT1.6 Concurrency Preflight

Date: 2026-08-07

Decision:

```text
BT1_6_SAFE_WITH_RESTRICTIONS
```

BT1.6 implementation and fixture validation may proceed only in
`gotrader-backtest-bt1-6`. Live MT5 diagnostics, the capacity pilot, and the
two-year retrieval are deferred.

Observed before the worktree was created:

- BT1.5 was clean at `471657a920fa863773f14e84d5151b3e55c6a759`;
- B1.2 was clean and stopped at `441188ac9890c99493b8737691b5e8af4b32f97a`;
- its Monday operational canary retained priority;
- no GoTrader runtime, observer, historical process, bridge, or upstream was running;
- ports 7341, 7343, 7344, 7345, and 8000 were free;
- MT5 Desktop PID 30356 remained running and was not changed;
- CPU averaged 26.85 percent, free memory was 3.02 GiB, and free disk was 23.96 GiB;
- unrelated ports 4173 and 4205 and two MCP helpers remained untouched.

Live work requires a new integrity-hashed BT1.5 preflight after the read-only
endpoints are healthy. It must prove at least 4 GiB free memory, required disk
headroom, exact clean candidate identity, one connected MT5 process, coherent
ports, no B1.2 or heavy-job overlap, and authority `none / none / none`.

The historical job must checkpoint and yield before B1.2 becomes imminent.
