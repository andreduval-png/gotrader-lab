#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const fixtureRoot = path.join(root, "tests/fixtures/bt3-ifvg-v1-v4");
const outRoot = path.join(root, ".gotrader/bt3-ifvg-v1-v4/parity-compiled");
const snapshotPath = path.join(fixtureRoot, "ifvg-v1-v4.snapshot.json");
const hashPath = path.join(fixtureRoot, "snapshot-hashes.json");
const reportPath = path.join(root, ".gotrader/bt3-ifvg-v1-v4/report.json");
const canonicalText = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

compileTypescriptModules({ files: [path.join(root, "src/lib/backtestStrategyAdapters/ifvgV1V4CanonicalAdapter.ts")], outRoot });
const adapter = await import(pathToFileURL(path.join(outRoot, "ifvgV1V4CanonicalAdapter.mjs")).href);
const snapshotText = canonicalText(snapshotPath);
const snapshot = JSON.parse(snapshotText);
const manifest = JSON.parse(canonicalText(hashPath));
const actualHash = sha256(snapshotText);
assert.equal(actualHash, manifest.hashes["ifvg-v1-v4.snapshot.json"]);

const results = [];
for (const fixture of snapshot.payload) {
  const result = await adapter.adaptIfvgV1V4Fixture({ fixture, snapshotHash: actualHash });
  const repeat = await adapter.adaptIfvgV1V4Fixture({ fixture, snapshotHash: actualHash });
  assert.deepEqual(result, repeat);
  assert.deepEqual(await adapter.compareIfvgV1V4Parity(fixture, result), []);
  assert.equal(result.promotionAllowed, false);
  assert.equal(result.historicalDatasetQualified, false);
  assert.equal(result.rawCandlesSerialized, false);
  if (fixture.geometry) {
    assert.ok(result.opportunity);
    assert.equal(result.opportunity.geometryMode, "native_strategy_geometry");
    assert.equal(result.opportunity.entryPrice, fixture.geometry.entry);
    assert.equal(result.opportunity.stopPrice, fixture.geometry.stop);
    assert.deepEqual(result.opportunity.targetPrices, [fixture.geometry.target]);
    assert.ok(Date.parse(result.opportunity.activatesAtUtc) >= Date.parse(result.opportunity.sourceCandleClosedAtUtc));
  } else {
    assert.equal(result.opportunity, undefined);
    assert.deepEqual(result.blockers, fixture.blockers);
  }
  results.push(result);
}

assert.equal(results.length, 4);
assert.equal(results.filter((item) => item.opportunity).length, 2);
assert.equal(results.find((item) => item.fixtureId === "ifvg_v4_shallow_valid").classification, "experimental");
assert.equal(results.find((item) => item.fixtureId === "ifvg_v4_deep_blocked").blockers[0], "shallow_retest_depth_required");
await assert.rejects(adapter.adaptIfvgV1V4Fixture({ fixture: snapshot.payload[0], snapshotHash: "bad" }), /snapshot hash is invalid/);
const drifted = structuredClone(snapshot.payload[2]);
drifted.identity.classification = "behavioral_fixture";
await assert.rejects(adapter.adaptIfvgV1V4Fixture({ fixture: drifted, snapshotHash: actualHash }), /profile identity is inconsistent/);

const report = {
  schemaVersion: "gotrader-bt3-ifvg-v1-v4-parity-report-v1",
  status: "passed",
  snapshotHash: `sha256:${actualHash}`,
  fixtureCount: results.length,
  opportunityCount: results.filter((item) => item.opportunity).length,
  noOpportunityCount: results.filter((item) => !item.opportunity).length,
  parityIds: Object.fromEntries(results.map((item) => [item.fixtureId, item.parityId])),
  opportunityIds: Object.fromEntries(results.filter((item) => item.opportunity).map((item) => [item.fixtureId, item.opportunity.opportunityId])),
  promotionAllowed: false,
  exactParity: true,
  historicalDatasetQualified: false,
  rawCandlesSerialized: false,
  mt5Contacted: false,
  authority: results[0].authority
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
