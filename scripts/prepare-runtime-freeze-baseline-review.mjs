#!/usr/bin/env node

import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  RUNTIME_FREEZE_AUTHORITY_NONE,
  RUNTIME_FREEZE_REQUIRED_B1_COMMITS,
  RUNTIME_FREEZE_REQUIRED_PREPARATION_FILES,
  RUNTIME_FREEZE_REQUIRED_RUNTIME_FILES,
  buildRuntimeFreezePreparationManifest,
  classifyA3OperationalReport,
  runtimeFreezeContentHash,
  summarizeA3ObserverEvidence,
  summarizeA3OperatorDecision
} from "./support/gotrader-runtime-freeze-manifest.mjs";

const execFileAsync = promisify(execFile);
const preparationRepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const args = process.argv.slice(2);
const argument = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const runtimeRepoRoot = path.resolve(
  argument("--runtime-repo") ??
    process.env.GOTRADER_ACCEPTED_RUNTIME_REPO ??
    preparationRepoRoot
);
const expectedRuntimeHead = argument("--expected-runtime-head");
const explicitEvidencePath = argument("--evidence");
const explicitDecisionPath = argument("--decision");

const git = async (repoRoot, gitArgs, { allowFailure = false } = {}) => {
  try {
    const result = await execFileAsync("git", gitArgs, {
      cwd: repoRoot,
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 4 * 1024 * 1024
    });
    return String(result.stdout ?? "").trim();
  } catch (error) {
    if (allowFailure) return undefined;
    throw error;
  }
};

const relativePortable = (repoRoot, targetPath) =>
  path.relative(repoRoot, targetPath).replaceAll("\\", "/");

const hashFile = async (repoRoot, relativePath) => {
  const absolutePath = path.resolve(repoRoot, relativePath);
  const relative = relativePortable(repoRoot, absolutePath);
  if (relative.startsWith("../") || path.isAbsolute(relative)) {
    throw new Error(`Freeze manifest path escaped repository: ${relativePath}`);
  }
  const bytes = await fs.readFile(absolutePath);
  return Object.freeze({
    path: relative,
    contentHash: runtimeFreezeContentHash(bytes),
    byteLength: bytes.byteLength
  });
};

const collectGitIdentity = async (repoRoot) => ({
  repositoryRoot: await git(repoRoot, ["rev-parse", "--show-toplevel"]),
  branch: await git(repoRoot, ["branch", "--show-current"]),
  headCommit: await git(repoRoot, ["rev-parse", "HEAD"]),
  clean: (await git(repoRoot, ["status", "--porcelain=v1"])) === ""
});

const collectB1Compatibility = async (repoRoot) => {
  const identity = await collectGitIdentity(repoRoot);
  const requiredCommits = [];
  for (const required of RUNTIME_FREEZE_REQUIRED_B1_COMMITS) {
    const fullHash = await git(repoRoot, ["rev-parse", required.shortHash], {
      allowFailure: true
    });
    const subject = fullHash
      ? await git(repoRoot, ["show", "-s", "--format=%s", fullHash], {
          allowFailure: true
        })
      : undefined;
    const ancestor = fullHash
      ? (await git(repoRoot, ["merge-base", "--is-ancestor", fullHash, "HEAD"], {
          allowFailure: true
        })) !== undefined
      : false;
    requiredCommits.push({
      shortHash: required.shortHash,
      fullHash,
      subject,
      present: Boolean(fullHash),
      ancestorOfHead: ancestor
    });
  }
  let requiredCommitOrderValid = true;
  for (let index = 1; index < requiredCommits.length; index += 1) {
    const previous = requiredCommits[index - 1]?.fullHash;
    const current = requiredCommits[index]?.fullHash;
    if (
      !previous ||
      !current ||
      (await git(repoRoot, ["merge-base", "--is-ancestor", previous, current], {
        allowFailure: true
      })) === undefined
    ) {
      requiredCommitOrderValid = false;
    }
  }
  const fileHashes = await Promise.all(
    RUNTIME_FREEZE_REQUIRED_PREPARATION_FILES.map((relativePath) =>
      hashFile(repoRoot, relativePath)
    )
  );
  return {
    ...identity,
    requiredCommits,
    requiredCommitOrderValid,
    fileHashes
  };
};

const compactService = (repoRoot, service) => ({
  serviceId: service.serviceId,
  runtime: service.runtime,
  dependencies: [...(service.dependencies ?? [])],
  expectedPorts: [...(service.expectedPorts ?? [])],
  scriptPath: relativePortable(repoRoot, service.scriptPath),
  healthProbes: (service.healthProbes ?? []).map((probe) => ({
    probeId: probe.probeId,
    kind: probe.kind,
    restartRelevant: probe.restartRelevant === true
  })),
  authority: RUNTIME_FREEZE_AUTHORITY_NONE
});

