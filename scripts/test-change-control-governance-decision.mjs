import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const decisionPath = new URL(
  "../docs/gotrader-backtest/change-control-governance-decision.json",
  import.meta.url,
);
const decision = JSON.parse(await readFile(decisionPath, "utf8"));

assert.equal(decision.schemaVersion, 1);
assert.equal(decision.status, "adopted_governance_process_only");
assert.match(decision.authorizationCommit, /^[0-9a-f]{40}$/);
assert.match(decision.acceptedParentCommit, /^[0-9a-f]{40}$/);
assert.match(decision.governanceBaselineCommit, /^[0-9a-f]{40}$/);

for (const source of decision.sourceInventory) {
  assert.match(source.blobId, /^[0-9a-f]{40}$/);
  const actual = execFileSync("git", ["rev-parse", `HEAD:${source.path}`], {
    encoding: "utf8",
  }).trim();
  assert.equal(actual, source.blobId, `${source.path} identity drifted`);
}

assert.deepEqual(decision.requiredSequence, [
  "exact_clean_preflight",
  "isolated_codex_branch",
  "explicit_authorization_commit",
  "narrow_implementation_commit",
  "focused_validation",
  "complete_regression_validation",
  "exact_identity_capture",
  "separate_acceptance_commit",
  "freeze_governance_update",
  "explicit_next_phase_decision",
]);

assert.equal(decision.identityBinding.implementationCommitMustBeIndependent, true);
assert.equal(decision.identityBinding.acceptanceCommitMustBeIndependent, true);
assert.equal(decision.failurePolicy.preserveFailures, true);
assert.equal(decision.failurePolicy.stopOnFailedGate, true);
assert.equal(decision.rollbackPolicy.exactRestoreIdentityRequired, true);
assert.equal(decision.evidenceRetention.acceptedEvidenceImmutable, true);
assert.equal(decision.evidenceRetention.failedEvidenceImmutable, true);
assert.equal(decision.evidenceRetention.rawCandlesMayBeCommitted, false);

assert.deepEqual(decision.authority, {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none",
  productionAdoptionAllowed: false,
  canCreateTradeIntent: false,
});

for (const [name, authorized] of Object.entries(decision.implicitAuthorizations)) {
  assert.equal(authorized, false, `${name} must require a separate decision`);
}

console.log("Change-control governance decision checks passed.");
