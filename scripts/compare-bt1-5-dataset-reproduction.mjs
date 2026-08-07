#!/usr/bin/env node

import path from "node:path";
import {
  authorityNone,
  bt15RuntimeRoot,
  loadBt15Modules,
  parseArguments,
  readJson,
  requireAuthorityNone,
  requireHash,
  writeJsonAtomic
} from "./support/bt1-5-qualification-runtime.mjs";

const args = parseArguments(process.argv.slice(2));
if (!args.left || !args.right || !["deterministic_rematerialization", "provider_requery"].includes(args.mode)) {
  throw new Error("Usage: compare-bt1-5-dataset-reproduction --left <report.json> --right <report.json> --mode <deterministic_rematerialization|provider_requery>");
}
const left = readJson(args.left);
const right = readJson(args.right);
requireAuthorityNone(left.authority, "left report authority");
requireAuthorityNone(right.authority, "right report authority");
requireHash(left.reportId, "left reportId");
requireHash(right.reportId, "right reportId");
if (!left.identities || !right.identities) throw new Error("BT1.5 reproduction reports must contain completed identities.");
const modules = await loadBt15Modules("compare-reproduction");
for (const [label, report] of [["left", left], ["right", right]]) {
  const { reportId, ...reportCore } = report;
  if (await modules.canonical.canonicalHash(reportCore) !== reportId) {
    throw new Error(`BT1.5 ${label} report integrity mismatch.`);
  }
}
const checks = Object.freeze({
  requestId: left.identities.requestId === right.identities.requestId,
  partitionIdentities: JSON.stringify(left.identities.timeframes.map((item) => item.partitionIds)) ===
    JSON.stringify(right.identities.timeframes.map((item) => item.partitionIds)),
  timeframeChecksums: JSON.stringify(left.identities.timeframes.map((item) => item.timeframeChecksum)) ===
    JSON.stringify(right.identities.timeframes.map((item) => item.timeframeChecksum)),
  datasetChecksum: left.identities.datasetChecksum === right.identities.datasetChecksum,
  datasetId: left.identities.datasetId === right.identities.datasetId,
  manifestHash: left.identities.manifestHash === right.identities.manifestHash,
  lineageNodeKey: left.identities.lineageNodeKey === right.identities.lineageNodeKey
});
const blockers = Object.freeze(Object.entries(checks).filter(([, passed]) => !passed).map(([name]) =>
  `historical_reproduction_${name}_mismatch`).sort());
const core = Object.freeze({
  schemaVersion: "gotrader-bt1-5-reproduction-comparison-v1",
  comparisonMode: args.mode,
  leftReportId: left.reportId,
  rightReportId: right.reportId,
  checks,
  status: blockers.length ? "blocked" : "passed",
  blockers,
  authority: authorityNone
});
const comparison = Object.freeze({ ...core, comparisonId: await modules.canonical.canonicalHash(core) });
const output = args.output
  ? path.resolve(args.output)
  : path.join(bt15RuntimeRoot(), "reproduction", `${comparison.comparisonId.replace(":", "_")}.json`);
const written = writeJsonAtomic(output, comparison);
console.log(JSON.stringify({ ...comparison, output: written }, null, 2));
