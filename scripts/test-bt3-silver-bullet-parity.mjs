#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const fixtureRoot = path.join(root, "tests/fixtures/bt3-silver-bullet");
const outRoot = path.join(root, ".gotrader/bt3-silver-bullet/parity-compiled");
const snapshotPath = path.join(fixtureRoot, "silver-bullet.snapshot.json");
const text = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

compileTypescriptModules({ files: [path.join(root, "src/lib/backtestStrategyAdapters/silverBulletCanonicalAdapter.ts")], outRoot });
const adapter = await import(pathToFileURL(path.join(outRoot, "silverBulletCanonicalAdapter.mjs")).href);
const snapshotText = text(snapshotPath);
const snapshot = JSON.parse(snapshotText);
const manifest = JSON.parse(text(path.join(fixtureRoot, "snapshot-hashes.json")));
const snapshotHash = sha256(snapshotText);
assert.equal(snapshotHash, manifest.hashes["silver-bullet.snapshot.json"]);

const results = [];
for (const fixture of snapshot.payload) {
  const result = await adapter.adaptSilverBulletFixture({ fixture, snapshotHash });
  assert.deepEqual(result, await adapter.adaptSilverBulletFixture({ fixture, snapshotHash }));
  assert.deepEqual(await adapter.compareSilverBulletParity(fixture, result), []);
  assert.equal(result.promotionAllowed, false);
  assert.equal(result.historicalDatasetQualified, false);
  assert.equal(result.rawCandlesSerialized, false);
  assert.equal(result.authority.executionAuthority, "none");
  if (fixture.geometry) {
    assert.equal(result.opportunity.direction, fixture.geometry.side);
    assert.equal(result.opportunity.entryPrice, fixture.geometry.entry);
    assert.equal(result.opportunity.stopPrice, fixture.geometry.stop);
    assert.deepEqual(result.opportunity.targetPrices, [fixture.geometry.target]);
    assert.equal(result.opportunity.sourceCandleClosedAtUtc, fixture.identity.generatedAt);
    assert.equal(result.opportunity.expiresAtUtc, fixture.identity.sessionClosesAtUtc);
  } else assert.equal(result.opportunity, undefined);
  results.push(result);
}
assert.equal(results.filter((item) => item.opportunity).length, 4);
assert.equal(results.filter((item) => item.classification === "negative_control").length, 3);
assert.equal(results.filter((item) => item.classification === "strict_research").length, 3);
assert.ok(results.find((item) => item.fixtureId === "silver_bullet_v1_no_sweep_blocked").blockers[0].includes("liquidity sweep"));
assert.equal(results.find((item) => item.fixtureId === "silver_bullet_v2_weak_sweep_blocked").detectionState, "blocked_low_quality_sweep");
await assert.rejects(adapter.adaptSilverBulletFixture({ fixture: snapshot.payload[0], snapshotHash: "bad" }), /snapshot hash is invalid/);
const promoted = structuredClone(snapshot.payload[0]);
promoted.promotionAllowed = true;
await assert.rejects(adapter.adaptSilverBulletFixture({ fixture: promoted, snapshotHash }), /authority is invalid/);
const borrowed = structuredClone(snapshot.payload[2]);
borrowed.geometry = structuredClone(snapshot.payload[0].geometry);
await assert.rejects(adapter.adaptSilverBulletFixture({ fixture: borrowed, snapshotHash }), /geometry and detector eligibility are inconsistent/);

const report = {
  schemaVersion: "gotrader-bt3-silver-bullet-parity-report-v1",
  status: "passed",
  snapshotHash: `sha256:${snapshotHash}`,
  fixtureCount: results.length,
  opportunityCount: results.filter((item) => item.opportunity).length,
  noOpportunityCount: results.filter((item) => !item.opportunity).length,
  parityIds: Object.fromEntries(results.map((item) => [item.fixtureId, item.parityId])),
  opportunityIds: Object.fromEntries(results.filter((item) => item.opportunity).map((item) => [item.fixtureId, item.opportunity.opportunityId])),
  v1Classification: "negative_control",
  v2Classification: "strict_research",
  promotionAllowed: false,
  exactParity: true,
  historicalDatasetQualified: false,
  rawCandlesSerialized: false,
  mt5Contacted: false,
  authority: results[0].authority
};
const reportPath = path.join(root, ".gotrader/bt3-silver-bullet/report.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
