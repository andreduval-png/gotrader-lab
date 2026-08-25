# INT-3A.2 Acceptance Input Boundary

The hook is `src/lib/operatorConsole/int3a2ProductionAcceptance.ts`, selected only in development by `acceptanceScenario=int3a2-live-conflict`.

The controlled values are raw IFVG candle inputs, canonical ICT facts, deterministic timestamps, source identity, and compact market-depth metadata. These inputs sit before both strategy producers. The resulting producer outputs enter the normal Current Read and Activate Market path.

Forbidden final-state injection is absent. The old `int3a1Fixture=conflict` snapshot paint was removed; visiting that parameter now returns the normal dashboard without an overlay (HTTP 200, not a special fixture or 404).
