#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { buildPredictionArtifactScenario } from "./bt3/generate-prediction-artifact-fixtures.mjs";
import { buildForwardEvidenceArtifactScenario } from "./bt3/generate-forward-evidence-artifact-fixtures.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-prediction-artifacts/browser");

compileTypescriptModules({
  files: [
    path.join(root, "src/lib/predictionLedger/predictionArtifactRepository.ts"),
    path.join(root, "src/lib/forwardEvidence/forwardEvidenceArtifactRepository.ts"),
  ],
  outRoot,
});
fs.writeFileSync(path.join(outRoot, "index.html"), "<!doctype html><title>upgrade test</title>");

const server = http.createServer((request, response) => {
  const file = path.join(outRoot, request.url === "/" ? "index.html" : request.url.slice(1));
  if (!file.startsWith(outRoot) || !fs.existsSync(file)) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "Content-Type": file.endsWith(".mjs") ? "text/javascript" : "text/html" });
  response.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

const port = server.address().port;
const { state } = await buildPredictionArtifactScenario();
const forward = (await buildForwardEvidenceArtifactScenario()).migration;
const predictionBytes = JSON.stringify(state);
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  const result = await page.evaluate(async ({ state, predictionBytes, forward }) => {
    const dbName = "gotrader-v2-evidence-artifacts";
    const predictionArtifactStore = "prediction_artifacts";
    const predictionManifestStore = "prediction_manifests";
    localStorage.setItem("gotrader.prediction-ledger.v1", predictionBytes);

    const deleteDatabase = () => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
    const transact = (stores, mode, operation) => new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 2);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(stores, mode);
        operation(transaction);
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });

    await deleteDatabase();
    await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("forward_evidence_artifacts", { keyPath: "artifactId" });
        request.result.createObjectStore("forward_evidence_manifests", { keyPath: "manifestId" });
      };
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(
          ["forward_evidence_artifacts", "forward_evidence_manifests"],
          "readwrite",
        );
        forward.artifacts.forEach((item) => transaction.objectStore("forward_evidence_artifacts").add(item));
        transaction.objectStore("forward_evidence_manifests").add(forward.manifest);
        transaction.oncomplete = () => {
          db.close();
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });

    const predictionRepo = await import("/predictionArtifactRepository.mjs");
    const forwardRepo = await import("/forwardEvidenceArtifactRepository.mjs");
    const first = await predictionRepo.persistPredictionArtifactMirror(state);
    const repeated = await predictionRepo.persistPredictionArtifactMirror(state);
    const secondState = { ...state, updatedAt: "2026-08-12T00:01:00.000Z" };
    const shared = await predictionRepo.persistPredictionArtifactMirror(secondState);
    const loaded = await predictionRepo.loadPredictionArtifactMirror(first.manifest.manifestId);
    const preservedForward = await forwardRepo.loadForwardEvidenceArtifactMirror(forward.manifest.manifestId);

    const firstRollback = await predictionRepo.rollbackPredictionArtifactMirror(first.manifest.manifestId);
    const sharedAfterFirstRollback = await predictionRepo.loadPredictionArtifactMirror(shared.manifest.manifestId);
    const secondRollback = await predictionRepo.rollbackPredictionArtifactMirror(shared.manifest.manifestId);

    const poison = structuredClone(first.artifacts[0]);
    poison.legacyProjection.probabilityEstimate = 0.01;
    await transact([predictionArtifactStore], "readwrite", (transaction) => {
      transaction.objectStore(predictionArtifactStore).add(poison);
    });
    let immutableConflictRejected = false;
    try {
      await predictionRepo.persistPredictionArtifactMirror(state);
    } catch (error) {
      immutableConflictRejected = String(error).includes("immutable artifact conflict");
    }
    await transact([predictionArtifactStore, predictionManifestStore], "readwrite", (transaction) => {
      transaction.objectStore(predictionArtifactStore).delete(poison.artifactId);
    });

    const after = await predictionRepo.loadPredictionArtifactMirror(first.manifest.manifestId);
    const forwardAfter = await forwardRepo.loadForwardEvidenceArtifactMirror(forward.manifest.manifestId);
    return {
      first: first.status,
      repeated: repeated.status,
      shared: shared.status,
      count: loaded?.artifacts.length ?? 0,
      firstRollback,
      secondRollback,
      sharedAfterFirstRollback: Boolean(sharedAfterFirstRollback),
      immutableConflictRejected,
      after: Boolean(after),
      forwardPreserved: Boolean(preservedForward),
      forwardAfter: Boolean(forwardAfter),
      legacyAfter: localStorage.getItem("gotrader.prediction-ledger.v1"),
      manifestId: first.manifest.manifestId,
    };
  }, { state, predictionBytes, forward });

  assert.equal(result.first, "persisted");
  assert.equal(result.repeated, "unchanged");
  assert.equal(result.shared, "persisted");
  assert.equal(result.count, 4);
  assert.equal(result.firstRollback.removedArtifactCount, 0);
  assert.equal(result.firstRollback.retainedSharedArtifactCount, 4);
  assert.equal(result.sharedAfterFirstRollback, true);
  assert.equal(result.secondRollback.removedArtifactCount, 4);
  assert.equal(result.immutableConflictRejected, true);
  assert.equal(result.after, false);
  assert.equal(result.forwardPreserved, true);
  assert.equal(result.forwardAfter, true);
  assert.equal(result.legacyAfter, predictionBytes);

  const report = {
    schemaVersion: "gotrader-bt3-prediction-indexeddb-report-v1",
    status: "passed",
    databaseV1ToV2Upgrade: true,
    forwardEvidencePreserved: true,
    browserIndexedDb: true,
    idempotent: true,
    immutableConflictRejected: true,
    sharedReferenceRetention: true,
    scopedRollbackPassed: true,
    legacyBytesUnchanged: true,
    legacyAuthoritative: true,
    automaticMirroringAllowed: false,
    manifestId: result.manifestId,
  };
  const reportPath = path.join(root, ".gotrader/bt3-prediction-artifacts/indexeddb-report.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
