#!/usr/bin/env node
import path from "node:path";
import { buildSyntheticCases, loadStage2Modules, readBoundedM1Candles, runShadowLane, verifyQualifiedInput } from "./support/bt2-stage2-shadow-runner.mjs";

const value = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const sourceRoot = path.resolve(value("--source-root", "../gotrader-backtest-bt1-6"));
const outputRoot = path.resolve(value("--output-root", ".gotrader/bt2-stage2/manual"));
const modules = await loadStage2Modules(path.join(outputRoot, "compiled"));
const qualified = await verifyQualifiedInput({
  modules,
  certificatePath: path.join(sourceRoot, ".gotrader/bt1-6/certificates/bt1-6-v3-certificate.json"),
  registryPath: path.join(sourceRoot, ".gotrader/bt1-6/registry/bt1-6-v3-registry.json"),
  repositoryRoot: path.join(sourceRoot, ".gotrader/bt1-5/datasets/sha256_4a0bb904e6e90c99249f876679ba4b41bc95cbad1cff229f1a68c36c00283d76/full/repository")
});
if (qualified.blockers.length) throw new Error(`Qualified input blocked: ${qualified.blockers.join(", ")}`);
const sample = readBoundedM1Candles({ repositoryRoot: path.join(sourceRoot, ".gotrader/bt1-5/datasets/sha256_4a0bb904e6e90c99249f876679ba4b41bc95cbad1cff229f1a68c36c00283d76/full/repository"), manifest: qualified.manifest, maximumPartitions: Number(value("--maximum-partitions", "3")) });
const cases = await buildSyntheticCases({ modules, qualified, sample, maximumOpportunities: Number(value("--maximum-opportunities", "12")) });
const result = await runShadowLane({ modules, outputRoot, cases, qualified, sample, codeCommit: value("--code-commit", "working-tree"), interruptAfterRecords: Number(value("--interrupt-after-records", "0")) || undefined });
console.log(JSON.stringify(result, null, 2));
if (result.interrupted) process.exit(75);
