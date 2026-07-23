# GoTrader Infrastructure Track A1 Runtime Report

Generated: 2026-07-23

## Final Status

**TRACK A1 PASSED WITH DOCUMENTED OPERATING LIMITATIONS**

The browser-independent read-only runtime is established and passed deterministic process,
ownership, recovery, and live MT5 acceptance on isolated ports. Default ports remain
occupied by services from the Phase 3F worktree, so this worktree correctly refuses to
take ownership until those services are stopped from their owning worktree.

## 1. Starting Branch and Commit

```text
source branch: codex/gotrader-v2-phase-3f-ifvg-evidence
source commit: dadee75 Complete IFVG Phase 3 canary evidence contracts
```

## 2. Final Branch and Commit

```text
branch: codex/gotrader-infrastructure-track-a1
implementation commit: reported in the final Codex handoff
```

## 3. Files Created and Modified

Created:

- `src/lib/alwaysOnRuntime/*`
- `scripts/gotrader-runtime-core.mjs`
- `scripts/gotrader-runtime-io.mjs`
- `scripts/gotrader-runtime-supervisor.mjs`
- `scripts/gotrader-runtime-control.mjs`
- `scripts/gotrader-runtime-test-service.mjs`
- `scripts/test-gotrader-runtime.mjs`
- `docs/gotrader-runtime/*`

Modified:

- `package.json`
- `scripts/start-mt5-readonly-bridge.mjs`

The wrapper modification adds a read-only service-version marker for stale-version
detection. No market-data or strategy behavior changed.

## 4. Runtime Architecture

```text
MetaTrader 5 Desktop (external)
  -> MT5 read-only Python upstream
    -> GoTrader MT5 read-only bridge
      -> health/time/quote/candle consumers
```

The foreground Node supervisor owns only the two read-only child services.

## 5. Service Registry

The versioned `always_on_read_only` allowlist contains:

1. `mt5_terminal`
2. `mt5_readonly_upstream`
3. `mt5_readonly_bridge`

Vite, LLM, OpenClaw, TradingView, research collectors, autonomous cycles, Paper-Demo, and
execution services are excluded.

## 6. Worktree Identity Model

Repository root, branch, HEAD, script paths, command arguments, ports, and process
fingerprints are recorded. Exact current-worktree listeners may be adopted. Same-named
listeners from other worktrees and unknown processes block startup.

## 7. Port Ownership Model

Default ports:

```text
8000 upstream
7341 bridge
```

Observed at acceptance:

```text
8000 -> PID 33876 -> Phase 3F worktree
7341 -> PID 37316 -> Phase 3F worktree
```

Track A1 returned `blocked_foreign_worktree` and did not terminate either process.

## 8. Startup Behavior

Startup validates Node, Python, `MetaTrader5`, MT5 Desktop, script paths, worktree
identity, and port ownership. It starts upstream first, waits for `/health`, then starts
the bridge and waits for `/health`.

## 9. Shutdown Behavior

Shutdown stops bridge then upstream after re-verifying process identity. MT5 Desktop is
left running.

## 10. Status and Health

Commands:

```text
npm.cmd run gotrader:runtime:status
npm.cmd run gotrader:runtime:health
```

Status is snapshot-only. Health performs live compact probes. Neither emits raw candles.

## 11. Heartbeat Model

Process heartbeats default to five seconds. Endpoint health defaults to ten seconds.
Process health is distinct from quote freshness, candle availability, and historical time
eligibility.

## 12. Restart Policy

Five attempts are allowed per ten-minute window with bounded delays of 1, 2, 5, then 30
seconds. An upstream restart also restarts its dependent bridge.

## 13. PID and Lock Model

Worktree-scoped state:

```text
.gotrader/runtime/always_on_read_only/
```

Locks use atomic create and stale-PID recovery. Each managed service receives an
independent PID and fingerprint record.

## 14. Log Model

Supervisor and service logs are bounded to 1 MiB with five retained files. Secret-like
keys and Bearer credentials are redacted. Raw candles, account, order, position, deal,
and credential payloads are not logged.

## 15. Recovery Behavior

Verified with isolated child processes and live read-only MT5 services:

