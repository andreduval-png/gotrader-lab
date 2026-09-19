import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { canonicalHash } from "./bt-g1-3-certified-dataset.mjs";

// Explicit reviewed adoption copies only completed stages, never the killed
// worker's mixed cursors or stale locks. The fold runner revalidates each seed.
export const adoptReviewedContinuation = async ({ source, destination, throughStage, plan, packageIdentity }) => {
  source = path.resolve(source);
  const read = (file) => JSON.parse(fs.readFileSync(path.join(source, file), "utf8"));
  const manifest = read("manifest.json");
  assert.ok(Number.isSafeInteger(throughStage) && throughStage > 0 && throughStage < plan.stages);
  assert.equal(manifest.batchSize, plan.batchSize);
  assert.deepEqual(manifest.schedule, plan.schedule);
  const git = (...args) => execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
  assert.match(manifest.packageIdentity.head, /^[a-f0-9]{40}$/);
  const sourceTree = git("rev-parse", `${manifest.packageIdentity.head}:src`);
  assert.equal(sourceTree, git("rev-parse", "HEAD:src"));
  for (const key of Object.keys(packageIdentity).filter((key) => !["head", "tree"].includes(key))) {
    assert.equal(manifest.packageIdentity[key], packageIdentity[key]);
  }
  const runtime = read("runtime/runtime-manifest.json");
  const { manifestHash, ...runtimeBody } = runtime;
  assert.equal(manifestHash, canonicalHash(runtimeBody));
  for (const item of runtime.files) {
    assert.ok(!path.isAbsolute(item.file) && !item.file.split(/[\\/]/).includes(".."));
    assert.equal(createHash("sha256").update(fs.readFileSync(path.join(source, "runtime", item.file))).digest("hex"), item.hash);
  }
  const { canonicalFingerprint } = await import(pathToFileURL(path.join(source,
    "runtime/src/lib/ictCanonical/canonicalIctIdentity.mjs")).href);
  const reports = [], files = [];
  let baseline;
  for (let stage = 1; stage <= throughStage; stage += 1) {
    const prefix = `stage-${stage}`, pilot = read(`${prefix}/pilot-report.json`);
    const supervisor = read(`${prefix}/supervisor-report.json`);
    assert.equal(supervisor.status, "COMPLETED");
    assert.equal(supervisor.packageUnchanged, true);
    assert.ok(supervisor.elapsedMs <= 120000 && Math.max(supervisor.peakRssBytes, pilot.resources.peakRssBytes) <= 768 * 1024 ** 2);
    assert.equal(fs.statSync(path.join(source, prefix, "stderr.log")).size, 0);
    assert.deepEqual(pilot.scheduledObservations.map((item) => item.asOf), plan.schedule);
    assert.deepEqual(pilot.results.map((item) => item.strategyId), pilot.protocol.owners);
    assert.equal(pilot.admissionHash, canonicalHash(pilot.admission));
    baseline ??= pilot;
    assert.equal(pilot.admissionHash, baseline.admissionHash);
    assert.deepEqual(pilot.policyBinding, baseline.policyBinding);
    for (const owner of pilot.results) {
      assert.equal(owner.status, "checkpointed");
      const { checkpointHash, ...checkpoint } = read(`${prefix}/${owner.strategyId}.checkpoint.json`);
      assert.equal(checkpointHash, canonicalFingerprint(checkpoint));
      assert.equal(checkpoint.nextPosition, stage * plan.batchSize);
    }
    fs.mkdirSync(path.join(destination, prefix));
    for (const entry of fs.readdirSync(path.join(source, prefix), { withFileTypes: true })) {
      assert.ok(entry.isFile(), "Reviewed stages must contain only regular evidence files");
      const file = `${prefix}/${entry.name}`, bytes = fs.readFileSync(path.join(source, file));
      files.push({ file, sha256: createHash("sha256").update(bytes).digest("hex") });
      fs.writeFileSync(path.join(destination, file), bytes, { flag: "wx" });
    }
    reports.push(supervisor);
  }
  return { reports, adoption: { source, sourceManifestHash: canonicalHash(manifest),
    sourcePackage: manifest.packageIdentity, sourceTree, throughStage, files,
    policy: "EXPLICIT_REVIEWED_COMPLETED_STAGE_ADOPTION_NO_FAILED_STAGE_OR_LOCK_REUSE" } };
};
