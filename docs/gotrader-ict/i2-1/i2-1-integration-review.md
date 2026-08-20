# I2.1 Integration and Regression Review

## Boundaries

- Registry: ICT 2022 and PO3 remain additive `ACTIVE_RESEARCH`; legacy `amd_power_of_three_research_v1` remains preserved with `supersededBy: ict_power_of_three_v1`; Judas remains `SOURCE_BLOCKED` and non-executable.
- I1: canonical time, liquidity, IRL/ERL, dealing range, structure, imbalance, and valid-from ownership remain unchanged.
- C1/C1.1: `structuralBias`, `currentFlowDirection`, `setupMaturationDirection`, and `liquidityPath` remain distinct inputs. No flat MTF alignment returned.
- S1: SMT remains optional and separately owned. No I2 model calculates SMT.
- BT2: `ict-i2-bt2-request-v1` remains compact; BT2 alone owns fills, cost, ambiguity, and outcome. Same-bar ambiguity remains stop-first.
- Current Read: deterministic projection passed; Judas is visibly source-blocked. State assignment has no LLM dependency.
- Geometry: ICT 2022 and PO3 retain their accepted structural geometry. RR below profile minimum remains non-actionable; current price never replaces a missed intended entry. Canonical G1 is still dirty and unaccepted, so it was not imported.
- Frozen strategies: no existing strategy implementation, fixture, snapshot, or frozen manifest changed.

## Regression

Passed: ICT 2022/model causality, PO3/model causality, Judas/source-gate causality, I2 BT2, I2 Current Read, I2 governance, I1 canonical facts, C1 multi-timeframe, C1 Current Read, C1.1 top-down context, IFVG, Silver Bullet, Turtle Soup, CISD, CMD high-displacement v2, Nasdaq London Raid filtered v2, MT5 read-only safety, source integrity, provenance, safety, typecheck, and build.

Build retained the existing Rollup large-chunk warning. The I2-base index-SMT wrapper reproduced stale generated resolution for `.gotrader/currentOpportunity`; the exact accepted S1 worktree remains separate and unchanged. The broad strategy-suite wrapper reproduced its missing generated `ictCalibrationBridge.mjs`. The strategy-baselines wrapper reproduced CRLF/LF-only frozen snapshot mismatch. These are `PRE_EXISTING_INFRASTRUCTURE_DEFECT` findings and were not repaired by changing fixtures or generated harnesses.

## I3 Dependency Review

Judas has no technical or semantic dependency edge into MMXM/MMBM/MMSM. I1 supplies stable IRL/ERL, liquidity transitions, dealing ranges, structure, and source lineage; PO3 supplies accepted AMD lifecycle concepts; C1/C1.1, S1, and BT2 boundaries passed. However, canonical geometry is an explicit I3 prerequisite and the G1 worktree is currently dirty and unaccepted. Therefore Judas does not block I3, but G1 acceptance does.

Authority remains none/none/none. `researchValidated` is false and production adoption is not allowed.