- bridge crash produced a new bridge PID;
- upstream crash produced a new upstream PID;
- dependent bridge also received a new PID;
- stop released both isolated ports;
- unknown listener was blocked and left untouched;
- stale lock recovered atomically.

## 16. Live Acceptance

Isolated ports:

```text
upstream: 18000
bridge: 17341
```

Results:

```text
MT5 process: healthy
upstream /health: 200
upstream /status: 200
bridge /health: 200
bridge /status: 200
bridge /time-contract: 200
bridge /quote: 200
bridge /candles: 200
quote classification: fresh_or_market_quiet
candle classification: available
shutdown: passed
ports released: yes
```

Runtime state was `degraded`, not blocked, because the historical MT5 time contract
remains unverified. That limitation is intentionally inherited from Phase 3F.

## 17. Test Commands

```text
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test
npm.cmd run test:gotrader-runtime
npm.cmd run test:core
npm.cmd run test:strategy-baselines
npm.cmd run test:source-integrity
npm.cmd run test:provenance
npm.cmd run test:safety
npm.cmd run test:browser-smoke
npm.cmd run test:v2-baseline-snapshots
npm.cmd run test:v2-candle-repository
npm.cmd run test:v2-mt5-time-normalization
npm.cmd run test:v2-mt5-upstream-time-contract
npm.cmd run test:v2-mt5-terminal-clock
npm.cmd run test:v2-context-foundation
npm.cmd run test:v2-context-compatibility
npm.cmd run test:v2-ifvg-phase3-canary-gate
npm.cmd run test:v2-ifvg-phase3-evidence
git diff --check
```

## 18. Exact Results

The acceptance matrix passed:

```text
typecheck: passed
build: passed (pre-existing Rollup circular-chunk and size warnings only)
ICT strategy-suite smoke: passed
core V2 baseline: passed
strategy baselines: passed
source integrity: passed
provenance: passed
safety: passed
browser smoke: 44/44 passed
Phase 2A context foundation: passed
Phase 2A context compatibility: passed
Phase 3 canary gate: passed
Phase 3 evidence contract: passed
Track A1 runtime tests: 12/12 passed
live isolated startup and health: passed
bridge crash recovery: passed
upstream and dependent-bridge recovery: passed
clean shutdown and port release: passed
foreign-worktree ownership protection: passed
```

The baseline gate remains `blocked_insufficient_comparison_data`, production adoption
remains false, and Phase 4 implementation is not authorized. Those are preserved
research lifecycle states, not Track A1 failures.

## 19. Frozen Strategy Hashes

Expected and unchanged:

```text
IFVG v3
1661113c11dccbb53516a5b42ba1dc70a9dbb4f5e7d33f4f03fb01e79116951a

IFVG v2
3dcf4a0a0be9689031d42f4ec11ea6813b26c2314f830ea9f5a6f29001479224

Strategy catalog
43e146df111166e8ab508288ce42afae22aca4ca18e1be07320f374b0a3fa1de
```

## 20. Authority and No-Strategy Result

```text
executionAuthority: none
brokerAuthority: none
readinessOverrideAuthority: none
productionAdoptionAllowed: false
```

Runtime tests scan the implementation and confirm it imports no strategy, Current
Opportunity, Current Read, Research Cycle, validation, evidence, readiness, Paper-Demo,
execution, or OpenClaw trading module.

## 21. Known Limitations

1. Default ports are currently owned by the Phase 3F worktree.
2. Historical MT5 provider time basis and DST policy remain unverified.
3. The supervisor is foreground/repository-contained, not a Windows Service.
4. UI and strategy-cycle scheduling intentionally remain outside Track A1.

## 22. Rollback

Stop the runtime, confirm its managed ports are released, and revert the isolated Track A1
commit. MT5 Desktop and strategy artifacts do not require rollback.

## 23. Track A2 Prerequisites

- choose one approved worktree to own default ports;
- resolve historical MT5 time-contract verification;
- operate Track A1 through an extended observation window;
- retain stable process and recovery logs;
- separately authorize autonomous closed-candle scheduling.

## 24. Explicit Boundary

Track A1 implemented no autonomous cycles, trade intents, evidence creation, Paper-Demo,
broker execution, account/order/position access, or AI trading authority.
