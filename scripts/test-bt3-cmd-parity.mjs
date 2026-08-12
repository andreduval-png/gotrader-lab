#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const fixtureRoot = path.join(root, "tests/fixtures/bt3-cmd");
const outRoot = path.join(root, ".gotrader/bt3-cmd/parity-compiled");
const snapshotPath = path.join(fixtureRoot, "cmd.snapshot.json");
const text = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

compileTypescriptModules({ files: [path.join(root, "src/lib/backtestStrategyAdapters/cmdCanonicalAdapter.ts")], outRoot });
const adapter = await import(pathToFileURL(path.join(outRoot, "cmdCanonicalAdapter.mjs")).href);
const snapshotText = text(snapshotPath);
const snapshot = JSON.parse(snapshotText);
const manifest = JSON.parse(text(path.join(fixtureRoot, "snapshot-hashes.json")));
const snapshotHash = sha256(snapshotText);
assert.equal(snapshotHash, manifest.hashes["cmd.snapshot.json"]);

const results = [];
for (const fixture of snapshot.payload) {
  const result = await adapter.adaptCmdFixture({ fixture, snapshotHash });
  assert.deepEqual(result, await adapter.adaptCmdFixture({ fixture, snapshotHash }));
  assert.deepEqual(await adapter.compareCmdParity(fixture, result), []);
  assert.equal(result.promotionAllowed, false);
  assert.equal(result.historicalDatasetQualified, false);
  assert.equal(result.rawCandlesSerialized, false);
  if (fixture.geometry) {
    assert.equal(result.opportunity.direction, "short");
    assert.equal(result.opportunity.entryPrice, 100);
    assert.equal(result.opportunity.stopPrice, 102);
    assert.deepEqual(result.opportunity.targetPrices, [94]);
  } else assert.equal(result.opportunity, undefined);
  results.push(result);
}
const v1 = results.find((item) => item.fixtureId === "cmd_v1_policy_only");
assert.equal(v1.opportunity, undefined);
assert.ok(v1.blockers.includes("canonical_cmd_v1_detector_ownership_missing"));
assert.equal(results.find((item) => item.fixtureId === "cmd_v2_valid").classification, "experimental");
await assert.rejects(adapter.adaptCmdFixture({ fixture: snapshot.payload[0], snapshotHash: "bad" }), /snapshot hash is invalid/);
const borrowed = structuredClone(snapshot.payload[0]);
borrowed.geometry = { side: "short", entry: 100, stop: 102, target: 94, rr: 3 };
borrowed.blockers = [];
borrowed.detectionState = "trade_plan_constructed";
await assert.rejects(adapter.adaptCmdFixture({ fixture: borrowed, snapshotHash }), /geometry and detector ownership are inconsistent/);

const report = {
  schemaVersion: "gotrader-bt3-cmd-parity-report-v1",
  status: "passed",
  snapshotHash: `sha256:${snapshotHash}`,
  fixtureCount: results.length,
  opportunityCount: results.filter((item) => item.opportunity).length,
  noOpportunityCount: results.filter((item) => !item.opportunity).length,
  parityIds: Object.fromEntries(results.map((item) => [item.fixtureId, item.parityId])),
  opportunityIds: Object.fromEntries(results.filter((item) => item.opportunity).map((item) => [item.fixtureId, item.opportunity.opportunityId])),
  v1DetectorOwnership: "missing",
  promotionAllowed: false,
  exactParity: true,
  historicalDatasetQualified: false,
  rawCandlesSerialized: false,
  mt5Contacted: false,
  authority: results[0].authority
};
const reportPath = path.join(root, ".gotrader/bt3-cmd/report.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
