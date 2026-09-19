import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCleanPackageIdentity } from "./lib/p4-package-identity.mjs";
import { evaluateCapacityPreflight } from "./lib/p4-capacity-preflight.mjs";
import { inspectDiskBudget } from "./lib/p4-disk-budget.mjs";
import { superviseProbe } from "./lib/p4-probe-supervisor.mjs";
import { canonicalHash } from "./lib/bt-g1-3-certified-dataset.mjs";

const root = path.resolve(".gotrader/bt-g1-3r");
if (process.argv[2] === "--worker") {
  const mode = process.argv[3], stage = process.argv[4];
  if (!/^isolated-\d+-\d+$/.test(mode) || !["1", "2", "3", "4"].includes(stage)) throw new Error("INVALID_ISOLATED_STAGE");
  const directory = path.join(root, mode);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
  if (![2, 4].includes(manifest.stages) || Number(stage) > manifest.stages ||
      manifest.observationsPerOwner !== manifest.stages * 6) throw new Error("INVALID_ISOLATED_MANIFEST");
  const actual = readCleanPackageIdentity(process.cwd());
  if (canonicalHash(actual) !== canonicalHash(manifest.packageIdentity)) throw new Error("ISOLATED_PACKAGE_CHANGED");
  const { runBtG13rPilot } = await import("./lib/bt-g1-3r-pilot.mjs");
  await runBtG13rPilot({ mode: `${mode}/stage-${stage}`, expandedQualification: true,
    batchDirectory: path.join(directory, "batches"), maxBatches: 1, packageBinding: actual,
    qualificationObservations: manifest.observationsPerOwner });
} else {
  if (!["--qualify-two-processes", "--qualify-four-processes"].includes(process.argv[2])) throw new Error("EXPLICIT_CONTINUATION_QUALIFICATION_REQUIRED");
  const stages = process.argv[2] === "--qualify-four-processes" ? 4 : 2;
  const packageIdentity = readCleanPackageIdentity(process.cwd());
  const mode = `isolated-${Date.now()}-${process.pid}`, directory = path.join(root, mode);
  fs.mkdirSync(directory, { recursive: true });
  const manifest = { packageIdentity, stages, observationsPerOwner: stages * 6, fullEvaluationAllowed: false, authority: "none/none/none" };
  fs.writeFileSync(path.join(directory, "manifest.json"), JSON.stringify(manifest, null, 2), { flag: "wx" });
  const reports = [];
  for (let stage = 1; stage <= stages; stage += 1) {
    const disk = fs.statfsSync(directory);
    const preflight = evaluateCapacityPreflight({ freeMemoryBytes: os.freemem(), freeDiskBytes: disk.bavail * disk.bsize });
    if (preflight.status !== "BOUNDED_PROBE_ELIGIBLE") {
      fs.writeFileSync(path.join(directory, `stage-${stage}-blocked.json`), JSON.stringify(preflight));
      throw new Error("ISOLATED_CAPACITY_BLOCKED");
    }
    const stageDirectory = path.join(directory, `stage-${stage}`);
    fs.mkdirSync(stageDirectory);
    const result = await superviseProbe({ lockPath: path.join(root, "supervised-probe.lock"),
      script: fileURLToPath(import.meta.url), args: ["--worker", mode, String(stage)], cwd: process.cwd(),
      timeoutMs: 120000, maxRssBytes: 768 * 1024 ** 2,
      stdoutPath: path.join(stageDirectory, "stdout.log"), stderrPath: path.join(stageDirectory, "stderr.log"),
      inspectDisk: () => inspectDiskBudget({ directory, maxOutputBytes: 128 * 1024 ** 2, minimumFreeDiskBytes: 2 * 1024 ** 3 }) });
    let packageUnchanged = false;
    try { packageUnchanged = canonicalHash(readCleanPackageIdentity(process.cwd())) === canonicalHash(packageIdentity); } catch { /* Record failure. */ }
    const report = { ...result, stage, preflight, packageUnchanged };
    fs.writeFileSync(path.join(stageDirectory, "supervisor-report.json"), JSON.stringify(report, null, 2), { flag: "wx" });
    reports.push(report);
    if (result.status !== "COMPLETED" || !packageUnchanged) throw new Error("ISOLATED_STAGE_FAILED_NO_AUTOMATIC_RETRY");
    const pilot = JSON.parse(fs.readFileSync(path.join(stageDirectory, "pilot-report.json"), "utf8"));
    if (pilot.results.length !== 5 || pilot.results.some((owner) => stage < stages
      ? owner.status !== "checkpointed" || owner.nextPosition !== stage * 6
      : owner.status !== "completed" || owner.counts.evaluated !== manifest.observationsPerOwner)) throw new Error("ISOLATED_CURSOR_MISMATCH");
  }
  fs.writeFileSync(path.join(directory, "continuation-report.json"), JSON.stringify({ manifestHash: canonicalHash(manifest),
    reports, status: "COMPLETED_REQUIRES_REVIEW", fullEvaluationAllowed: false, authority: "none/none/none" }, null, 2));
  console.log(JSON.stringify({ directory, reports, fullEvaluationAllowed: false }, null, 2));
}
