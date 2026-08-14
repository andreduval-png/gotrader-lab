#!/usr/bin/env node
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadLrsBaselineModules, runCertifiedBaseline } from "./support/liquidity-reclaim-scalper-baseline-runner.mjs";
import { R1_CERTIFICATE_ID, R1_DATASET_ID, verifyAcceptedR1Inputs } from "./support/liquidity-reclaim-scalper-r1-executor.mjs";

const root = process.cwd();
const outputRoot = process.env.GOTRADER_LRS_R1_TRIAL_ROOT;
const ordinal = Number(process.env.GOTRADER_LRS_R1_TRIAL_ORDINAL);
if (!outputRoot || !Number.isInteger(ordinal) || ordinal < 0 || ordinal >= 128) throw new Error("Exact R1 trial root and ordinal are required.");
const bt = process.env.GOTRADER_BT16_ROOT ?? "C:/Users/andre/OneDrive/Documents/gotrader-backtest-bt1-6";
const repositoryRoot = process.env.GOTRADER_LRS_DATASET_ROOT ?? path.join(bt, ".gotrader/bt1-5/datasets/sha256_4a0bb904e6e90c99249f876679ba4b41bc95cbad1cff229f1a68c36c00283d76/full/repository");
const modules = await loadLrsBaselineModules(path.join(root, ".gotrader/liquidity-reclaim-scalper-v1/compiled-r1"));
const { definitions } = await verifyAcceptedR1Inputs({ modules,
  acceptancePath: path.join(root, "docs/gotrader-strategies/liquidity-reclaim-scalper/r1-trial-controls-acceptance.json") });
const trial = definitions[ordinal];
if (trial.initialDisposition !== "planned_unique" || trial.parameterHash !== process.env.GOTRADER_LRS_R1_PARAMETER_HASH) {
  throw new Error("R1 child request is not the exact accepted unique trial.");
}
const result = await runCertifiedBaseline({ modules, repositoryRoot, outputRoot, parameters: trial.parameters,
  certificatePath: path.join(bt, ".gotrader/bt1-6/certificates/bt1-6-v3-certificate.json"),
  registryPath: path.join(bt, ".gotrader/bt1-6/registry/bt1-6-v3-registry.json"), expectedCertificateId: R1_CERTIFICATE_ID,
  expectedDatasetId: R1_DATASET_ID, expectedParameterHash: trial.parameterHash,
  codeCommit: process.env.GOTRADER_LRS_R1_CONTROLLER_COMMIT ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  maximumSegmentsThisProcess: Number(process.env.GOTRADER_LRS_MAX_SEGMENTS) || 10,
  maximumRecordsThisProcess: Number(process.env.GOTRADER_LRS_MAX_RECORDS) || 5 });
console.log(`R1_RESULT ${JSON.stringify({ interrupted: result.interrupted, reason: result.reason,
  reportId: result.report?.reportId, ledgerSealId: result.report?.ledgerSealId, rssBytes: process.memoryUsage().rss })}`);
process.exit(result.interrupted ? 75 : 0);
