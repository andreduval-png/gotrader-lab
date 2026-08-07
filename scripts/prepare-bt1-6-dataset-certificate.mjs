#!/usr/bin/env node

import path from "node:path";
import { createHistoricalDatasetNodeStorage } from "./support/historical-dataset-node-storage.mjs";
import {
  authorityNone,
  loadBt15Modules,
  parseArguments,
  requireAuthorityNone
} from "./support/bt1-5-qualification-runtime.mjs";
import {
  bt16RuntimeRoot,
  readBt16Json,
  verifyHashedArtifact,
  writeBt16JsonAtomic
} from "./support/bt1-6-certification-runtime.mjs";

const args = parseArguments(process.argv.slice(2));
const required = [
  "bundle",
  "capacity-plan",
  "qualification-report",
  "controlled-interruption-report",
  "deterministic-comparison",
  "provider-requery-comparison",
  "safety-report",
  "repository-root"
];
if (required.some((name) => !args[name])) {
  throw new Error(`Usage: prepare-bt1-6-dataset-certificate ${required.map((name) => `--${name} <path>`).join(" ")}`);
}

const modules = await loadBt15Modules("bt1-6-certificate");
const bundle = await verifyHashedArtifact(
  readBt16Json(args.bundle), "bundleId", modules.canonical, "qualification bundle"
);
const capacityPlan = await verifyHashedArtifact(
  readBt16Json(args["capacity-plan"]), "capacityPlanId", modules.canonical, "capacity plan"
);
const report = await verifyHashedArtifact(
  readBt16Json(args["qualification-report"]), "reportId", modules.canonical, "qualification report"
);
const interruption = await verifyHashedArtifact(
  readBt16Json(args["controlled-interruption-report"]), "reportId", modules.canonical, "interruption report"
);
const deterministic = await verifyHashedArtifact(
  readBt16Json(args["deterministic-comparison"]), "comparisonId", modules.canonical, "deterministic comparison"
);
const providerRequery = await verifyHashedArtifact(
  readBt16Json(args["provider-requery-comparison"]), "comparisonId", modules.canonical, "provider requery"
);
const safety = await verifyHashedArtifact(
  readBt16Json(args["safety-report"]), "safetyReportId", modules.canonical, "read-only safety report"
);

for (const artifact of [bundle, capacityPlan, report, interruption, deterministic, providerRequery, safety]) {
  requireAuthorityNone(artifact.authority, "certification artifact authority");
}

const repositoryRoot = path.resolve(args["repository-root"]);
const storage = createHistoricalDatasetNodeStorage({ root: repositoryRoot });
if (!report.identities?.datasetId) throw new Error("BT1.6 qualification report has no completed dataset identity.");
const repository = new modules.repository.HistoricalDatasetRepository({ storage: storage.adapter });
const verification = await repository.verifyDataset(report.identities.datasetId);
if (verification.status !== "verified" || !verification.manifest) {
  throw new Error(`BT1.6 repository verification failed: ${verification.blockers.join(", ")}`);
}
const manifest = verification.manifest;
const manifestHash = await modules.canonical.canonicalHash(manifest);
const lineage = await modules.lineage.buildHistoricalDatasetLineageNode(manifest);

const bindingBlockers = [
  ...(bundle.bundleId !== report.bundleId ? ["historical_certificate_bundle_report_mismatch"] : []),
  ...(bundle.requestId !== report.requestId ? ["historical_certificate_request_report_mismatch"] : []),
  ...(capacityPlan.capacityPlanId !== report.capacityPlanId ? ["historical_certificate_capacity_report_mismatch"] : []),
  ...(capacityPlan.status !== "within_bounds" || capacityPlan.blockers?.length ? ["historical_certificate_capacity_blocked"] : []),
  ...(report.identities.manifestHash !== manifestHash ? ["historical_certificate_manifest_report_mismatch"] : []),
  ...(report.identities.lineageNodeKey !== lineage.lineageNodeKey ? ["historical_certificate_lineage_report_mismatch"] : []),
  ...(report.identities.requestId !== manifest.requestId ? ["historical_certificate_manifest_request_mismatch"] : []),
  ...(report.identities.datasetChecksum !== manifest.datasetChecksum ? ["historical_certificate_manifest_checksum_mismatch"] : []),
  ...(interruption.action !== "controlled_interruption" ? ["historical_certificate_controlled_interruption_missing"] : []),
  ...(interruption.requestId !== report.requestId ? ["historical_certificate_interruption_request_mismatch"] : []),
  ...(safety.qualificationReportId !== report.reportId ? ["historical_certificate_safety_report_mismatch"] : []),
  ...(safety.status !== "passed" ? ["historical_certificate_safety_report_blocked"] : [])
].sort();

