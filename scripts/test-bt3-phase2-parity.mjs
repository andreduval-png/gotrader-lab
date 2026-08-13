#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd(), fixtureRoot = path.join(root, "tests/fixtures/bt3-phase2");
const outRoot = path.join(root, ".gotrader/bt3-phase2/parity-compiled");
const text = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
compileTypescriptModules({ files: [path.join(root, "src/lib/backtestStrategyAdapters/phase2CanonicalAdapter.ts")], outRoot });
const adapter = await import(pathToFileURL(path.join(outRoot, "phase2CanonicalAdapter.mjs")).href);
const snapshotText = text(path.join(fixtureRoot, "phase2.snapshot.json")), snapshot = JSON.parse(snapshotText);
const manifest = JSON.parse(text(path.join(fixtureRoot, "snapshot-hashes.json"))), snapshotHash = sha256(snapshotText);
assert.equal(snapshotHash, manifest.hashes["phase2.snapshot.json"]);
const results = [];
for (const fixture of snapshot.payload) {
  const result = await adapter.adaptPhase2Fixture({ fixture, snapshotHash });
  assert.deepEqual(result, await adapter.adaptPhase2Fixture({ fixture, snapshotHash }));
  assert.deepEqual(await adapter.comparePhase2Parity(fixture, result), []);
  assert.equal(result.opportunity, undefined);
  assert.equal(result.promotionAllowed, false);
  assert.equal(result.historicalDatasetQualified, false);
  results.push(result);
}
const positive = structuredClone(snapshot.payload[0]);
positive.decision = "research_only"; positive.side = "long"; positive.approvedProfileStatus = "approved_research_candidate";
positive.blockers = []; positive.geometry = { entry: 103, stop: 96, target: 119, rr: 2.29 };
const positiveResult = await adapter.adaptPhase2Fixture({ fixture: positive, snapshotHash });
assert.equal(positiveResult.opportunity.direction, "long"); assert.equal(positiveResult.opportunity.entryPrice, 103);
const inverted = structuredClone(positive); inverted.geometry = { entry: 103, stop: 110, target: 95, rr: 2 };
await assert.rejects(adapter.adaptPhase2Fixture({ fixture: inverted, snapshotHash }), /native geometry is invalid/);
const leaked = structuredClone(snapshot.payload[0]); leaked.geometry = { entry: 103, stop: 96, target: 119, rr: 2.29 };
await assert.rejects(adapter.adaptPhase2Fixture({ fixture: leaked, snapshotHash }), /geometry and detector eligibility are inconsistent/);
await assert.rejects(adapter.adaptPhase2Fixture({ fixture: snapshot.payload[0], snapshotHash: "bad" }), /snapshot hash is invalid/);
const report = { schemaVersion: "gotrader-bt3-phase2-parity-report-v1", status: "passed", snapshotHash: `sha256:${snapshotHash}`,
  fixtureCount: results.length, opportunityCount: 0, failClosedCount: results.length, positiveContractProbe: "passed",
  nativeDirectionOrderingProbe: "passed", parityIds: Object.fromEntries(results.map((item) => [item.fixtureId, item.parityId])),
  promotionAllowed: false, exactParity: true, historicalDatasetQualified: false, rawCandlesSerialized: false, mt5Contacted: false,
  authority: results[0].authority };
const reportPath = path.join(root, ".gotrader/bt3-phase2/report.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