const collectRuntimeProfile = async (repoRoot) => {
  const modulePath = path.join(repoRoot, "scripts", "gotrader-runtime-core.mjs");
  const runtimeCore = await import(
    `${pathToFileURL(modulePath).href}?freezeReview=${Date.now()}`
  );
  const profile = runtimeCore.buildRuntimeProfile({
    profileId: "always_on_shadow_context_operational",
    repoRoot,
    env: process.env
  });
  const validation = runtimeCore.validateRuntimeProfile(profile);
  return {
    profileId: profile.profileId,
    profileVersion: profile.profileVersion,
    continuousFeedEnabled: profile.continuousFeedEnabled === true,
    closedCandleSchedulerEnabled: profile.closedCandleSchedulerEnabled === true,
    strategySchedulerEnabled: profile.strategySchedulerEnabled === true,
    paperDemoEnabled: profile.paperDemoEnabled === true,
    executionEnabled: profile.executionEnabled === true,
    aiSupervisorEnabled: profile.aiSupervisorEnabled === true,
    productionAdoptionAllowed: profile.productionAdoptionAllowed === true,
    operationalMarketStateEnabled: profile.operationalMarketStateEnabled === true,
    historicalContextHydrationEnabled:
      profile.historicalContextHydrationEnabled === true,
    enabledTaskTypes: [...(profile.enabledTaskTypes ?? [])],
    services: profile.services.map((service) => compactService(repoRoot, service)),
    validation,
    authority: RUNTIME_FREEZE_AUTHORITY_NONE
  };
};

const latestEvidencePath = async (repoRoot) => {
  const observationsRoot = path.join(
    repoRoot,
    ".gotrader",
    "runtime",
    "always_on_shadow_context_operational",
    "observations"
  );
  try {
    const names = (await fs.readdir(observationsRoot)).filter((name) =>
      /^a3_2_acceptance_\d+\.json$/.test(name)
    );
    const candidates = await Promise.all(
      names.map(async (name) => {
        const candidatePath = path.join(observationsRoot, name);
        const stat = await fs.stat(candidatePath);
        return { candidatePath, modifiedAt: stat.mtimeMs };
      })
    );
    return candidates.sort((left, right) => right.modifiedAt - left.modifiedAt)[0]
      ?.candidatePath;
  } catch {
    return undefined;
  }
};

const runtimeIdentity = await collectGitIdentity(runtimeRepoRoot);
const preparationIdentity = await collectB1Compatibility(preparationRepoRoot);
const profile = await collectRuntimeProfile(runtimeRepoRoot);
const fileHashes = await Promise.all(
  RUNTIME_FREEZE_REQUIRED_RUNTIME_FILES.map((relativePath) =>
    hashFile(runtimeRepoRoot, relativePath)
  )
);
const operationalReportPath = path.join(
  runtimeRepoRoot,
  "docs",
  "gotrader-runtime",
  "track-a3-2-operational-report.md"
);
const operationalReportText = await fs.readFile(operationalReportPath, "utf8");
const evidencePath = explicitEvidencePath
  ? path.resolve(explicitEvidencePath)
  : await latestEvidencePath(runtimeRepoRoot);
let observerEvidence = summarizeA3ObserverEvidence();
let observerEvidenceFile;
if (evidencePath) {
  const evidenceBytes = await fs.readFile(evidencePath);
  const payload = JSON.parse(evidenceBytes.toString("utf8"));
  observerEvidence = summarizeA3ObserverEvidence(payload);
  observerEvidenceFile = {
    path: relativePortable(runtimeRepoRoot, evidencePath),
    contentHash: runtimeFreezeContentHash(evidenceBytes),
    byteLength: evidenceBytes.byteLength
  };
}

const operatorDecisionPath = explicitDecisionPath
  ? path.resolve(explicitDecisionPath)
  : path.join(
      runtimeRepoRoot,
      "docs",
      "gotrader-runtime",
      "track-a3-2-operator-acceptance-decision.json"
    );
let operatorDecision = summarizeA3OperatorDecision();
let operatorDecisionFile;
try {
  const decisionBytes = await fs.readFile(operatorDecisionPath);
  const decisionPayload = JSON.parse(decisionBytes.toString("utf8"));
  const summary = summarizeA3OperatorDecision(decisionPayload);
  const candidateCommit = summary.acceptedRuntimeCandidateCommit;
  const candidateAncestor = candidateCommit
    ? (await git(
        runtimeRepoRoot,
        ["merge-base", "--is-ancestor", candidateCommit, runtimeIdentity.headCommit],
        { allowFailure: true }
      )) !== undefined
    : false;
  operatorDecision = {
    ...summary,
    acceptedRuntimeCandidateAncestorOfHead: candidateAncestor
  };
  operatorDecisionFile = {
    path: relativePortable(runtimeRepoRoot, operatorDecisionPath),
    contentHash: runtimeFreezeContentHash(decisionBytes),
    byteLength: decisionBytes.byteLength
  };
} catch {
  operatorDecision = summarizeA3OperatorDecision();
}

const manifest = buildRuntimeFreezePreparationManifest({
  generatedAt: new Date().toISOString(),
  expectedRuntimeHead,
  runtime: {
    ...runtimeIdentity,
    profile,
    fileHashes,
    operationalReport: {
      path: relativePortable(runtimeRepoRoot, operationalReportPath),
      contentHash: runtimeFreezeContentHash(operationalReportText),
      byteLength: Buffer.byteLength(operationalReportText),
      status: classifyA3OperationalReport(operationalReportText)
    },
    observerEvidence: {
      ...observerEvidence,
      file: observerEvidenceFile
    },
    operatorDecision: {
      ...operatorDecision,
      file: operatorDecisionFile
    }
  },
  preparation: preparationIdentity
});

console.log(JSON.stringify(manifest, null, 2));
process.exitCode = manifest.status === "blocked_baseline_mismatch" ? 2 : 0;