const evidence = Object.freeze({
  qualificationReportId: report.reportId,
  qualificationReportAction: report.action,
  qualificationVerificationStatus: report.verificationStatus,
  qualificationBlockers: Object.freeze([...(report.blockers ?? []), ...bindingBlockers].sort()),
  bundleId: bundle.bundleId,
  capacityPlanId: capacityPlan.capacityPlanId,
  evidencePackageId: bundle.evidencePackage.evidencePackageId,
  controlledInterruptionReportId: interruption.reportId,
  deterministicRematerialization: deterministic,
  providerRequery,
  readOnlySafetyReportId: safety.safetyReportId,
  readOnlySafetyVerified: safety.status === "passed",
  loopbackOnly: safety.loopbackOnly === true,
  getOnly: safety.getOnly === true,
  forbiddenEndpointCallCount: Number(safety.forbiddenEndpointCallCount),
  storageBytes: Number(report.storageBytes),
  peakMemoryBytes: Number(report.peakRssBytes),
  retrievalDurationMs: Number(report.elapsedMs),
  normalizationDurationMs: Number(safety.performance?.normalizationDurationMs ?? 0),
  integrityDurationMs: Number(safety.performance?.integrityDurationMs ?? 0),
  derivationDurationMs: Number(safety.performance?.derivationDurationMs ?? 0),
  reproductionDurationMs: Number(safety.performance?.reproductionDurationMs ?? 0),
  createdAtUtc: report.completedAtUtc,
  verifiedAtUtc: safety.verifiedAtUtc,
  verifierVersion: safety.verifierVersion
});
const input = Object.freeze({ manifest, manifestHash, lineageRoot: lineage.lineageNodeKey, evidence });
const blockers = modules.certificate.evaluateHistoricalDatasetCertification(input);
const assessmentCore = Object.freeze({
  schemaVersion: "gotrader-bt1-6-certification-assessment-v1",
  datasetId: manifest.datasetId,
  qualificationReportId: report.reportId,
  status: blockers.length ? "blocked" : "passed",
  blockers,
  authority: authorityNone
});
const assessment = Object.freeze({
  ...assessmentCore,
  assessmentId: await modules.canonical.canonicalHash(assessmentCore)
});
const assessmentPath = writeBt16JsonAtomic(
  path.join(bt16RuntimeRoot(), "assessments", `${assessment.assessmentId.replace(":", "_")}.json`),
  assessment
);
if (blockers.length) {
  console.log(JSON.stringify({ ...assessment, assessmentPath }, null, 2));
  process.exitCode = 2;
} else {
  const certificate = await modules.certificate.buildHistoricalDatasetCertificate(input);
  const output = args.output
    ? path.resolve(args.output)
    : path.join(bt16RuntimeRoot(), "certificates", `${certificate.certificateId.replace(":", "_")}.json`);
  const certificatePath = writeBt16JsonAtomic(output, certificate);
  console.log(JSON.stringify({
    status: "passed",
    certificateId: certificate.certificateId,
    datasetId: certificate.datasetId,
    datasetChecksum: certificate.datasetChecksum,
    assessmentId: assessment.assessmentId,
    assessmentPath,
    certificatePath,
    authority: certificate.authority
  }, null, 2));
}
