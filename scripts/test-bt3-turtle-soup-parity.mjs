#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
const root = process.cwd(); const fixtureRoot = path.join(root, "tests/fixtures/bt3-turtle-soup");
const outRoot = path.join(root, ".gotrader/bt3-turtle-soup/parity-compiled");
const snapshotPath = path.join(fixtureRoot, "turtle-soup.snapshot.json");
const text = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
compileTypescriptModules({ files: [path.join(root, "src/lib/backtestStrategyAdapters/turtleSoupCanonicalAdapter.ts")], outRoot });
const adapter = await import(pathToFileURL(path.join(outRoot, "turtleSoupCanonicalAdapter.mjs")).href);
const snapshotText = text(snapshotPath); const snapshot = JSON.parse(snapshotText);
const manifest = JSON.parse(text(path.join(fixtureRoot, "snapshot-hashes.json"))); const snapshotHash = sha256(snapshotText);
assert.equal(snapshotHash, manifest.hashes["turtle-soup.snapshot.json"]);
const results = [];
for (const fixture of snapshot.payload) {
  const result = await adapter.adaptTurtleSoupFixture({ fixture, snapshotHash });
  assert.deepEqual(result, await adapter.adaptTurtleSoupFixture({ fixture, snapshotHash }));
  assert.deepEqual(await adapter.compareTurtleSoupParity(fixture, result), []);
  assert.equal(result.promotionAllowed, false); assert.equal(result.historicalDatasetQualified, false);
  assert.equal(result.auditedHistoricalCandidateCount, 0); assert.equal(result.auditedRobustness, "needs_more_data");
  if (fixture.geometry) { assert.equal(result.opportunity.direction, fixture.geometry.side);
    assert.equal(result.opportunity.entryPrice, fixture.geometry.entry); assert.equal(result.opportunity.stopPrice, fixture.geometry.stop);
    assert.deepEqual(result.opportunity.targetPrices, [fixture.geometry.target]);
    assert.equal(result.opportunity.sourceCandleClosedAtUtc, fixture.identity.generatedAt); }
  else assert.equal(result.opportunity, undefined);
  results.push(result);
}
assert.equal(results.filter((item) => item.opportunity).length, 2);
assert.ok(results.find((item) => item.fixtureId === "turtle_soup_v1_no_sweep_blocked").blockers[0].includes("No fresh sweep"));
assert.equal(results.find((item) => item.fixtureId === "turtle_soup_v1_no_mss_blocked").detectionState, "blocked_no_mss");
await assert.rejects(adapter.adaptTurtleSoupFixture({ fixture: snapshot.payload[0], snapshotHash: "bad" }), /snapshot hash is invalid/);
const rewrittenAudit = structuredClone(snapshot.payload[0]); rewrittenAudit.auditedHistoricalCandidateCount = 1;
await assert.rejects(adapter.adaptTurtleSoupFixture({ fixture: rewrittenAudit, snapshotHash }), /audited diagnostic boundary is invalid/);
const borrowed = structuredClone(snapshot.payload[2]); borrowed.geometry = structuredClone(snapshot.payload[0].geometry);
await assert.rejects(adapter.adaptTurtleSoupFixture({ fixture: borrowed, snapshotHash }), /geometry and detector eligibility are inconsistent/);
const report = { schemaVersion: "gotrader-bt3-turtle-soup-parity-report-v1", status: "passed",
  snapshotHash: `sha256:${snapshotHash}`, fixtureCount: results.length,
  opportunityCount: results.filter((item) => item.opportunity).length, noOpportunityCount: results.filter((item) => !item.opportunity).length,
  parityIds: Object.fromEntries(results.map((item) => [item.fixtureId, item.parityId])),
  opportunityIds: Object.fromEntries(results.filter((item) => item.opportunity).map((item) => [item.fixtureId, item.opportunity.opportunityId])),
  classification: "diagnostic_control", auditedHistoricalCandidateCount: 0, auditedRobustness: "needs_more_data",
  promotionAllowed: false, exactParity: true, historicalDatasetQualified: false, rawCandlesSerialized: false,
  mt5Contacted: false, authority: results[0].authority };
const reportPath = path.join(root, ".gotrader/bt3-turtle-soup/report.json"); fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"); console.log(JSON.stringify(report, null, 2));
