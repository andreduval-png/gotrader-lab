#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-shadow-resolver/generator");
const fixtureRoot = path.join(root, "tests/fixtures/bt3-shadow-resolver");
const writeMode = process.argv.includes("--write");
const stable = (value) => { const sort = (item) => Array.isArray(item) ? item.map(sort) : item && typeof item === "object"
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])])) : item; return `${JSON.stringify(sort(value), null, 2)}\n`; };
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const hash = (seed) => `sha256:${sha256(seed)}`;

export async function buildResolverScenario() {
  compileTypescriptModules({ files: [
    path.join(root, "src/lib/backtestSimulation/simulationContracts.ts"),
    path.join(root, "src/lib/backtestOpportunityResolver/shadowOpportunityResolver.ts") ], outRoot });
  const contracts = await import(`${pathToFileURL(path.join(outRoot, "simulationContracts.mjs")).href}?v=${Date.now()}`);
  const resolver = await import(`${pathToFileURL(path.join(outRoot, "shadowOpportunityResolver.mjs")).href}?v=${Date.now()}`);
  const opportunity = (strategyId, direction, ordinal, overrides = {}) => contracts.buildCanonicalOpportunity({
    adapterVersion: "bt3-shadow-resolver-fixture-v1", datasetCertificateId: hash(`certificate-${ordinal}`),
    datasetId: hash(`dataset-${ordinal}`), strategyId, profileVersion: "fixture-v1", parameterHash: hash(`parameter-${ordinal}`),
    requestedSymbol: overrides.requestedSymbol ?? "MNQ", brokerSymbol: overrides.brokerSymbol ?? "USTECH", timeframe: "5m",
    decisionAtUtc: "2026-06-12T14:00:00.000Z", sourceCandleClosedAtUtc: "2026-06-12T14:00:00.000Z",
    contextLineageRoot: hash(`context-${ordinal}`), direction, orderPolicy: "limit_at_price",
    activatesAtUtc: overrides.activatesAtUtc ?? "2026-06-12T14:00:00.000Z",
    expiresAtUtc: overrides.expiresAtUtc ?? "2026-06-12T16:00:00.000Z", signalPrice: 100,
    entryPrice: 100, stopPrice: direction === "long" ? 95 : 105, targetPrices: [direction === "long" ? 110 : 90],
    eligible: true, blockers: [] });
  const [ifvgLong, ifvgV1Long, turtleLong, sessionShort, expiredLong] = await Promise.all([
    opportunity("ifvg_fresh_retest_v3_research", "long", 1), opportunity("ifvg_baseline_v1", "long", 2),
    opportunity("turtle_soup_v1", "long", 3), opportunity("nasdaq_london_raid_ny_reversal_v1", "short", 4),
    opportunity("silver_bullet_v1", "long", 5, { expiresAtUtc: "2026-06-12T14:15:00.000Z" }) ]);
  const observedAtUtc = "2026-06-12T14:30:00.000Z";
  const cases = {
    single: [{ evidenceFamily: "imbalance", opportunity: ifvgLong }],
    same_family_overlap: [{ evidenceFamily: "imbalance", opportunity: ifvgLong }, { evidenceFamily: "imbalance", opportunity: ifvgV1Long }],
    cross_family_confluence: [{ evidenceFamily: "imbalance", opportunity: ifvgLong }, { evidenceFamily: "liquidity_reversal", opportunity: turtleLong }],
    cross_family_conflict: [{ evidenceFamily: "imbalance", opportunity: ifvgLong }, { evidenceFamily: "session_model", opportunity: sessionShort }],
    mixed: [{ evidenceFamily: "imbalance", opportunity: ifvgLong }, { evidenceFamily: "imbalance", opportunity: ifvgV1Long },
      { evidenceFamily: "session_model", opportunity: sessionShort }],
    no_active: [{ evidenceFamily: "liquidity_reversal", opportunity: expiredLong }]
  };
  const resolutions = {};
  for (const [name, candidates] of Object.entries(cases)) resolutions[name] = await resolver.resolveShadowOpportunities({ observedAtUtc, candidates });
  return { resolver, contracts, cases, observedAtUtc, resolutions };
}

const firstScenario = await buildResolverScenario(); const first = stable({
  schemaVersion: "gotrader-bt3-shadow-resolver-snapshot-v1", payload: firstScenario.resolutions });
const secondScenario = await buildResolverScenario(); const second = stable({
  schemaVersion: "gotrader-bt3-shadow-resolver-snapshot-v1", payload: secondScenario.resolutions });
assert.equal(second, first); fs.mkdirSync(fixtureRoot, { recursive: true });
const snapshotPath = path.join(fixtureRoot, "shadow-resolver.snapshot.json"); const hashPath = path.join(fixtureRoot, "snapshot-hashes.json");
const manifest = stable({ schemaVersion: "gotrader-bt3-shadow-resolver-hashes-v1",
  hashes: { "shadow-resolver.snapshot.json": sha256(first) } });
if (writeMode) { fs.writeFileSync(snapshotPath, first, "utf8"); fs.writeFileSync(hashPath, manifest, "utf8"); }
else { assert.equal(fs.readFileSync(snapshotPath, "utf8").replace(/\r\n/g,"\n"), first);
  assert.equal(fs.readFileSync(hashPath, "utf8").replace(/\r\n/g,"\n"), manifest); }
console.log(JSON.stringify({ status: writeMode ? "written" : "passed", byteStable: true, fixtureCount: 6,
  snapshotHash: `sha256:${sha256(first)}`, states: Object.fromEntries(Object.entries(firstScenario.resolutions).map(([key,value]) => [key,value.state])),
  currentLiveResolutionAuthoritative: true, shadowSelectionAllowed: false, mt5Contacted: false }, null, 2));
