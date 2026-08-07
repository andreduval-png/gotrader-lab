#!/usr/bin/env node

import path from "node:path";
import {
  loadBt15Modules,
  parseArguments
} from "./support/bt1-5-qualification-runtime.mjs";
import {
  bt16RuntimeRoot,
  readBt16Json,
  verifyHashedArtifact,
  writeBt16JsonAtomic
} from "./support/bt1-6-certification-runtime.mjs";

const args = parseArguments(process.argv.slice(2));
if (!args.certificate) {
  throw new Error("Usage: update-bt1-6-dataset-registry --certificate <certificate.json> [--registry <registry.json>] [--output <registry.json>]");
}
const modules = await loadBt15Modules("bt1-6-registry");
const certificate = readBt16Json(args.certificate);
const certificateBlockers = await modules.certificate.validateHistoricalDatasetCertificate(certificate);
if (certificateBlockers.length) {
  throw new Error(`BT1.6 registry rejected certificate: ${certificateBlockers.join(", ")}`);
}
const existing = args.registry
  ? await verifyHashedArtifact(
    readBt16Json(args.registry), "registryId", modules.canonical, "dataset registry"
  )
  : undefined;
if (existing && existing.schemaVersion !== modules.certificate.HISTORICAL_DATASET_REGISTRY_SCHEMA_VERSION) {
  throw new Error("BT1.6 existing registry schema is unsupported.");
}
const entries = [...(existing?.entries ?? [])];
const entry = await modules.certificate.buildHistoricalDatasetRegistryEntry(certificate, "qualified");
if (!entries.some((item) => item.registryEntryId === entry.registryEntryId)) entries.push(entry);
const registry = await modules.certificate.buildHistoricalDatasetRegistry(entries);
const output = args.output
  ? path.resolve(args.output)
  : path.join(bt16RuntimeRoot(), "registry", `${registry.registryId.replace(":", "_")}.json`);
const registryPath = writeBt16JsonAtomic(output, registry);
console.log(JSON.stringify({
  status: "passed",
  registryId: registry.registryId,
  entryCount: registry.entries.length,
  certificateId: certificate.certificateId,
  registryPath,
  authority: registry.authority
}, null, 2));
