#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildResolverScenario } from "./bt3/generate-shadow-resolver-fixtures.mjs";

const root = process.cwd(); const fixtureRoot = path.join(root, "tests/fixtures/bt3-shadow-resolver");
const text = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g,"\n");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const snapshotText = text(path.join(fixtureRoot, "shadow-resolver.snapshot.json"));
const snapshot = JSON.parse(snapshotText); const manifest = JSON.parse(text(path.join(fixtureRoot, "snapshot-hashes.json")));
assert.equal(sha256(snapshotText), manifest.hashes["shadow-resolver.snapshot.json"]);
const { resolver, contracts, cases, observedAtUtc, resolutions } = await buildResolverScenario();
assert.deepEqual(resolutions, snapshot.payload);
assert.deepEqual(Object.fromEntries(Object.entries(resolutions).map(([key,value]) => [key,value.state])), {
  single: "single", same_family_overlap: "same_family_overlap", cross_family_confluence: "cross_family_confluence",
  cross_family_conflict: "cross_family_conflict", mixed: "mixed", no_active: "no_active" });
for (const resolution of Object.values(resolutions)) { assert.deepEqual(await resolver.validateShadowOpportunityResolution(resolution), []);
  assert.equal(resolution.currentLiveResolutionAuthoritative, true); assert.equal(resolution.shadowSelectionAllowed, false);
  assert.equal("selectedOpportunityId" in resolution, false); assert.equal("rankedOpportunityIds" in resolution, false); }
const reversed = await resolver.resolveShadowOpportunities({ observedAtUtc, candidates: [...cases.mixed].reverse() });
assert.deepEqual(reversed, resolutions.mixed);
await assert.rejects(resolver.resolveShadowOpportunities({ observedAtUtc, candidates: [cases.single[0], cases.single[0]] }), /identities must be unique/);
const tampered = structuredClone(cases.single[0]); tampered.opportunity.opportunityId = `sha256:${"0".repeat(64)}`;
await assert.rejects(resolver.resolveShadowOpportunities({ observedAtUtc, candidates: [tampered] }), /canonical opportunity is invalid/);
const { opportunityId: _opportunityId, schemaVersion: _schemaVersion, geometryMode: _geometryMode,
  authority: _authority, capabilities: _capabilities, ...otherSymbolCore } = cases.single[0].opportunity;
const otherSymbol = await contracts.buildCanonicalOpportunity({ ...otherSymbolCore, requestedSymbol: "NQ" });
await assert.rejects(resolver.resolveShadowOpportunities({ observedAtUtc, candidates: [cases.single[0],
  { evidenceFamily: "imbalance", opportunity: otherSymbol }] }), /share one symbol scope/);
const report = { schemaVersion: "gotrader-bt3-shadow-resolver-report-v1", status: "passed",
  snapshotHash: `sha256:${sha256(snapshotText)}`, fixtureCount: 6,
  resolutionIds: Object.fromEntries(Object.entries(resolutions).map(([key,value]) => [key,value.resolutionId])),
  states: Object.fromEntries(Object.entries(resolutions).map(([key,value]) => [key,value.state])),
  inputOrderInvariant: true, selectedOpportunityCount: 0, currentLiveResolutionAuthoritative: true,
  shadowSelectionAllowed: false, rawCandlesSerialized: false, mt5Contacted: false, authority: resolutions.single.authority };
const reportPath = path.join(root, ".gotrader/bt3-shadow-resolver/report.json"); fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report,null,2)}\n`, "utf8"); console.log(JSON.stringify(report,null,2));
