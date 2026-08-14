#!/usr/bin/env node
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadLrsBaselineModules, runCertifiedBaseline } from "./support/liquidity-reclaim-scalper-baseline-runner.mjs";

const root = process.cwd();
const bt = process.env.GOTRADER_BT16_ROOT ?? "C:/Users/andre/OneDrive/Documents/gotrader-backtest-bt1-6";
const repositoryRoot = process.env.GOTRADER_LRS_DATASET_ROOT ?? path.join(bt, ".gotrader/bt1-5/datasets/sha256_4a0bb904e6e90c99249f876679ba4b41bc95cbad1cff229f1a68c36c00283d76/full/repository");
const outputRoot = process.env.GOTRADER_LRS_BASELINE_ROOT ?? path.join(root, ".gotrader/liquidity-reclaim-scalper-v1/certified-baseline");
const modules = await loadLrsBaselineModules(path.join(root, ".gotrader/liquidity-reclaim-scalper-v1/compiled-baseline"));
const result = await runCertifiedBaseline({ modules, repositoryRoot, outputRoot,
  certificatePath: path.join(bt, ".gotrader/bt1-6/certificates/bt1-6-v3-certificate.json"),
  registryPath: path.join(bt, ".gotrader/bt1-6/registry/bt1-6-v3-registry.json"),
  expectedCertificateId: "sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193",
  expectedDatasetId: "sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d",
  expectedParameterHash: "sha256:c58d3a0aaff9ba61ece6ea0df2d76145059be36cab9f2347a66a0e6da642f748",
  codeCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  interruptAfterSegments: Number(process.env.GOTRADER_LRS_INTERRUPT_AFTER_SEGMENTS) || undefined,
  maximumSegmentsThisProcess: Number(process.env.GOTRADER_LRS_MAX_SEGMENTS) || undefined,
  maximumRecordsThisProcess: Number(process.env.GOTRADER_LRS_MAX_RECORDS) || undefined,
  interruptAfterRecords: Number(process.env.GOTRADER_LRS_INTERRUPT_AFTER_RECORDS) || undefined });
console.log(JSON.stringify(result.interrupted ? { interrupted: true, reason: result.reason,
  nextSegment: result.checkpoint?.nextSegment, candidateCount: result.checkpoint?.candidateCount,
  experimentId: result.experimentId, nextRecordOrdinal: result.nextRecordOrdinal } : result, null, 2));
