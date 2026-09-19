import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadBoundRuntime } from "./lib/bt-g1-3r-runtime.mjs";

const outputRoot = path.resolve(".gotrader", `bound-runtime-test-${Date.now()}-${process.pid}`);
const input = { outputRoot, entries: ["src/lib/ictCanonical/canonicalIctIdentity.ts"],
  packageBinding: { testPackage: "fixed" } };
try {
  const first = loadBoundRuntime(input), next = loadBoundRuntime(input);
  assert.deepEqual(first.entryUrls, next.entryUrls);
  assert.equal(first.compiledFiles, next.compiledFiles);
  await assert.rejects(async () => loadBoundRuntime({ ...input, packageBinding: { testPackage: "changed" } }), /INTEGRITY/);
  const manifest = JSON.parse(fs.readFileSync(path.join(outputRoot, "runtime-manifest.json")));
  fs.appendFileSync(path.join(outputRoot, manifest.files[0].file), "\n// tampered fixture\n");
  assert.throws(() => loadBoundRuntime(input), /INTEGRITY/);
  console.log("PASS: shared runtime reuse, package mismatch and content tampering rejection");
} finally {
  assert.equal(path.dirname(outputRoot), path.resolve(".gotrader"));
  fs.rmSync(outputRoot, { recursive: true, force: true });
}
