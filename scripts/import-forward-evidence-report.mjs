#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceArg = process.argv[2];
if (!sourceArg) {
  console.error("Usage: npm.cmd run import:forward-evidence -- <path-to-ifvg-v3-forward-evidence.json>");
  process.exit(1);
}

const repoRoot = process.cwd();
const sourcePath = path.resolve(repoRoot, sourceArg);
const targetPath = path.join(repoRoot, ".gotrader", "ifvg-v3-forward-evidence.json");
const report = JSON.parse((await readFile(sourcePath, "utf8")).replace(/^\uFEFF/, ""));
const serialized = JSON.stringify(report);

const fail = (message) => {
  throw new Error(`Forward-evidence import blocked: ${message}`);
};

if (/"(?:candles|rawCandles|runtimeSnapshot|account|accounts|orders|positions|apiKey|password|secret|token)"\s*:/i.test(serialized)) {
  fail("unsafe fields are present");
}
if (report.reportType !== "gotrader_forward_evidence_gateway_report" || report.reportVersion !== "v1") {
  fail("unsupported report contract");
}
if (report.profileId !== "ifvg_fresh_retest_v3_research" || report.profileVersion !== "v3") {
  fail("profile identity does not match frozen IFVG v3");
}
if (report.autoPromotionAllowed !== false) fail("auto-promotion must remain disabled");
if (
  report.authority?.executionAuthority !== "none" ||
  report.authority?.brokerAuthority !== "none" ||
  report.authority?.readinessOverrideAuthority !== "none"
) {
  fail("authority must remain none/none/none");
}
for (const field of ["completedForwardOutcomes", "independentDates", "forwardWindows"]) {
  if (!Number.isInteger(report[field]) || report[field] < 0) fail(`${field} must be a non-negative integer`);
}
if (!Array.isArray(report.blockers) || typeof report.reassessmentEligible !== "boolean") {
  fail("report evaluation fields are incomplete");
}

await mkdir(path.dirname(targetPath), { recursive: true });
await writeFile(targetPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  status: "imported",
  sourcePath,
  targetPath,
  profileId: report.profileId,
  completedForwardOutcomes: report.completedForwardOutcomes,
  independentDates: report.independentDates,
  forwardWindows: report.forwardWindows,
  reassessmentEligible: report.reassessmentEligible,
  autoPromotionAllowed: false,
  authority: report.authority
}, null, 2));
