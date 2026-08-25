# I3 Concurrency Preflight

Decision: `ICT_I3_SAFE_WITH_RESTRICTIONS`.

- Base: clean G1.1 HEAD `3503efe82ed88b9c119136480de4c4800e66a602`.
- Isolated branch/worktree: `codex/gotrader-ict-i3-market-maker` at `gotrader-ict-i3-market-maker`.
- R1 family-v4 remains the only active historical workload and must not be interrupted.
- Free memory at start: 2,773,749,760 bytes.
- Free disk at start: 20,087,255,040 bytes.
- CPU was saturated by the bounded R1 workload.

Implementation, deterministic fixtures, typecheck, and bounded regression are permitted. The certified USTECH historical baseline is deferred until family-v4 releases the host. No second historical operator may start.
