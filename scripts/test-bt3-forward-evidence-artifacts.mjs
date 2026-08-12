#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildForwardEvidenceArtifactScenario } from "./bt3/generate-forward-evidence-artifact-fixtures.mjs";

const root = process.cwd(); const fixtureRoot = path.join(root, "tests/fixtures/bt3-forward-evidence-artifacts");
const text = (file) => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const snapshotText = text(path.join(fixtureRoot, "forward-evidence-artifacts.snapshot.json"));
const snapshot = JSON.parse(snapshotText); const hashes = JSON.parse(text(path.join(fixtureRoot, "snapshot-hashes.json")));
assert.equal(sha256(snapshotText), hashes.hashes["forward-evidence-artifacts.snapshot.json"]);
const { contract, entries, migration } = await buildForwardEvidenceArtifactScenario();
assert.deepEqual(migration, snapshot.payload);
assert.deepEqual(await contract.validateForwardEvidenceArtifactManifest(migration.manifest, migration.artifacts), []);
for (const artifact of migration.artifacts) assert.deepEqual(await contract.validateForwardEvidenceArtifact(artifact), []);
const persistedLegacyEntries = JSON.parse(JSON.stringify(entries));
assert.equal(JSON.stringify(migration.artifacts.map(contract.projectForwardEvidenceArtifactToLegacy)),
  JSON.stringify(persistedLegacyEntries));
assert.equal(migration.manifest.legacyAuthoritative, true); assert.equal(migration.manifest.automaticMirroringAllowed, false);
assert.deepEqual(migration.manifest.orderedArtifactIds, migration.artifacts.map((artifact) => artifact.artifactId));
assert.deepEqual(migration.artifacts[0].causalTags,
  ["causal_at_issue:true", "forward_eligible:true", "origin:live_closed_candle", "outcome:pending"]);
assert.equal(migration.artifacts[1].causalTags.includes("origin:legacy_unverified"), true);
const reversed = await contract.migrateForwardEvidenceLedgerToArtifacts([...entries].reverse());
assert.notEqual(reversed.manifest.manifestId, migration.manifest.manifestId);
assert.deepEqual(reversed.artifacts.map((artifact) => artifact.artifactId), [...migration.artifacts].reverse().map((artifact) => artifact.artifactId));
await assert.rejects(contract.migrateForwardEvidenceLedgerToArtifacts([entries[0], entries[0]]), /duplicate legacy entry IDs/);
const future = structuredClone(migration.artifacts[0]); future.schemaVersion = "gotrader-v2-forward-evidence-artifact-v99";
assert.deepEqual(await contract.validateForwardEvidenceArtifact(future), ["forward_evidence_artifact_schema_unsupported"]);
const tampered = structuredClone(migration.artifacts[0]); tampered.legacyProjection.notes = "changed";
assert.deepEqual(await contract.validateForwardEvidenceArtifact(tampered), ["forward_evidence_artifact_id_invalid"]);
const unsafe = structuredClone(entries[0]); unsafe.rawCandles = [{ open: 1 }];
await assert.rejects(contract.buildForwardEvidenceArtifact(unsafe), /blocked fields/);
const serialized = JSON.stringify(migration);
assert.doesNotMatch(serialized, /"(?:candles|rawCandles|accountData|orderData|positionData|secret|token)"\s*:/i);
const report = { schemaVersion: "gotrader-bt3-forward-evidence-artifact-report-v1", status: "passed",
  snapshotHash: `sha256:${sha256(snapshotText)}`, entryCount: entries.length, manifestId: migration.manifest.manifestId,
  artifactIds: migration.artifacts.map((artifact) => artifact.artifactId), exactLegacyProjection: true,
  orderPreserved: true, legacyAuthoritative: true, automaticMirroringAllowed: false, migratedLedgerCount: 1,
  rawCandlesSerialized: false, mt5Contacted: false, authority: migration.manifest.authority };
const reportPath = path.join(root, ".gotrader/bt3-evidence-artifacts/report.json"); fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"); console.log(JSON.stringify(report, null, 2));
