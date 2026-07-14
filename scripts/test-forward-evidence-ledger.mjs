#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "forward-evidence-ledger-test");

const compile = (sourceRelative, outputName, replacements = []) => {
  const sourcePath = path.join(root, sourceRelative);
  const outputPath = path.join(outRoot, outputName);
  const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: sourcePath
  }).outputText;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    replacements.reduce((value, [from, to]) => value.replaceAll(from, to), output),
    "utf8"
  );
};

const afterCutoff = (day, hour = 14) =>
  new Date(Date.UTC(2026, 6, 15 + day, hour)).toISOString();

async function main() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  compile("src/lib/forwardEvidence/forwardEvidenceTypes.ts", "forwardEvidenceTypes.mjs");
  compile(
    "src/lib/forwardEvidence/frozenProfileRegistry.ts",
    "frozenProfileRegistry.mjs",
    [["./forwardEvidenceTypes", "./forwardEvidenceTypes.mjs"]]
  );
  compile(
    "src/lib/forwardEvidence/buildForwardEvidenceEntry.ts",
    "buildForwardEvidenceEntry.mjs",
    [
      ["./forwardEvidenceTypes", "./forwardEvidenceTypes.mjs"],
      ["./frozenProfileRegistry", "./frozenProfileRegistry.mjs"]
    ]
  );
  compile(
    "src/lib/forwardEvidence/evaluateForwardEvidenceLedger.ts",
    "evaluateForwardEvidenceLedger.mjs",
    [
      ["./forwardEvidenceTypes", "./forwardEvidenceTypes.mjs"],
      ["./frozenProfileRegistry", "./frozenProfileRegistry.mjs"]
    ]
  );

  const registry = await import(pathToFileURL(path.join(outRoot, "frozenProfileRegistry.mjs")).href);
  const builder = await import(pathToFileURL(path.join(outRoot, "buildForwardEvidenceEntry.mjs")).href);
  const evaluator = await import(pathToFileURL(path.join(outRoot, "evaluateForwardEvidenceLedger.mjs")).href);
  const frozen = registry.ifvgFreshRetestV3FrozenProfile;

  assert.equal(frozen.profileId, "ifvg_fresh_retest_v3_research");
  assert.equal(frozen.profileVersion, "v3");
  assert.equal(frozen.validationCutoff, "2026-07-14T04:40:00.000Z");
  assert.equal(frozen.evidence.candleCount, 34_989);
  assert.equal(frozen.evidence.completedTrades, 172);
  assert.equal(frozen.evidence.targetFirstRate, 0.5523);
  assert.equal(frozen.evidence.averageR, 2.805);
  assert.equal(frozen.evidence.profitFactor, 5.979);
  assert.equal(frozen.evidence.uniqueDates, 95);
  assert.equal(frozen.evidence.positiveRollingWindows, 11);
  assert.equal(frozen.evidence.frozenOosWindowsPassed, 2);
  assert.equal(frozen.evidence.oosTrades, 64);
  assert.equal(frozen.evidence.oosAverageR, 3.458);
  assert.equal(frozen.evidence.oosProfitFactor, 8.081);
  assert.equal(frozen.evidence.oosAdditionalCostR, 2.958);
  assert.equal(frozen.evidence.monteCarloRobustness, "strong");
  assert.equal(frozen.frozenParameters.minimumRR, 2);
  assert.equal(frozen.frozenParameters.requireLatestClosedCandleRetest, true);
  assert.equal(frozen.frozenParameters.allowPostEntryConfirmation, false);
  assert.equal(frozen.mutationPolicy, "frozen_profile_no_mutation");
  assert.equal(frozen.futureChangesPolicy, "fork_new_profile_version_only");
  assert.equal(frozen.autoPromotionAllowed, false);

  const safeEntry = builder.buildForwardEvidenceEntry({
    sourceFingerprint: "mt5_forward_fp_001",
    setupTimestamp: afterCutoff(0),
    independentDate: "2026-07-15",
    forwardWindowId: "forward_2026_07_a",
    direction: "short",
    entryZone: { lower: 22_000, upper: 22_010 },
    stopReference: 22_020,
    targetReferences: [{ label: "external sell-side liquidity", price: 21_950 }],
    triggerEvidence: ["fresh clean retest", "latest closed candle"],
    missingEvidence: [],
    outcome: "target_first",
    realizedR: 2.5,
    notes: "Compact untouched forward result."
  });
  assert.equal(safeEntry.outcome, "target_first");
  assert.equal(safeEntry.authority.executionAuthority, "none");
  assert.equal(safeEntry.authority.brokerAuthority, "none");
  assert.equal(safeEntry.authority.readinessOverrideAuthority, "none");

  const preCutoff = builder.buildForwardEvidenceEntry({
    sourceFingerprint: "mt5_historical_fp",
    setupTimestamp: "2026-07-14T04:39:59.000Z",
    independentDate: "2026-07-14",
    forwardWindowId: "historical",
    direction: "long",
    outcome: "target_first",
    realizedR: 3
  });
  assert.equal(preCutoff.outcome, "rejected");
  assert.match(preCutoff.blockerSummary, /not after the frozen validation cutoff/i);

  const unsafeEntry = builder.buildForwardEvidenceEntry({
    sourceFingerprint: "mt5_forward_fp_unsafe",
    setupTimestamp: afterCutoff(1),
    independentDate: "2026-07-16",
    forwardWindowId: "forward_2026_07_a",
    direction: "short",
    outcome: "pending",
    notes: "must be removed with unsafe fields",
    rawCandles: [{ open: 1, high: 2, low: 0, close: 1 }],
    accountData: { balance: 10_000 },
    orderData: { route: "forbidden" },
    positionData: { side: "short" },
    token: "secret"
  });
  assert.equal(unsafeEntry.outcome, "rejected");
  const unsafeSerialized = JSON.stringify(unsafeEntry);
  assert.doesNotMatch(unsafeSerialized, /"(?:rawCandles|accountData|orderData|positionData|token)"\s*:/i);
  assert.doesNotMatch(unsafeSerialized, /"secret"/i);
  assert.equal(unsafeEntry.notes, "");

  const unsafeText = builder.buildForwardEvidenceEntry({
    sourceFingerprint: "mt5_forward_fp_unsafe_text",
    setupTimestamp: afterCutoff(2),
    independentDate: "2026-07-17",
    forwardWindowId: "forward_2026_07_a",
    direction: "long",
    notes: "api_key=must_not_persist"
  });
  assert.equal(unsafeText.outcome, "rejected");
  assert.equal(unsafeText.notes, "");
  assert.doesNotMatch(JSON.stringify(unsafeText), /must_not_persist/);

  const buildOutcomes = (count) => Array.from({ length: count }, (_, index) => {
    const dayIndex = index % 20;
    const winning = index % 5 !== 0;
    return builder.buildForwardEvidenceEntry({
      entryId: `forward_${index}`,
      timestamp: afterCutoff(dayIndex, 16),
      sourceFingerprint: `mt5_forward_fp_${Math.floor(index / 20)}`,
      setupTimestamp: afterCutoff(dayIndex, 14 + (index % 2)),
      independentDate: afterCutoff(dayIndex).slice(0, 10),
      forwardWindowId: index < 20 ? "forward_window_1" : "forward_window_2",
      direction: index % 2 ? "short" : "long",
      outcome: winning ? "target_first" : "invalidation_first",
      realizedR: winning ? 2.5 : -1
    });
  });

  const insufficient = evaluator.evaluateForwardEvidenceLedger(buildOutcomes(39).map((entry) => ({
    ...entry,
    independentDate: "2026-07-15",
    forwardWindowId: "forward_window_1"
  })));
  assert.equal(insufficient.reassessmentEligible, false);
  assert.equal(insufficient.recommendation, "keep_collecting");
  assert.match(insufficient.blockers.join(" "), /completed forward outcomes|independent dates|forward window/i);

  const eligible = evaluator.evaluateForwardEvidenceLedger(buildOutcomes(40));
  assert.equal(eligible.completedForwardOutcomes, 40);
  assert.equal(eligible.independentDates, 20);
  assert.equal(eligible.forwardWindows, 2);
  assert.equal(eligible.reassessmentEligible, true);
  assert.equal(eligible.recommendation, "reassess_for_paper_demo");
  assert.equal(eligible.autoPromotionAllowed, false);
  assert.equal(eligible.authority.executionAuthority, "none");
  assert.ok((eligible.averageR ?? 0) > 0);
  assert.ok((eligible.profitFactor ?? 0) > 1);

  const directMutation = registry.reviewFrozenProfileMutation({
    baseProfileId: frozen.profileId,
    targetProfileId: frozen.profileId,
    parameterMutationRequested: true
  });
  assert.equal(directMutation.blocked, true);
  assert.equal(directMutation.directMutationAllowed, false);
  assert.equal(directMutation.forkProposalAllowed, true);
  assert.equal(directMutation.requiredForkProfileId, "ifvg_fresh_retest_v4_candidate");
  const fork = registry.buildFrozenProfileForkProposalIntent();
  assert.equal(fork.status, "draft_only");
  assert.equal(fork.autoApplyAllowed, false);
  assert.equal(fork.authority.readinessOverrideAuthority, "none");

  const approvalSource = fs.readFileSync(
    path.join(root, "src/lib/selfImprovement/approveCalibrationProposal.ts"),
    "utf8"
  );
  assert.match(approvalSource, /reviewFrozenCalibrationProposal/);
  assert.match(approvalSource, /reviewFrozenProfileMutation/);

  console.log(JSON.stringify({
    status: "passed",
    profile: frozen.profileId,
    cutoff: frozen.validationCutoff,
    preservedEvidence: frozen.evidence,
    thresholds: evaluator.FORWARD_EVIDENCE_REASSESSMENT_THRESHOLDS,
    eligibleEvaluation: eligible,
    frozenMutation: directMutation,
    safety: {
      rawCandlesSerialized: false,
      accountOrderPositionSerialized: false,
      autoPromotionAllowed: false,
      authority: eligible.authority
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
