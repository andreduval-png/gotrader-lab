#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { loadLrsBaselineModules } from "./support/liquidity-reclaim-scalper-baseline-runner.mjs";
import { openR1Controller, sealR1ControllerCheckpoint, verifyAcceptedR1Inputs,
  writeImmutableR1Artifact } from "./support/liquidity-reclaim-scalper-r1-executor.mjs";

const root = process.cwd();
const sourceRoot = process.env.GOTRADER_LRS_R1_RESUME_SOURCE_ROOT;
const targetRoot = process.env.GOTRADER_LRS_R1_RESUME_TARGET_ROOT;
const sourceCommit = process.env.GOTRADER_LRS_R1_RESUME_SOURCE_COMMIT;
const authorizationCommit = process.env.GOTRADER_LRS_R1_RESUME_AUTHORIZATION_COMMIT;
const targetCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (!sourceRoot || !targetRoot || !/^[a-f0-9]{40}$/.test(sourceCommit ?? "") || !/^[a-f0-9]{40}$/.test(authorizationCommit ?? "")) {
  throw new Error("R1 resume source, target, source commit, and authorization commit are required.");
}
if (path.resolve(sourceRoot) === path.resolve(targetRoot) || fs.existsSync(targetRoot)) {
  throw new Error("R1 resume target must be a new isolated root.");
}

const modules = await loadLrsBaselineModules(path.join(root, ".gotrader/liquidity-reclaim-scalper-v1/compiled-r1-resume-preparer"));
const { definitions } = await verifyAcceptedR1Inputs({ modules,
  acceptancePath: path.join(root, "docs/gotrader-strategies/liquidity-reclaim-scalper/r1-trial-controls-acceptance.json") });
const selectedTrialIds = definitions.map((item) => item.trialId);

const treeDigest = (directory, excluded = new Set()) => {
  const hash = crypto.createHash("sha256");
  let fileCount = 0;
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(current, entry.name);
      const relative = path.relative(directory, full).replaceAll("\\", "/");
      if (excluded.has(relative)) continue;
      if (entry.isDirectory()) visit(full);
      else {
        hash.update(relative).update("\0").update(fs.readFileSync(full)).update("\0");
        fileCount += 1;
      }
    }
  };
  visit(directory);
  return Object.freeze({ fileCount, digest: `sha256:${hash.digest("hex")}` });
};

const sourceTree = treeDigest(sourceRoot);
const source = await openR1Controller({ modules, outputRoot: sourceRoot, mode: "family", selectedTrialIds, controllerCommit: sourceCommit });
const verifiedSourceTree = treeDigest(sourceRoot);
if (sourceTree.fileCount !== verifiedSourceTree.fileCount || sourceTree.digest !== verifiedSourceTree.digest) {
  throw new Error("R1 resume source verification mutated the preserved source root.");
}
fs.cpSync(sourceRoot, targetRoot, { recursive: true, errorOnExist: true, force: false });
const copiedTree = treeDigest(targetRoot);
if (sourceTree.fileCount !== copiedTree.fileCount || sourceTree.digest !== copiedTree.digest) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
  throw new Error("R1 resume byte-copy verification failed.");
}

const sourceCheckpoint = source.checkpoint;
const copied = await openR1Controller({ modules, outputRoot: targetRoot, mode: "family",
  selectedTrialIds, controllerCommit: sourceCommit });
const verifiedCopiedTree = treeDigest(targetRoot);
if (copiedTree.fileCount !== verifiedCopiedTree.fileCount || copiedTree.digest !== verifiedCopiedTree.digest) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
  throw new Error("R1 resume copied-root verification mutated inherited evidence.");
}
const targetStorage = copied.storage;
const adoptionRoot = `resume/adoptions/${targetCommit}`;
await writeImmutableR1Artifact({ modules, storage: targetStorage,
  relativePath: `${adoptionRoot}/source-controller.json`, artifact: sourceCheckpoint });
const adoptionCore = Object.freeze({ schemaVersion: "gotrader-lrs-r1-controller-resume-adoption-v1",
  sourceCheckpointId: sourceCheckpoint.checkpointId, sourceControllerCommit: sourceCommit,
  targetControllerCommit: targetCommit, authorizationCommit, copiedFileCount: sourceTree.fileCount,
  copiedTreeDigest: sourceTree.digest, experimentFamilyId: sourceCheckpoint.experimentFamilyId,
  samplingPlanId: sourceCheckpoint.samplingPlanId, sampleSetId: sourceCheckpoint.sampleSetId,
  datasetCertificateId: sourceCheckpoint.datasetCertificateId, datasetId: sourceCheckpoint.datasetId,
  sourceFingerprint: sourceCheckpoint.sourceFingerprint, authority: sourceCheckpoint.authority,
  holdoutUsed: false, adaptiveSearchUsed: false });
const adoption = Object.freeze({ ...adoptionCore, adoptionId: await modules.canonical.canonicalHash(adoptionCore) });
await writeImmutableR1Artifact({ modules, storage: targetStorage,
  relativePath: `${adoptionRoot}/controller-adoption.json`, artifact: adoption });
const { checkpointId: ignoredCheckpointId, ...sourceCore } = sourceCheckpoint;
const targetCheckpoint = await sealR1ControllerCheckpoint(modules, { ...sourceCore, controllerCommit: targetCommit });
await targetStorage.adapter.writeTextAtomic("checkpoints/controller.json", `${modules.canonical.canonicalSerialize(targetCheckpoint)}\n`);
await openR1Controller({ modules, outputRoot: targetRoot, mode: "family", selectedTrialIds, controllerCommit: targetCommit });
console.log(JSON.stringify({ status: "prepared", sourceRoot, targetRoot, sourceTree, sourceCheckpointId: sourceCheckpoint.checkpointId,
  targetCheckpointId: targetCheckpoint.checkpointId, adoptionId: adoption.adoptionId }, null, 2));
