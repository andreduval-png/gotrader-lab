import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { evaluateCapacityPreflight } from "./lib/p4-capacity-preflight.mjs";
import { superviseProbe } from "./lib/p4-probe-supervisor.mjs";
import { inspectDiskBudget } from "./lib/p4-disk-budget.mjs";
import { readCleanPackageIdentity } from "./lib/p4-package-identity.mjs";

if (process.argv[2] === "--worker") {
  const { runBtG13rPilot } = await import("./lib/bt-g1-3r-pilot.mjs");
  await runBtG13rPilot({ mode: process.argv[3], expandedQualification: process.argv[4] === "expanded" });
} else {
  if (!["--run-bounded-probe", "--qualify-expanded-probe"].includes(process.argv[2])) {
    throw new Error("P4_EXPLICIT_BOUNDED_PROBE_REQUIRED");
  }
  const packageIdentity = readCleanPackageIdentity(process.cwd());
  const disk = fs.statfsSync(process.cwd());
  const preflight = evaluateCapacityPreflight({
    freeMemoryBytes: os.freemem(), freeDiskBytes: disk.bavail * disk.bsize
  });
  if (preflight.status !== "BOUNDED_PROBE_ELIGIBLE") {
    throw new Error(`P4_CAPACITY_BLOCKED: ${preflight.blockers.join(",")}`);
  }
  const mode = `supervised-${Date.now()}-${process.pid}`;
  fs.mkdirSync(path.resolve(".gotrader", "bt-g1-3r"), { recursive: true });
  const directory = path.resolve(".gotrader", "bt-g1-3r", mode);
  fs.mkdirSync(directory, { recursive: false });
  const result = await superviseProbe({
    lockPath: path.resolve(".gotrader", "bt-g1-3r", "supervised-probe.lock"),
    script: fileURLToPath(import.meta.url), args: ["--worker", mode,
      process.argv[2] === "--qualify-expanded-probe" ? "expanded" : "pilot"], cwd: process.cwd(),
    timeoutMs: 120_000, maxRssBytes: 768 * 1024 ** 2,
    stdoutPath: path.join(directory, "stdout.log"), stderrPath: path.join(directory, "stderr.log"),
    inspectDisk: () => inspectDiskBudget({
      directory, maxOutputBytes: 128 * 1024 ** 2, minimumFreeDiskBytes: 2 * 1024 ** 3
    })
  });
  let packageUnchanged = false;
  try {
    packageUnchanged = JSON.stringify(readCleanPackageIdentity(process.cwd())) === JSON.stringify(packageIdentity);
  } catch { /* Preserve the terminal report even when the package became dirty. */ }
  fs.writeFileSync(path.join(directory, "supervisor-report.json"), JSON.stringify({
    ...result, preflight, packageIdentity, packageUnchanged,
    qualificationStatus: packageUnchanged ? "REQUIRES_REVIEW" : "PACKAGE_CHANGED",
    fullDatasetRunAllowed: false
  }, null, 2), { flag: "wx" });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "COMPLETED" || !packageUnchanged) process.exitCode = 1;
}
