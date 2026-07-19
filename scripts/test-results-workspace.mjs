#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const view = read("src/components/performance/PerformanceView.tsx");
const types = read("src/lib/results/resultsWorkspaceTypes.ts");
const builder = read("src/lib/results/buildResultsWorkspaceSnapshot.ts");

for (const marker of [
  "results-calendar",
  "results-tab-overview",
  "results-tab-replay",
  "results-tab-walk-forward",
  "results-tab-paper-forward",
  "results-tab-robustness"
]) {
  assert.match(view, new RegExp(marker), `Results view must render ${marker}.`);
}

assert.ok(
  view.indexOf("<ResultsCalendar") < view.indexOf("data-testid=\"results-tabs\""),
  "The full-width results calendar must appear before the workspace tabs."
);
assert.doesNotMatch(view, /allocateMetricsAcrossCalendar|seededNoise/);
assert.doesNotMatch(view, /priceMove\s*\*\s*1\.25/);
assert.match(view, /Aggregate backtest metrics are intentionally not spread across calendar days/);
assert.match(view, /Cumulative dated outcome move/);
assert.match(view, /Latest active validation and frozen profile evidence are reported separately/);
assert.match(view, /Frozen profile chronological evidence/);
assert.match(view, /Latest saved simulation and frozen profile evidence remain distinct/);
assert.match(view, /readableProfile\(resultsSnapshot\.frozenProfile\.profileId\)/);
assert.doesNotMatch(view, /Frozen IFVG v3/);
assert.match(builder, /getFrozenResearchProfile\(activeFrozenProfileId/);

for (const section of [
  "backtest:",
  "replay:",
  "walkForward:",
  "monteCarlo:",
  "paperDemo:",
  "frozenProfile:",
  "predictions:",
  "validation:"
]) {
  assert.match(types, new RegExp(section), `Results snapshot must include ${section}`);
}

assert.match(builder, /aggregateMetricsNotFabricatedIntoDailyResults:\s*true/);
assert.match(builder, /executionIntentCreated:\s*false/);
assert.match(types, /executionAuthority:\s*"none"/);
assert.match(types, /brokerAuthority:\s*"none"/);
assert.match(types, /readinessOverrideAuthority:\s*"none"/);

const serializedContracts = `${types}\n${builder}`;
assert.doesNotMatch(serializedContracts, /executionAuthority:\s*"(?:paper|live|enabled)"/i);
assert.doesNotMatch(serializedContracts, /brokerAuthority:\s*"(?:route_only|execute|live)"/i);

console.log(JSON.stringify({
  status: "passed",
  calendar: "dated_outcomes_only",
  aggregateDailyFabrication: false,
  resultSections: ["backtest", "replay", "walk_forward", "paper_forward", "robustness"],
  authority: {
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  }
}, null, 2));
