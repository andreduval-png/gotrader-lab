#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const safeSource = path.join(root, "docs", "sample-llm-agent-response.json");
const tempRoot = path.join(root, ".gotrader", "llm-safety-language-test");
const safePath = path.join(tempRoot, "safe-prohibition.json");
const unsafePath = path.join(tempRoot, "unsafe-instruction.json");

fs.mkdirSync(tempRoot, { recursive: true });
const baseline = JSON.parse(fs.readFileSync(safeSource, "utf8"));
const template = baseline[0];
for (const [agentId, agentName] of [
  ["llm-edge-auditor", "LLM Edge Auditor"],
  ["llm-execution-risk-reviewer", "LLM Execution Risk Reviewer"]
]) {
  if (!baseline.some((item) => item.agentId === agentId)) {
    baseline.push({ ...structuredClone(template), agentId, agentName });
  }
}

const safe = structuredClone(baseline);
safe.find((item) => item.agentId === "llm-validation-reviewer").safetyNotes = [
  "Readiness bypass is prohibited; readiness authority remains none."
];
fs.writeFileSync(safePath, `${JSON.stringify(safe, null, 2)}\n`, "utf8");

const unsafe = structuredClone(baseline);
unsafe.find((item) => item.agentId === "llm-validation-reviewer").safetyNotes = [
  "Use a readiness bypass to progress this candidate."
];
fs.writeFileSync(unsafePath, `${JSON.stringify(unsafe, null, 2)}\n`, "utf8");

const validate = (file) => spawnSync(
  process.execPath,
  ["scripts/gpt55-llm-agent-provider.mjs", "--validate-response-file", file],
  { cwd: root, encoding: "utf8" }
);

const safeResult = validate(safePath);
assert.equal(safeResult.status, 0, safeResult.stderr);

const unsafeResult = validate(unsafePath);
assert.notEqual(unsafeResult.status, 0, "affirmative readiness-bypass instruction must remain rejected");
assert.match(unsafeResult.stderr, /readiness bypass/i);

console.log("LLM safety-language validation test passed.");
