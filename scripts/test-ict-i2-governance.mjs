#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadIctI2 } from "./ict-i2-test-harness.mjs";

const ict = await loadIctI2();
for (const packet of ict.ICT_I2_SOURCE_PACKETS) ict.assertIctI2SourcePacket(packet);
const baselines = ict.assertIctI2BaselineGovernance();
assert.equal(baselines.length, 3);
assert.equal(baselines.filter((manifest) => manifest.status === "DEFERRED_CONCURRENCY").length, 2);
assert.equal(baselines.filter((manifest) => manifest.status === "DEFERRED_CONCURRENCY" && manifest.dataset?.datasetCertificateId === ict.ICT_I2_QUALIFIED_DATASET.datasetCertificateId).length, 2);
assert.equal(baselines.filter((manifest) => manifest.status === "BLOCKED_SOURCE_SEMANTICS").length, 1);
assert(baselines.every((manifest) => manifest.metrics === null && manifest.researchValidated === false));
assert.equal(ict.executableIctI2Registry().length, 2);
assert.equal(ict.ICT_2022_CANONICAL_MODEL.parameterSchema.parameters.length, 6);
assert.equal(ict.ICT_PO3_CANONICAL_MODEL.parameterSchema.parameters.length, 7);
assert.equal(ict.ICT_JUDAS_BLOCKED_MODEL.parameterSchema.parameters.length, 8);

const requiredDocs = [
  "i2-source-rule-classification.md",
  "i2-2022-model-specification.md", "i2-2022-state-machine.md", "i2-2022-baseline-report.md",
  "i2-po3-model-specification.md", "i2-po3-state-machine.md", "i2-po3-cmd-comparison.md", "i2-po3-baseline-report.md",
  "i2-judas-model-specification.md", "i2-judas-state-machine.md", "i2-judas-london-raid-comparison.md", "i2-judas-baseline-report.md",
  "i2-bt2-integration-report.md", "i2-current-read-integration.md", "i2-final-implementation-report.md"
];
const docsRoot = path.join(process.cwd(), "docs", "gotrader-ict", "i2");
assert(requiredDocs.every((name) => fs.existsSync(path.join(docsRoot, name))));
assert.equal(fs.readdirSync(docsRoot).filter((name) => name.endsWith(".md")).length, 15);

console.log(JSON.stringify({ status: "passed", sourcePackets: 3, executableModels: 2, sourceBlockedModels: 1, baselineRuns: 0, requiredDocuments: 15, researchValidated: false }, null, 2));
