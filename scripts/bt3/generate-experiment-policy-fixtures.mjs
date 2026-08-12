#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-experiment-policy/generator");
const fixtureRoot = path.join(root, "tests/fixtures/bt3-experiment-policy");
const writeMode = process.argv.includes("--write");
const stable = (value) => {
  const sort = (item) => Array.isArray(item) ? item.map(sort) : item && typeof item === "object"
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])])) : item;
  return `${JSON.stringify(sort(value), null, 2)}\n`;
};
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export async function buildExperimentPolicyScenario() {
  compileTypescriptModules({ files: [path.join(root, "src/lib/experimentPolicy/controlledExperimentPolicy.ts")], outRoot });
  const policy = await import(`${pathToFileURL(path.join(outRoot, "controlledExperimentPolicy.mjs")).href}?v=${Date.now()}`);
  const register = (familyKey, pValues) => policy.preregisterControlledExperiment({
    familyKey,
    hypothesis: "At least one preregistered candidate has positive out-of-sample expectancy after family correction.",
    primaryStatistic: "one-sided studentized mean out-of-sample R multiple",
    tail: "right",
    alpha: 0.05,
    fdrTarget: 0.05,
    dependencyAssumption: "independent_or_positive_dependency",
    candidates: pValues.map((_, index) => ({ candidateId: `${familyKey}-candidate-${String(index + 1).padStart(2, "0")}`, label: `Candidate ${index + 1}` }))
  });
  const scenario = async (familyKey, pValues) => {
    const registration = await register(familyKey, pValues);
    const trials = registration.candidates.map((candidate, index) => ({ familyId: registration.familyId, candidateId: candidate.candidateId, rawPValue: pValues[index] }));
    return { registration, trials, assessment: await policy.assessMultipleComparisons(registration, trials) };
  };
  return {
    policy,
    scenarios: {
      partial_reject: await scenario("partial-reject", [0.001, 0.01, 0.03, 0.2]),
      all_reject: await scenario("all-reject", [0.001, 0.002, 0.003]),
      no_reject: await scenario("no-reject", [0.1, 0.2, 0.9]),
      ties_and_boundaries: await scenario("ties-boundaries", [0, 0.0125, 0.0125, 1])
    }
  };
}

const firstScenario = await buildExperimentPolicyScenario();
const first = stable({ schemaVersion: "gotrader-bt3-experiment-policy-snapshot-v1", payload: firstScenario.scenarios });
const secondScenario = await buildExperimentPolicyScenario();
const second = stable({ schemaVersion: "gotrader-bt3-experiment-policy-snapshot-v1", payload: secondScenario.scenarios });
assert.equal(second, first);
fs.mkdirSync(fixtureRoot, { recursive: true });
const snapshotPath = path.join(fixtureRoot, "experiment-policy.snapshot.json");
const hashPath = path.join(fixtureRoot, "snapshot-hashes.json");
const manifest = stable({ schemaVersion: "gotrader-bt3-experiment-policy-hashes-v1", hashes: { "experiment-policy.snapshot.json": sha256(first) } });
if (writeMode) {
  fs.writeFileSync(snapshotPath, first, "utf8");
  fs.writeFileSync(hashPath, manifest, "utf8");
} else {
  assert.equal(fs.readFileSync(snapshotPath, "utf8").replace(/\r\n/g, "\n"), first);
  assert.equal(fs.readFileSync(hashPath, "utf8").replace(/\r\n/g, "\n"), manifest);
}
console.log(JSON.stringify({
  status: writeMode ? "written" : "passed",
  byteStable: true,
  familyCount: 4,
  snapshotHash: `sha256:${sha256(first)}`,
  familyIds: Object.fromEntries(Object.entries(firstScenario.scenarios).map(([key, value]) => [key, value.registration.familyId])),
  assessmentIds: Object.fromEntries(Object.entries(firstScenario.scenarios).map(([key, value]) => [key, value.assessment.assessmentId])),
  mt5Contacted: false
}, null, 2));
