#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd(); const outRoot = path.join(root, ".gotrader/bt3-evidence-artifacts/generator");
const fixtureRoot = path.join(root, "tests/fixtures/bt3-forward-evidence-artifacts");
const writeMode = process.argv.includes("--write");
const stable = (value) => { const sort = (item) => Array.isArray(item) ? item.map(sort) : item && typeof item === "object"
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])])) : item; return `${JSON.stringify(sort(value), null, 2)}\n`; };
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

export async function buildForwardEvidenceArtifactScenario() {
  compileTypescriptModules({ files: [
    path.join(root, "src/lib/forwardEvidence/buildForwardEvidenceEntry.ts"),
    path.join(root, "src/lib/forwardEvidence/forwardEvidenceArtifactContract.ts") ], outRoot });
  const builder = await import(`${pathToFileURL(path.join(outRoot, "buildForwardEvidenceEntry.mjs")).href}?v=${Date.now()}`);
  const contract = await import(`${pathToFileURL(path.join(outRoot, "forwardEvidenceArtifactContract.mjs")).href}?v=${Date.now()}`);
  const entries = [
    builder.buildForwardEvidenceEntry({ entryId: "forward_artifact_001", timestamp: "2026-07-21T14:01:00.000Z",
      sourceFingerprint: "mt5-forward-artifact-001", evidenceOrigin: "live_closed_candle", causalAtIssue: true,
      setupTimestamp: "2026-07-21T14:00:00.000Z", independentDate: "2026-07-21", forwardWindowId: "window-a",
      direction: "long", entryZone: { lower: 100, upper: 102 }, stopReference: 99,
      targetReferences: [{ label: "external liquidity", price: 106 }], triggerEvidence: ["fresh clean retest"], outcome: "pending" }),
    builder.buildForwardEvidenceEntry({ entryId: "forward_artifact_002", timestamp: "2026-07-22T15:01:00.000Z",
      sourceFingerprint: "mt5-forward-artifact-002", evidenceOrigin: "legacy_unverified", causalAtIssue: false,
      setupTimestamp: "2026-07-22T15:00:00.000Z", independentDate: "2026-07-22", forwardWindowId: "window-b",
      direction: "short", entryZone: { lower: 200, upper: 202 }, stopReference: 204,
      targetReferences: [{ label: "sell-side liquidity", price: 194 }], outcome: "target_first", realizedR: 2 })
  ];
  const migration = await contract.migrateForwardEvidenceLedgerToArtifacts(entries);
  return { builder, contract, entries, migration };
}

const firstScenario = await buildForwardEvidenceArtifactScenario();
const first = stable({ schemaVersion: "gotrader-bt3-forward-evidence-artifact-snapshot-v1", payload: firstScenario.migration });
const secondScenario = await buildForwardEvidenceArtifactScenario();
const second = stable({ schemaVersion: "gotrader-bt3-forward-evidence-artifact-snapshot-v1", payload: secondScenario.migration });
assert.equal(second, first); fs.mkdirSync(fixtureRoot, { recursive: true });
const snapshotPath = path.join(fixtureRoot, "forward-evidence-artifacts.snapshot.json");
const hashPath = path.join(fixtureRoot, "snapshot-hashes.json");
const manifest = stable({ schemaVersion: "gotrader-bt3-forward-evidence-artifact-hashes-v1",
  hashes: { "forward-evidence-artifacts.snapshot.json": sha256(first) } });
if (writeMode) { fs.writeFileSync(snapshotPath, first, "utf8"); fs.writeFileSync(hashPath, manifest, "utf8"); }
else { assert.equal(fs.readFileSync(snapshotPath, "utf8").replace(/\r\n/g, "\n"), first);
  assert.equal(fs.readFileSync(hashPath, "utf8").replace(/\r\n/g, "\n"), manifest); }
console.log(JSON.stringify({ status: writeMode ? "written" : "passed", byteStable: true, entryCount: 2,
  snapshotHash: `sha256:${sha256(first)}`, manifestId: firstScenario.migration.manifest.manifestId,
  artifactIds: firstScenario.migration.artifacts.map((artifact) => artifact.artifactId), mt5Contacted: false }, null, 2));
