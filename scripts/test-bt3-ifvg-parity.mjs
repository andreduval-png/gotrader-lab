#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const fixtureRoot = path.join(root, "tests/fixtures/v2-baseline");
const outRoot = path.join(root, ".gotrader/bt3-ifvg-parity/compiled");
const reportPath = path.join(root, ".gotrader/bt3-ifvg-parity/report.json");
const hashFile = (file) => crypto.createHash("sha256")
  .update(fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n"))
  .digest("hex");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

compileTypescriptModules({
  files: [path.join(root, "src/lib/backtestStrategyAdapters/index.ts")],
  outRoot
});
const adapter = await import(pathToFileURL(path.join(outRoot, "index.mjs")).href);
const manifest = readJson(path.join(fixtureRoot, "baseline-snapshot-hashes.json"));
const sources = [
  "ifvg-v2-negative-control.snapshot.json",
  "ifvg-v3-positive-canary.snapshot.json"
];

const results = [];
for (const source of sources) {
  const sourcePath = path.join(fixtureRoot, source);
  const actualHash = hashFile(sourcePath);
  assert.equal(actualHash, manifest.hashes[source], `${source} hash drifted`);
  const snapshot = readJson(sourcePath);
  for (const fixture of snapshot.payload) {
    const result = await adapter.adaptFrozenIfvgFixture({ fixture, baselineSnapshotHash: actualHash });
    const repeat = await adapter.adaptFrozenIfvgFixture({ fixture, baselineSnapshotHash: actualHash });
    assert.deepEqual(repeat, result, `${fixture.identity.fixtureId} was not deterministic`);
    assert.deepEqual(await adapter.compareFrozenIfvgParity({ fixture, result }), []);
    assert.equal(result.baselineSnapshotHash, `sha256:${actualHash}`);
    assert.equal(result.fixtureOnly, true);
    assert.equal(result.historicalDatasetQualified, false);
    assert.equal(result.promotionAllowed, false);
    assert.equal(result.rawCandlesSerialized, false);
    assert.deepEqual(result.authority, {
      executionAuthority: "none",
      brokerAuthority: "none",
      readinessOverrideAuthority: "none"
    });
    if (fixture.expectedTradeGeometry) {
      const geometry = fixture.expectedTradeGeometry;
      assert.ok(result.opportunity);
      assert.equal(result.opportunity.geometryMode, "native_strategy_geometry");
      assert.equal(result.opportunity.direction, geometry.side);
      assert.equal(result.opportunity.entryPrice, geometry.entry);
      assert.equal(result.opportunity.stopPrice, geometry.stop);
      assert.deepEqual(result.opportunity.targetPrices, [geometry.target]);
      assert.equal(result.opportunity.decisionAtUtc, "2026-06-12T15:00:00.000Z");
      assert.equal(result.opportunity.activatesAtUtc, result.opportunity.decisionAtUtc);
      assert.deepEqual(result.opportunity.authority, result.authority);
    } else {
      assert.equal(result.opportunity, undefined);
      assert.deepEqual(result.blockers, fixture.expectedBlockers);
    }
    results.push(result);
  }
}

assert.equal(results.length, 4);
assert.equal(results.find((item) => item.fixtureId === "ifvg_v2_negative_control").classification, "negative_control");
assert.equal(results.find((item) => item.fixtureId === "ifvg_v3_valid").classification, "positive_canary");
assert.equal(results.find((item) => item.fixtureId === "ifvg_v3_forming").opportunity, undefined);
assert.equal(results.find((item) => item.fixtureId === "ifvg_v3_rejected").opportunity, undefined);

await assert.rejects(
  adapter.adaptFrozenIfvgFixture({ fixture: readJson(path.join(fixtureRoot, sources[0])).payload[0], baselineSnapshotHash: "bad" }),
  /snapshot hash is invalid/
);
const unsupported = structuredClone(readJson(path.join(fixtureRoot, sources[1])).payload[0]);
unsupported.identity.strategyId = "ifvg_modified_profile";
await assert.rejects(
  adapter.adaptFrozenIfvgFixture({ fixture: unsupported, baselineSnapshotHash: manifest.hashes[sources[1]] }),
  /profile identity is unsupported/
);
const inconsistent = structuredClone(readJson(path.join(fixtureRoot, sources[1])).payload[1]);
inconsistent.expectedTradeGeometry = { entry: 95, rr: 3.3012, side: "long", stop: 93.9095, target: 98.6 };
await assert.rejects(
  adapter.adaptFrozenIfvgFixture({ fixture: inconsistent, baselineSnapshotHash: manifest.hashes[sources[1]] }),
  /geometry and blocker state are inconsistent/
);

const compact = {
  schemaVersion: "gotrader-bt3-ifvg-parity-report-v1",
  status: "passed",
  fixtureCount: results.length,
  opportunityCount: results.filter((item) => item.opportunity).length,
  noOpportunityCount: results.filter((item) => !item.opportunity).length,
  snapshotHashes: Object.fromEntries(sources.map((source) => [source, `sha256:${manifest.hashes[source]}`])),
  fixtureParityIds: Object.fromEntries(results.map((item) => [item.fixtureId, item.parityId])),
  opportunityIds: Object.fromEntries(results.filter((item) => item.opportunity).map((item) => [item.fixtureId, item.opportunity.opportunityId])),
  negativeControlPromotionAllowed: false,
  exactParity: true,
  historicalDatasetQualified: false,
  rawCandlesSerialized: false,
  mt5Contacted: false,
  authority: results[0].authority
};
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(compact, null, 2)}\n`, "utf8");
console.log(JSON.stringify(compact, null, 2));
