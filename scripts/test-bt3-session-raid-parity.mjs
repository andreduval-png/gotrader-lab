#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd(); const fixtureRoot = path.join(root, "tests/fixtures/bt3-session-raid");
const outRoot = path.join(root, ".gotrader/bt3-session-raid/parity-compiled");
const snapshotPath = path.join(fixtureRoot, "session-raid.snapshot.json");
const text = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
compileTypescriptModules({ files: [path.join(root, "src/lib/backtestStrategyAdapters/sessionRaidCanonicalAdapter.ts")], outRoot });
const adapter = await import(pathToFileURL(path.join(outRoot, "sessionRaidCanonicalAdapter.mjs")).href);
const snapshotText = text(snapshotPath); const snapshot = JSON.parse(snapshotText);
const manifest = JSON.parse(text(path.join(fixtureRoot, "snapshot-hashes.json"))); const snapshotHash = sha256(snapshotText);
assert.equal(snapshotHash, manifest.hashes["session-raid.snapshot.json"]);
const results = [];
for (const fixture of snapshot.payload) { const result = await adapter.adaptSessionRaidFixture({ fixture, snapshotHash });
  assert.deepEqual(result, await adapter.adaptSessionRaidFixture({ fixture, snapshotHash }));
  assert.deepEqual(await adapter.compareSessionRaidParity(fixture, result), []); assert.equal(result.promotionAllowed, false);
  assert.equal(result.historicalDatasetQualified, false); assert.equal(result.rawCandlesSerialized, false);
  if (fixture.geometry) { assert.equal(result.opportunity.direction, "short"); assert.equal(result.opportunity.entryPrice, fixture.geometry.entry);
    assert.equal(result.opportunity.stopPrice, fixture.geometry.stop); assert.deepEqual(result.opportunity.targetPrices, [fixture.geometry.target]); }
  else assert.equal(result.opportunity, undefined); results.push(result); }
assert.equal(results.filter((item) => item.opportunity).length, 1);
assert.equal(results.find((item) => item.fixtureId === "session_raid_v1_no_raid_blocked").detectionState, "forming");
assert.ok(snapshot.payload.find((item) => item.identity.profileVersion === "v2").failedFilters.length > 0);
await assert.rejects(adapter.adaptSessionRaidFixture({ fixture: snapshot.payload[0], snapshotHash: "bad" }), /snapshot hash is invalid/);
const rewrittenAudit = structuredClone(snapshot.payload[0]); rewrittenAudit.audit.candidateCount = 13;
await assert.rejects(adapter.adaptSessionRaidFixture({ fixture: rewrittenAudit, snapshotHash }), /v1 audited boundary is invalid/);
const borrowed = structuredClone(snapshot.payload[3]); borrowed.geometry = structuredClone(snapshot.payload[0].geometry);
await assert.rejects(adapter.adaptSessionRaidFixture({ fixture: borrowed, snapshotHash }), /v2 does not own canonical geometry/);
const report = { schemaVersion: "gotrader-bt3-session-raid-parity-report-v1", status: "passed",
  snapshotHash: `sha256:${snapshotHash}`, fixtureCount: results.length, opportunityCount: results.filter((item) => item.opportunity).length,
  noOpportunityCount: results.filter((item) => !item.opportunity).length,
  parityIds: Object.fromEntries(results.map((item) => [item.fixtureId, item.parityId])),
  opportunityIds: Object.fromEntries(results.filter((item) => item.opportunity).map((item) => [item.fixtureId, item.opportunity.opportunityId])),
  v1Audit: snapshot.payload[0].audit, v2Audit: snapshot.payload[3].audit, v2GeometryOwned: false, promotionAllowed: false,
  exactParity: true, historicalDatasetQualified: false, rawCandlesSerialized: false, mt5Contacted: false, authority: results[0].authority };
const reportPath = path.join(root, ".gotrader/bt3-session-raid/report.json"); fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"); console.log(JSON.stringify(report, null, 2));
