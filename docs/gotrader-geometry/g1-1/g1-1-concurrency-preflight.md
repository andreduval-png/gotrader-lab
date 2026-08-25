# G1.1 Concurrency Preflight

Decision: `G1_1_SAFE_WITH_RESTRICTIONS`

G1.1 uses `C:\Users\andre\OneDrive\Documents\gotrader-geometry-g1-1` on
`codex/gotrader-geometry-g1-1-canonical`, based on clean accepted I2.1 commit
`c0d2256596b5f07835041fccd23859fffef13cb3`.

The primary GoTrader worktree and the earlier dirty G1 worktree are read-only for
this task. The active bounded R1 family operator is not stopped, restarted, or
modified. Implementation, compact fixtures, typecheck, build, and bounded
read-only audits are allowed. Large historical replay and backtest jobs are
deferred while R1 is active.

At preflight the host had one R1 parent and one trial child, about 3.84 GB free
memory, and about 19.56 GB free disk. Shared `.gotrader` evidence is not written
by G1.1. No Paper Demo, broker, MT5, execution, order, or production authority is
introduced.

