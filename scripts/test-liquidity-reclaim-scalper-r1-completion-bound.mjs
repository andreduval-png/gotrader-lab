#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { assertR1TrialProgress, createR1CompletionBudget, readR1TrialProgress,
  R1_CERTIFIED_SCAN_SEGMENT_COUNT } from "./support/liquidity-reclaim-scalper-r1-executor.mjs";

const root = path.join(process.cwd(), ".gotrader/liquidity-reclaim-scalper-v1/r1-completion-bound-test");
fs.rmSync(root, { recursive: true, force: true });
fs.mkdirSync(path.join(root, "checkpoints"), { recursive: true });

let progress = readR1TrialProgress(root);
assert.equal(progress.stage, "scan");
assert.equal(createR1CompletionBudget(progress).maximumChildren, 75);
fs.writeFileSync(path.join(root, "checkpoints/scan.json"), JSON.stringify({ nextSegment: 720, candidateCount: 100,
  seenFactIds: Array.from({ length: 100 }, (_, ordinal) => ordinal), eligibleCandidates: [] }));
const nearScanEnd = readR1TrialProgress(root);
assert.equal(createR1CompletionBudget(nearScanEnd).maximumChildren, 3);
assertR1TrialProgress(progress, nearScanEnd);

fs.writeFileSync(path.join(root, "checkpoints/scan.json"), JSON.stringify({ nextSegment: R1_CERTIFIED_SCAN_SEGMENT_COUNT,
  candidateCount: 7_052, seenFactIds: Array.from({ length: 7_052 }, (_, ordinal) => ordinal),
  eligibleCandidates: Array.from({ length: 950 }, (_, ordinal) => ({ ordinal })) }));
fs.mkdirSync(path.join(root, "bt2/checkpoints"), { recursive: true });
fs.writeFileSync(path.join(root, "bt2/checkpoints/test.json"), JSON.stringify({ nextOpportunityOrdinal: 635 }));
const simulation = readR1TrialProgress(root);
assert.equal(simulation.stage, "simulation");
assert.equal(simulation.remainingChildren, 64);
assert.equal(createR1CompletionBudget(simulation).maximumChildren, 66);
assertR1TrialProgress(nearScanEnd, simulation);

fs.writeFileSync(path.join(root, "bt2/checkpoints/test.json"), JSON.stringify({ nextOpportunityOrdinal: 640 }));
const advanced = readR1TrialProgress(root);
assertR1TrialProgress(simulation, advanced);
assert.throws(() => assertR1TrialProgress(advanced, advanced), /no monotonic checkpoint progress/);
fs.writeFileSync(path.join(root, "bt2/checkpoints/test.json"), JSON.stringify({ nextOpportunityOrdinal: 634 }));
assert.throws(() => assertR1TrialProgress(advanced, readR1TrialProgress(root)), /no monotonic checkpoint progress/);

const controllerSource = fs.readFileSync(path.join(process.cwd(), "scripts/run-liquidity-reclaim-scalper-r1-bounded.mjs"), "utf8");
assert.doesNotMatch(controllerSource, /childOrdinal < 200/);
assert.match(controllerSource, /progress-derived/);
assert.match(controllerSource, /assertR1TrialProgress/);

console.log(JSON.stringify({ status: "passed", fixedArbitraryLimitRemoved: true, scanBoundChildren: 75,
  observedTrialRemainingChildren: 64, stalledProgressFailsClosed: true, authority: "none/none/none" }, null, 2));
