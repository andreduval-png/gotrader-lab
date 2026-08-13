#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const sourcePath = path.join(
  projectRoot,
  "src",
  "lib",
  "autonomousResearch",
  "autonomousCalibrationAutoApplyPolicy.ts"
);
const outRoot = path.join(projectRoot, ".gotrader", "autonomous-calibration-auto-apply-test");
const outPath = path.join(outRoot, "autonomousCalibrationAutoApplyPolicy.mjs");

function compileForNode() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });
  const transpiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: sourcePath
  }).outputText;
  fs.writeFileSync(outPath, transpiled, "utf8");
}

function installLocalStorage() {
  const storage = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
      clear: () => storage.clear()
    }
  };
  return storage;
}

const authorityNone = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

async function main() {
  compileForNode();
  const storage = installLocalStorage();
  const policy = await import(pathToFileURL(outPath).href);

  assert.equal(
    policy.loadAutonomousCalibrationAutoApplyPreference().enabled,
    false,
    "missing persisted consent must fail closed"
  );

  storage.set(
    policy.AUTONOMOUS_CALIBRATION_AUTO_APPLY_STORAGE_KEY,
    JSON.stringify({ autoApplyPolicyEnabled: true })
  );
  const migratedLegacy = policy.loadAutonomousCalibrationAutoApplyPreference();
  assert.equal(migratedLegacy.enabled, false, "legacy persisted state must not grant apply consent");
  assert.equal(migratedLegacy.source, "legacy_state_rejected");

  const disabledPermissions = policy.summarizeAutonomousCalibrationPermissions(false);
  assert.equal(disabledPermissions.proposalGenerationAllowed, true);
  assert.equal(disabledPermissions.proposalScoringAllowed, true);
  assert.equal(disabledPermissions.dryRunValidationAllowed, true);
  assert.equal(disabledPermissions.calibrationApplyAllowed, false);
  assert.equal(
    disabledPermissions.blocker,
    policy.AUTONOMOUS_CALIBRATION_APPLY_NOT_ENABLED
  );

  const enabledPreference = policy.saveAutonomousCalibrationAutoApplyPreference(true);
  assert.equal(enabledPreference.enabled, true, "operator opt-in must be explicit");
  assert.equal(policy.loadAutonomousCalibrationAutoApplyPreference().enabled, true);

  const baseGuard = {
    preference: enabledPreference,
    runOptInEnabled: true,
    eligibilityPolicyEnabled: true,
    eligibilityApproved: true,
    cancellationRequested: false,
    proposalStale: false,
    proposalId: "proposal_safe_1",
    eligibilityProposalId: "proposal_safe_1",
    persistedProposalFound: true,
    persistedProposalMatches: true,
    proposalStatus: "proposed",
    proposedChanges: {
      confluenceThreshold: 0.64,
      targetRMultiple: 2.5,
      ictScoringWeights: { liquiditySweep: 1.1 },
      agentWeights: { "ict-liquidity-agent": 1.05 }
    },
    allowedAgentWeightFields: ["ict-liquidity-agent"],
    baseProfileId: "agent_consensus",
    targetProfileId: "agent_consensus",
    ...authorityNone
  };

  const safeApply = policy.validateAutonomousCalibrationFinalApply(baseGuard);
  assert.equal(safeApply.allowed, true, "explicit opt-in must permit only allowlisted research fields");
  assert.deepEqual(safeApply.blockerCodes, []);

  const disabledApply = policy.validateAutonomousCalibrationFinalApply({
    ...baseGuard,
    preference: policy.saveAutonomousCalibrationAutoApplyPreference(false),
    runOptInEnabled: false
  });
  assert.equal(disabledApply.allowed, false);
  assert.ok(
    disabledApply.blockerCodes.includes(policy.AUTONOMOUS_CALIBRATION_APPLY_NOT_ENABLED),
    "apply must return the compact opt-in blocker"
  );

  const frozenApply = policy.validateAutonomousCalibrationFinalApply({
    ...baseGuard,
    preference: policy.saveAutonomousCalibrationAutoApplyPreference(true),
    baseProfileId: "ifvg_fresh_retest_v3_research",
    targetProfileId: "ifvg_fresh_retest_v3_research"
  });
  assert.equal(frozenApply.allowed, false, "IFVG v3 must never be mutated in place");
  assert.ok(
    frozenApply.blockerCodes.includes(
      "autonomous_calibration_frozen_profile_requires_new_version"
    )
  );

  const frozenV4Apply = policy.validateAutonomousCalibrationFinalApply({
    ...baseGuard,
    preference: policy.saveAutonomousCalibrationAutoApplyPreference(true),
    baseProfileId: "ifvg_fresh_retest_v4_candidate",
    targetProfileId: "ifvg_fresh_retest_v4_candidate"
  });
  assert.equal(frozenV4Apply.allowed, false, "IFVG v4 must never be mutated in place");
  assert.ok(
    frozenV4Apply.blockerCodes.includes(
      "autonomous_calibration_frozen_profile_requires_new_version"
    )
  );

  const unsafeFields = policy.validateAutonomousCalibrationFinalApply({
    ...baseGuard,
    preference: policy.loadAutonomousCalibrationAutoApplyPreference(),
    proposedChanges: {
      confluenceThreshold: 0.64,
      executionAuthority: "live",
      brokerAuthority: "full",
      readinessOverrideAuthority: "granted",
      rawCandles: [{ close: 1 }]
    },
    executionAuthority: "live",
    brokerAuthority: "full",
    readinessOverrideAuthority: "granted"
  });
  assert.equal(unsafeFields.allowed, false);
  assert.ok(unsafeFields.blockerCodes.includes("autonomous_calibration_authority_violation"));
  assert.ok(
    unsafeFields.blockerCodes.includes("autonomous_calibration_fields_not_allowlisted")
  );
  assert.equal(JSON.stringify(unsafeFields).includes('"close":1'), false, "guard output must not serialize candles");

  const canceledApply = policy.validateAutonomousCalibrationFinalApply({
    ...baseGuard,
    preference: policy.loadAutonomousCalibrationAutoApplyPreference(),
    cancellationRequested: true
  });
  assert.equal(canceledApply.allowed, false);
  assert.ok(canceledApply.blockerCodes.includes("autonomous_calibration_apply_canceled"));

  const staleApply = policy.validateAutonomousCalibrationFinalApply({
    ...baseGuard,
    preference: policy.loadAutonomousCalibrationAutoApplyPreference(),
    persistedProposalMatches: false
  });
  assert.equal(staleApply.allowed, false);
  assert.ok(staleApply.blockerCodes.includes("autonomous_calibration_apply_stale"));

  const loopSource = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "autonomousResearch", "runAutonomousResearchLoop.ts"),
    "utf8"
  );
  const applySource = fs.readFileSync(
    path.join(projectRoot, "src", "lib", "autonomousResearch", "autoApplyResearchCalibration.ts"),
    "utf8"
  );
  const viewSource = fs.readFileSync(
    path.join(projectRoot, "src", "components", "autonomous-research", "AutonomousResearchView.tsx"),
    "utf8"
  );
  assert.match(loopSource, /partialSettings\.autoApplyPolicyEnabled === true/);
  assert.match(loopSource, /persistedAutoApplyPreference\.enabled/);
  assert.match(loopSource, /cancellationRequested:\s*Boolean\(signal\?\.aborted\)/);
  assert.ok(
    applySource.indexOf("validateAutonomousCalibrationFinalApply") <
      applySource.indexOf("saveApprovedResearchCalibration(proposal"),
    "final guard must run before calibration storage mutation"
  );
  assert.match(viewSource, /Research calibration auto-apply is OFF/);
  assert.match(viewSource, /cannot enable\s+execution, broker authority, readiness override/);

  console.log(
    JSON.stringify(
      {
        status: "passed",
        defaultAutoApplyPolicyEnabled: false,
        proposalGenerationWhileDisabled: true,
        dryRunWhileDisabled: true,
        explicitOptInRequired: true,
        allowlistedFields: policy.AUTONOMOUS_CALIBRATION_ALLOWED_FIELDS,
        frozenIfvgV3MutationAllowed: false,
        frozenIfvgV4MutationAllowed: false,
        staleOrCanceledApplyAllowed: false,
        authority: authorityNone
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
