#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { buildSyntheticCases, loadStage2Modules, readBoundedM1Candles, verifyQualifiedInput } from "./support/bt2-stage2-shadow-runner.mjs";

const root = path.resolve(".gotrader/bt2-stage2-acceptance");
fs.rmSync(root, { recursive: true, force: true });
const sourceRoot = path.resolve("../gotrader-backtest-bt1-6");
const codeCommit = process.env.BT2_CODE_COMMIT || spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
const run = (lane, extra = []) => spawnSync(process.execPath, [
  "scripts/run-bt2-stage2-shadow.mjs", "--source-root", sourceRoot,
  "--output-root", path.join(root, lane), "--maximum-partitions", "3",
  "--maximum-opportunities", "12", "--code-commit", codeCommit, ...extra
], { cwd: process.cwd(), encoding: "utf8" });

const uninterrupted = run("uninterrupted");
assert.equal(uninterrupted.status, 0, uninterrupted.stderr || uninterrupted.stdout);
const interrupted = run("resumed", ["--interrupt-after-records", "5"]);
assert.equal(interrupted.status, 75, interrupted.stderr || interrupted.stdout);
const resumed = run("resumed");
assert.equal(resumed.status, 0, resumed.stderr || resumed.stdout);
const a = JSON.parse(fs.readFileSync(path.join(root, "uninterrupted/stage2-report.json"), "utf8"));
const b = JSON.parse(fs.readFileSync(path.join(root, "resumed/stage2-report.json"), "utf8"));
assert.equal(a.ledgerSealId, b.ledgerSealId);
assert.equal(a.experimentId, b.experimentId);
assert.equal(a.opportunityCount, 12);
assert.equal(a.outcomeCounts.blocked, 0);
assert.equal(a.rawCandlesSerialized, false);
assert.equal(a.mt5Contacted, false);
assert.ok(a.rssIncreaseBytes < 536_870_912);

const compiled = path.join(root, "append-invariance-compiled");
const modules = await loadStage2Modules(compiled);
const repositoryRoot = path.join(sourceRoot, ".gotrader/bt1-5/datasets/sha256_4a0bb904e6e90c99249f876679ba4b41bc95cbad1cff229f1a68c36c00283d76/full/repository");
const qualified = await verifyQualifiedInput({ modules, certificatePath: path.join(sourceRoot, ".gotrader/bt1-6/certificates/bt1-6-v3-certificate.json"), registryPath: path.join(sourceRoot, ".gotrader/bt1-6/registry/bt1-6-v3-registry.json"), repositoryRoot });
assert.equal(qualified.blockers.length, 0);
const invalidCertificatePath = path.join(root, "invalid-certificate.json");
fs.writeFileSync(invalidCertificatePath, JSON.stringify({ ...qualified.certificate, strategyNeutral: false }));
const rejected = await verifyQualifiedInput({ modules, certificatePath: invalidCertificatePath, registryPath: path.join(sourceRoot, ".gotrader/bt1-6/registry/bt1-6-v3-registry.json"), repositoryRoot: path.join(root, "must-not-be-read") });
assert.ok(rejected.blockers.includes("bt2_certificate_hash_invalid"));
assert.ok(rejected.blockers.includes("bt2_certificate_scope_invalid"));
const sample = readBoundedM1Candles({ repositoryRoot, manifest: qualified.manifest, maximumPartitions: 3 });
const original = await buildSyntheticCases({ modules, qualified, sample, maximumOpportunities: 12 });
const appended = await buildSyntheticCases({ modules, qualified, sample: { ...sample, candles: Object.freeze([...sample.candles, { ...sample.candles.at(-1), openTimeUtc: "2099-01-01T00:00:00.000Z", closeTimeUtc: "2099-01-01T00:01:00.000Z" }]) }, maximumOpportunities: 12 });
assert.deepEqual(appended.map((item) => item.opportunity.opportunityId), original.map((item) => item.opportunity.opportunityId));

const containsRawCandle = (value) => value && typeof value === "object" && (Array.isArray(value)
  ? value.some(containsRawCandle)
  : ["open", "high", "low", "close"].every((key) => Object.hasOwn(value, key)) || Object.values(value).some(containsRawCandle));
for (const lane of ["uninterrupted", "resumed"]) {
  const files = fs.readdirSync(path.join(root, lane), { recursive: true }).filter((name) => name.endsWith(".json") && !name.startsWith("compiled"));
  for (const name of files) assert.equal(containsRawCandle(JSON.parse(fs.readFileSync(path.join(root, lane, name), "utf8"))), false, `raw candle serialized in ${name}`);
}

console.log(JSON.stringify({ status: "passed", codeCommit, experimentId: a.experimentId, ledgerSealId: a.ledgerSealId, uninterruptedReportId: a.reportId, resumedReportId: b.reportId, opportunityCount: a.opportunityCount, outcomeCounts: a.outcomeCounts, peakRssBytes: Math.max(a.peakRssBytes, b.peakRssBytes), deterministicResume: true, futureAppendInvariant: true, unqualifiedInputRejected: true, maximumWorkers: a.maximumWorkers, mt5Contacted: false, rawCandlesSerialized: false, authority: a.authority }, null, 2));
