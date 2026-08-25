# INT-3A.3 Typecheck and Build

## Required correction

The initial standalone typecheck exposed stale types in the deterministic INT-3A.2 acceptance harness. The fixture omitted required candle/timeframe metadata and used outdated context status literals. A narrow type-only correction was made in `src/lib/operatorConsole/int3a2ProductionAcceptance.ts`; no strategy, geometry, aggregation, or UI behavior changed.

## Final results

- `npm.cmd run typecheck`: passed, exit 0
- `npm.cmd run build`: passed, exit 0; 3,096 modules transformed
- `npm.cmd run test:int-3a-2-production-browser`: passed, exit 0, Chromium desktop/mobile
- `npm.cmd run test:source-integrity`: passed
- `npm.cmd run test:provenance`: passed
- `npm.cmd run test:safety`: passed
- `npm.cmd run test:mt5-readonly-safety`: passed

The build retained existing accepted Rollup circular-chunk and chunk-size warnings. No new build error was introduced.

`test:int-3a-2-production-conflict` is composite coverage (snapshot, real scanner, stubbed Activate Market), not full production Current Read/Activate Market E2E. The browser scenario supplies the downstream production-path acceptance proof.
