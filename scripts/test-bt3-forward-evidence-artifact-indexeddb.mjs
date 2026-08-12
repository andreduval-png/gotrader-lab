#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { buildForwardEvidenceArtifactScenario } from "./bt3/generate-forward-evidence-artifact-fixtures.mjs";

const root = process.cwd(); const outRoot = path.join(root, ".gotrader/bt3-evidence-artifacts/browser");
compileTypescriptModules({ files: [path.join(root, "src/lib/forwardEvidence/forwardEvidenceArtifactRepository.ts")], outRoot });
fs.writeFileSync(path.join(outRoot, "index.html"), "<!doctype html><title>BT3 evidence artifact IndexedDB test</title>", "utf8");
const server = http.createServer((request, response) => { const file = path.join(outRoot, request.url === "/" ? "index.html" : request.url.slice(1));
  if (!file.startsWith(outRoot) || !fs.existsSync(file)) { response.writeHead(404).end(); return; }
  response.writeHead(200, { "Content-Type": file.endsWith(".mjs") ? "text/javascript" : "text/html" }); response.end(fs.readFileSync(file)); });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); const port = server.address().port;
const { entries } = await buildForwardEvidenceArtifactScenario(); const legacyBytes = JSON.stringify(entries);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage(); await page.goto(`http://127.0.0.1:${port}/`);
  const result = await page.evaluate(async ({ entries, legacyBytes }) => {
    localStorage.setItem("gotrader.forward-evidence.v1", legacyBytes);
    const repository = await import("/forwardEvidenceArtifactRepository.mjs");
    await new Promise((resolve, reject) => { const request = indexedDB.deleteDatabase(repository.FORWARD_EVIDENCE_ARTIFACT_DB_NAME);
      request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); request.onblocked = () => reject(new Error("delete blocked")); });
    const first = await repository.persistForwardEvidenceArtifactMirror(entries);
    const loaded = await repository.loadForwardEvidenceArtifactMirror(first.manifest.manifestId);
    const second = await repository.persistForwardEvidenceArtifactMirror(entries);
    const reversed = await repository.persistForwardEvidenceArtifactMirror([...entries].reverse());
    const legacyAfterPersist = localStorage.getItem("gotrader.forward-evidence.v1");
    const rollback = await repository.rollbackForwardEvidenceArtifactMirror(first.manifest.manifestId);
    const afterRollback = await repository.loadForwardEvidenceArtifactMirror(first.manifest.manifestId);
    const sharedAfterRollback = await repository.loadForwardEvidenceArtifactMirror(reversed.manifest.manifestId);
    const finalRollback = await repository.rollbackForwardEvidenceArtifactMirror(reversed.manifest.manifestId);
    const poisoned = { ...first.artifacts[0], artifactType: "poisoned" };
    await new Promise((resolve, reject) => { const request = indexedDB.open(repository.FORWARD_EVIDENCE_ARTIFACT_DB_NAME,
      repository.FORWARD_EVIDENCE_ARTIFACT_DB_VERSION); request.onerror = () => reject(request.error); request.onsuccess = () => {
        const db = request.result; const tx = db.transaction("forward_evidence_artifacts", "readwrite");
        tx.objectStore("forward_evidence_artifacts").put(poisoned); tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error); }; });
    let immutableConflictRejected = false;
    try { await repository.persistForwardEvidenceArtifactMirror(entries); }
    catch (error) { immutableConflictRejected = String(error).includes("immutable artifact conflict"); }
    const legacyAfterRollback = localStorage.getItem("gotrader.forward-evidence.v1");
    return { firstStatus: first.status, secondStatus: second.status, backend: first.backend,
      artifactCount: loaded?.artifacts.length ?? 0, manifestId: first.manifest.manifestId, rollback, finalRollback,
      afterRollback: Boolean(afterRollback), sharedAfterRollback: Boolean(sharedAfterRollback), immutableConflictRejected,
      legacyAfterPersist, legacyAfterRollback };
  }, { entries, legacyBytes });
  assert.equal(result.backend, "indexeddb"); assert.equal(result.firstStatus, "persisted"); assert.equal(result.secondStatus, "unchanged");
  assert.equal(result.artifactCount, 2); assert.equal(result.rollback.status, "rolled_back"); assert.equal(result.rollback.removedArtifactCount, 0);
  assert.equal(result.rollback.retainedSharedArtifactCount, 2); assert.equal(result.sharedAfterRollback, true);
  assert.equal(result.finalRollback.removedArtifactCount, 2); assert.equal(result.immutableConflictRejected, true);
  assert.equal(result.afterRollback, false); assert.equal(result.legacyAfterPersist, legacyBytes); assert.equal(result.legacyAfterRollback, legacyBytes);
  const report = { schemaVersion: "gotrader-bt3-forward-evidence-indexeddb-report-v1", status: "passed",
    browserIndexedDb: true, idempotent: true, rollbackPassed: true,
    sharedArtifactRetentionPassed: true, immutableConflictRejected: true,
    legacyBytesUnchanged: true, legacyAuthoritative: true, automaticMirroringAllowed: false,
    manifestId: result.manifestId };
  const reportPath = path.join(root, ".gotrader/bt3-evidence-artifacts/indexeddb-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
