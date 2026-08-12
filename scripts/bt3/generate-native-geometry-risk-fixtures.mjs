#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-native-geometry/generator");
const fixtureRoot = path.join(root, "tests/fixtures/bt3-native-geometry-risk");
const writeMode = process.argv.includes("--write");
const stable = (value) => { const sort = (item) => Array.isArray(item) ? item.map(sort) : item && typeof item === "object"
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])])) : item; return `${JSON.stringify(sort(value), null, 2)}\n`; };
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const hash = (seed) => `sha256:${sha256(seed)}`;

export async function buildNativeGeometryScenario() {
  compileTypescriptModules({ files: [
    path.join(root, "src/lib/backtestSimulation/simulationContracts.ts"),
    path.join(root, "src/lib/backtestGeometry/nativeGeometryAssessment.ts") ], outRoot });
  const contracts = await import(`${pathToFileURL(path.join(outRoot, "simulationContracts.mjs")).href}?v=${Date.now()}`);
  const geometry = await import(`${pathToFileURL(path.join(outRoot, "nativeGeometryAssessment.mjs")).href}?v=${Date.now()}`);
  const opportunity = (name, ordinal, values) => contracts.buildCanonicalOpportunity({
    adapterVersion: "bt3-native-geometry-fixture-v1", datasetCertificateId: hash(`certificate-${ordinal}`),
    datasetId: hash(`dataset-${ordinal}`), strategyId: values.strategyId, profileVersion: "fixture-v1",
    parameterHash: hash(`parameter-${ordinal}`), requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "5m",
    decisionAtUtc: "2026-06-12T14:00:00.000Z", sourceCandleClosedAtUtc: "2026-06-12T14:00:00.000Z",
    contextLineageRoot: hash(`context-${ordinal}`), direction: values.direction, orderPolicy: "limit_at_price",
    activatesAtUtc: "2026-06-12T14:00:00.000Z", expiresAtUtc: "2026-06-12T16:00:00.000Z",
    signalPrice: values.signalPrice, entryPrice: values.entryPrice, stopPrice: values.stopPrice,
    targetPrices: values.targetPrices, eligible: true, blockers: [] }).then((value) => [name, value]);
  const entries = await Promise.all([
    opportunity("long_multiple_targets", 1, { strategyId: "ifvg_fresh_retest_v3_research", direction: "long",
      signalPrice: 100, entryPrice: 100, stopPrice: 95, targetPrices: [110, 115] }),
    opportunity("short_single_target", 2, { strategyId: "nasdaq_london_raid_ny_reversal_v1", direction: "short",
      signalPrice: 100, entryPrice: 100, stopPrice: 104, targetPrices: [92] }),
    opportunity("displaced_non_monotonic_targets", 3, { strategyId: "turtle_soup_v1", direction: "long",
      signalPrice: 99, entryPrice: 100, stopPrice: 95, targetPrices: [107.5, 106] })
  ]);
  const opportunities = Object.fromEntries(entries);
  const assessments = Object.fromEntries(await Promise.all(entries.map(async ([name, value]) =>
    [name, await geometry.assessNativeGeometry(value)])));
  return { contracts, geometry, opportunities, assessments };
}

const firstScenario = await buildNativeGeometryScenario();
const first = stable({ schemaVersion: "gotrader-bt3-native-geometry-snapshot-v1", payload: firstScenario.assessments });
const secondScenario = await buildNativeGeometryScenario();
const second = stable({ schemaVersion: "gotrader-bt3-native-geometry-snapshot-v1", payload: secondScenario.assessments });
assert.equal(second, first); fs.mkdirSync(fixtureRoot, { recursive: true });
const snapshotPath = path.join(fixtureRoot, "native-geometry-risk.snapshot.json");
const hashPath = path.join(fixtureRoot, "snapshot-hashes.json");
const manifest = stable({ schemaVersion: "gotrader-bt3-native-geometry-hashes-v1",
  hashes: { "native-geometry-risk.snapshot.json": sha256(first) } });
if (writeMode) { fs.writeFileSync(snapshotPath, first, "utf8"); fs.writeFileSync(hashPath, manifest, "utf8"); }
else { assert.equal(fs.readFileSync(snapshotPath, "utf8").replace(/\r\n/g, "\n"), first);
  assert.equal(fs.readFileSync(hashPath, "utf8").replace(/\r\n/g, "\n"), manifest); }
console.log(JSON.stringify({ status: writeMode ? "written" : "passed", byteStable: true, fixtureCount: 3,
  snapshotHash: `sha256:${sha256(first)}`, assessmentIds: Object.fromEntries(Object.entries(firstScenario.assessments)
    .map(([key, value]) => [key, value.assessmentId])), mt5Contacted: false }, null, 2));
