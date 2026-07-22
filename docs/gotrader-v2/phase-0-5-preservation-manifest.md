# GoTrader V2 Phase 0.5 Preservation Manifest

## Preservation record

- Source worktree: `C:/Users/andre/OneDrive/Documents/gotrader`
- Source branch: `local-restart-safety-check-2`
- Source HEAD: `f6dbe33489a122d36995c5eb260d763917d186b3`
- Clean migration worktree: `C:/Users/andre/OneDrive/Documents/gotrader-v2-phase0-baseline`
- Migration branch: `gotrader-v2/phase-0-baseline`
- Preservation stash object: `ac572c4a7d69095db06918b2bd5f445ff3714241`
- Stash message: `preserve pre-v2-phase-0-5 dirty worktree 2026-07-22`

The stash was created with tracked and untracked files, excluding Python cache
output, and then applied back to the source worktree. The source worktree therefore
retains its active files while the stash object provides a recoverable snapshot.
The clean migration worktree was created directly from the recorded base commit.

## Phase 0 paths extracted

```text
docs/architecture/gotrader-v2-architecture-specification-rev1.md
docs/architecture/gotrader-v2-audit.md
docs/architecture/gotrader-v2-verification-report.md
docs/gotrader-v2/golden-fixture-policy.md
docs/gotrader-v2/migration-parity-policy.md
docs/gotrader-v2/phase-0-baseline-report.md
docs/gotrader-v2/strategy-manifest.md
docs/gotrader-v2/test-manifest.md
package.json (V2 script hunks only)
scripts/test-gotrader-system-coordination.mjs
scripts/test-ict-out-of-sample-validation.mjs
scripts/test-ict-phase2-models.mjs
scripts/test-regime-classifier.mjs
scripts/v2-baseline/*
src/lib/v2Baseline/*
tests/fixtures/v2-baseline/*
```

The architecture specification and Phase 0 reports were finalized in the clean
worktree. No source feature stream was used to create them.

## Mixed path handled at hunk level

`package.json` contained unrelated account-risk, LLM concurrency, MT5 recovery,
research-quality attribution, and research-cycle linkage commands. Only
`typecheck` and the V2 baseline suite commands were transferred.

## Unrelated tracked changes preserved and excluded

```text
docs/gotrader-cycle-to-paper-execution-flow.md
docs/ifvg-performance-audit.md
scripts/gotrader-paper-demo-gateway-core.mjs
scripts/llm-local-bridge-server.mjs
scripts/mt5-readonly-upstream.py
scripts/run-auto-research-candidate.mjs
scripts/start-mt5-readonly-bridge.mjs
scripts/test-auto-paper-demo-cycle.mjs
scripts/test-autonomous-calibration-auto-apply.mjs
scripts/test-forward-evidence-ledger.mjs
scripts/test-operator-console.mjs
scripts/test-paper-demo-gateway.mjs
src/components/common/IfvgForwardEvidenceCard.tsx
src/components/operator/OperatorConsoleView.tsx
src/components/paper-demo/PaperDemoOperationsView.tsx
src/components/research-quality/ResearchQualityView.tsx
src/lib/autonomousResearch/autonomousCalibrationAutoApplyPolicy.ts
src/lib/autonomousResearch/autonomousResearchStorage.ts
src/lib/autonomousResearch/autonomousResearchTypes.ts
src/lib/autonomousResearch/runAutonomousResearchLoop.ts
src/lib/backtesting/backtestTypes.ts
src/lib/backtesting/runBacktest.ts
src/lib/forwardEvidence/buildForwardEvidenceEntry.ts
src/lib/forwardEvidence/buildForwardEvidenceGatewayReport.ts
src/lib/forwardEvidence/evaluateForwardEvidenceLedger.ts
src/lib/forwardEvidence/forwardEvidenceTypes.ts
src/lib/forwardEvidence/ifvgForwardEvidencePolicy.ts
src/lib/forwardEvidence/index.ts
src/lib/ict-strategy-suite/ictActivateMarketPipeline.ts
src/lib/ict-strategy-suite/ictActivateMarketPipelineTypes.ts
src/lib/operatorConsole/buildOperatorConsoleSnapshot.ts
src/lib/operatorConsole/index.ts
src/lib/operatorConsole/operatorConsoleStore.ts
src/lib/operatorConsole/operatorConsoleTypes.ts
src/lib/operatorConsole/operatorCycle.ts
src/lib/paperDemoGateway/paperDemoGatewayTypes.ts
src/lib/paperDemoOperations/autoPaperDemoCycleTypes.ts
src/lib/paperDemoOperations/runAutoPaperDemoCycle.ts
src/lib/readiness/readinessGate.ts
src/lib/researchCycle/researchCycleTypes.ts
src/lib/researchCycle/runResearchCycle.ts
src/lib/researchQuality/analyzeValidationResults.ts
src/lib/researchQuality/drawdownAnalysis.ts
src/lib/researchQuality/falsePositiveAnalysis.ts
src/lib/researchQuality/index.ts
src/lib/researchQuality/researchQualityTypes.ts
src/lib/researchQuality/sessionComparison.ts
src/lib/risk/index.ts
src/lib/selfImprovement/createCalibrationProposal.ts
src/lib/validation/runValidationSuite.ts
src/lib/validation/validationTypes.ts
src/lib/validationChain/index.ts
tests/smoke/routes.spec.ts
```

The four extracted harness files remain present in the source worktree as part of
the preserved snapshot. Their neutral Phase 0 hunks were independently committed
on the migration branch.

## Unrelated untracked changes preserved and excluded

```text
docs/gotrader-v2-audit.md
docs/gotrader-v2-verification-report.md
docs/research-quality-failure-attribution.md
docs/research-quality-failure-reduction-plan.md
docs/simulation-account-risk-control-plane.md
scripts/gotrader-account-risk-core.mjs
scripts/test-account-risk-engine.mjs
scripts/test-llm-bridge-concurrency.mjs
scripts/test-mt5-readonly-upstream-recovery.py
scripts/test-mt5-readonly-wrapper-recovery.mjs
scripts/test-research-cycle-validation-linkage.mjs
scripts/test-research-quality-failure-attribution.mjs
src/lib/forwardEvidence/analyzeForwardEvidenceQuality.ts
src/lib/operatorConsole/operatorMemorySummary.ts
src/lib/researchQuality/researchQualityFailureAttribution.ts
src/lib/researchQuality/researchQualityFailureAttributionTypes.ts
src/lib/risk/accountRiskTypes.ts
src/lib/validationChain/researchCycleValidationChain.ts
```

## Intentionally excluded transient material

```text
scripts/__pycache__/
node_modules junction in the clean worktree
dist/
.gotrader/
state/regime_history.jsonl
logs and runtime artifacts
.env.local and other ignored local environment files
```

None of this material is part of a Phase 0.5 commit.

## Recovery

The primary recovery source is the untouched source worktree. The independent
backup can be inspected with:

```powershell
git show --stat ac572c4a7d69095db06918b2bd5f445ff3714241
```

To recover into a separate worktree without disturbing active files:

```powershell
git worktree add C:\Users\andre\OneDrive\Documents\gotrader-dirty-recovery f6dbe33489a122d36995c5eb260d763917d186b3
git -C C:\Users\andre\OneDrive\Documents\gotrader-dirty-recovery stash apply ac572c4a7d69095db06918b2bd5f445ff3714241
```

Do not drop the preservation stash until all excluded feature streams have been
independently committed, moved, or intentionally discarded.
