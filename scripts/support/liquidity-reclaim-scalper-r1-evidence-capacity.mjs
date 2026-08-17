import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

export const R1_EVIDENCE_ARCHIVE_SCHEMA_VERSION = "gotrader-lrs-r1-evidence-archive-v2";
export const R1_LEGACY_EVIDENCE_ARCHIVE_SCHEMA_VERSION = "gotrader-lrs-r1-evidence-archive-v1";
const R1_EVIDENCE_BUNDLE_SCHEMA_VERSION = "gotrader-lrs-r1-evidence-bundle-v1";

const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const toRelative = (root, file) => path.relative(root, file).split(path.sep).join("/");

const listJsonFiles = (root) => {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) return listJsonFiles(file);
    return entry.isFile() && entry.name.endsWith(".json") ? [file] : [];
  });
};

const manifestPathFor = (archiveId) => `archives/manifests/${archiveId.replace("sha256:", "")}.json`;
export const r1EvidenceBundlePathFor = (archiveId) => `archives/bundles/${archiveId.replace("sha256:", "")}.json.gz`;

const assertArchivePath = (relativePath, trialDirectory, telemetryIdSet) => {
  const trialPrefix = `trials/${trialDirectory}/`;
  if (relativePath.startsWith(trialPrefix) && relativePath !== `${trialPrefix}baseline-report.json`) return;
  const telemetryMatch = /^telemetry\/child-\d{6}-([a-f0-9]{64})\.json$/.exec(relativePath);
  if (telemetryMatch && telemetryIdSet.has(`sha256:${telemetryMatch[1]}`)) return;
  throw new Error(`R1 evidence archive path is outside the authorized terminal evidence set: ${relativePath}`);
};

const readManifest = async ({ storage, archiveId }) => {
  const text = await storage.adapter.readText(manifestPathFor(archiveId));
  if (!text) throw new Error(`R1 evidence archive manifest is missing: ${archiveId}`);
  return JSON.parse(text);
};

export async function prepareR1CompletedTrialEvidenceArchive({ modules, storage, outputRoot, trial, orderedChildTelemetryIds }) {
  const trialDirectory = trial.trialId.replace("sha256:", "sha256_");
  const trialRoot = path.join(outputRoot, "trials", trialDirectory);
  const telemetryIdSet = new Set();
  const telemetryFiles = listJsonFiles(path.join(outputRoot, "telemetry")).filter((file) => {
    const telemetry = JSON.parse(fs.readFileSync(file, "utf8"));
    if (telemetry.trialId !== trial.trialId) return false;
    if (!orderedChildTelemetryIds.includes(telemetry.telemetryId)) {
      throw new Error(`R1 terminal telemetry is not bound to the controller: ${telemetry.telemetryId}`);
    }
    telemetryIdSet.add(telemetry.telemetryId);
    return true;
  });
  const files = [...listJsonFiles(trialRoot).filter((file) => path.basename(file) !== "baseline-report.json"), ...telemetryFiles]
    .sort((left, right) => toRelative(outputRoot, left).localeCompare(toRelative(outputRoot, right)));
  if (!files.length) throw new Error(`R1 completed trial has no terminal evidence to archive: ${trial.trialId}`);

  const entries = [];
  const bundledEntries = [];
  for (const file of files) {
    const relativePath = toRelative(outputRoot, file);
    assertArchivePath(relativePath, trialDirectory, telemetryIdSet);
    const original = fs.readFileSync(file);
    const text = original.toString("utf8");
    if (text.includes('"candles":[')) throw new Error(`R1 archive refused raw candle evidence: ${relativePath}`);
    entries.push(Object.freeze({
      relativePath,
      originalSha256: sha256(original),
      originalBytes: original.length
    }));
    bundledEntries.push(Object.freeze({ relativePath, text }));
  }

  const bundleCore = Object.freeze({ schemaVersion: R1_EVIDENCE_BUNDLE_SCHEMA_VERSION, entries: Object.freeze(bundledEntries) });
  const bundle = gzipSync(Buffer.from(`${modules.canonical.canonicalSerialize(bundleCore)}\n`, "utf8"), { level: 9, mtime: 0 });
  const core = Object.freeze({
    schemaVersion: R1_EVIDENCE_ARCHIVE_SCHEMA_VERSION,
    trialId: trial.trialId,
    trialOrdinal: trial.ordinal,
    parameterHash: trial.parameterHash,
    entryCount: entries.length,
    originalBytes: entries.reduce((sum, entry) => sum + entry.originalBytes, 0),
    compressedBytes: bundle.length,
    bundleSha256: sha256(bundle),
    entries: Object.freeze(entries),
    authority: Object.freeze({ executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" }),
    rawCandlesSerialized: false,
    holdoutUsed: false,
    adaptiveSearchUsed: false
  });
  const manifest = Object.freeze({ ...core, archiveId: await modules.canonical.canonicalHash(core) });
  const bundlePath = r1EvidenceBundlePathFor(manifest.archiveId);
  const existingBundle = await storage.adapter.readBuffer(bundlePath);
  if (existingBundle && !existingBundle.equals(bundle)) throw new Error(`R1 evidence bundle conflict: ${bundlePath}`);
  if (!existingBundle) await storage.adapter.writeBufferAtomic(bundlePath, bundle);
  const manifestPath = manifestPathFor(manifest.archiveId);
  const serialized = `${modules.canonical.canonicalSerialize(manifest)}\n`;
  const existingManifest = await storage.adapter.readText(manifestPath);
  if (existingManifest !== undefined && existingManifest !== serialized) throw new Error(`R1 evidence archive manifest conflict: ${manifest.archiveId}`);
  if (existingManifest === undefined) await storage.adapter.writeTextAtomic(manifestPath, serialized);
  return manifest;
}

const verifyManifestCore = async ({ modules, manifest, archiveId, expectedTrialId }) => {
  const { archiveId: storedId, ...core } = manifest;
  if (storedId !== archiveId || ![R1_EVIDENCE_ARCHIVE_SCHEMA_VERSION, R1_LEGACY_EVIDENCE_ARCHIVE_SCHEMA_VERSION].includes(manifest.schemaVersion) ||
      manifest.trialId !== expectedTrialId || manifest.entryCount !== manifest.entries?.length || manifest.rawCandlesSerialized !== false ||
      manifest.holdoutUsed !== false || manifest.adaptiveSearchUsed !== false || manifest.authority?.executionAuthority !== "none" ||
      await modules.canonical.canonicalHash(core) !== storedId) throw new Error(`R1 evidence archive manifest integrity failure: ${archiveId}`);
};

const verifyLegacyArchive = async ({ storage, manifest, expectedTrialId }) => {
  const trialDirectory = expectedTrialId.replace("sha256:", "sha256_");
  const relativePaths = new Set();
  const compressedPaths = new Set();
  let originalBytes = 0;
  let compressedBytes = 0;
  for (const entry of manifest.entries) {
    const isTrialEvidence = entry.relativePath.startsWith(`trials/${trialDirectory}/`) &&
      entry.relativePath !== `trials/${trialDirectory}/baseline-report.json`;
    const telemetryMatch = /^telemetry\/child-\d{6}-([a-f0-9]{64})\.json$/.exec(entry.relativePath);
    if ((!isTrialEvidence && !telemetryMatch) || entry.compressedPath !== `${entry.relativePath}.gz` ||
        relativePaths.has(entry.relativePath) || compressedPaths.has(entry.compressedPath)) {
      throw new Error(`R1 evidence archive path integrity failure: ${entry.relativePath}`);
    }
    relativePaths.add(entry.relativePath);
    compressedPaths.add(entry.compressedPath);
    const compressed = await storage.adapter.readBuffer(entry.compressedPath);
    if (!compressed || sha256(compressed) !== entry.compressedSha256 || compressed.length !== entry.compressedBytes) {
      throw new Error(`R1 compressed evidence integrity failure: ${entry.compressedPath}`);
    }
    const original = gunzipSync(compressed);
    if (sha256(original) !== entry.originalSha256 || original.length !== entry.originalBytes) {
      throw new Error(`R1 evidence roundtrip integrity failure: ${entry.relativePath}`);
    }
    if (telemetryMatch) {
      const telemetry = JSON.parse(original.toString("utf8"));
      if (telemetry.trialId !== expectedTrialId || telemetry.telemetryId !== `sha256:${telemetryMatch[1]}`) {
        throw new Error(`R1 archived telemetry scope failure: ${entry.relativePath}`);
      }
    }
    if (original.toString("utf8").includes('"candles":[')) throw new Error(`R1 archive contains raw candle evidence: ${entry.relativePath}`);
    const readable = await storage.adapter.readText(entry.relativePath);
    if (readable === undefined || !Buffer.from(readable, "utf8").equals(original)) {
      throw new Error(`R1 evidence read-through mismatch: ${entry.relativePath}`);
    }
    originalBytes += original.length;
    compressedBytes += compressed.length;
  }
  if (originalBytes !== manifest.originalBytes || compressedBytes !== manifest.compressedBytes) {
    throw new Error(`R1 evidence archive byte accounting failure: ${manifest.archiveId}`);
  }
  return manifest;
};

export async function verifyR1EvidenceArchive({ modules, storage, archiveId, expectedTrialId }) {
  const manifest = await readManifest({ storage, archiveId });
  await verifyManifestCore({ modules, manifest, archiveId, expectedTrialId });
  if (manifest.schemaVersion === R1_LEGACY_EVIDENCE_ARCHIVE_SCHEMA_VERSION) {
    return verifyLegacyArchive({ storage, manifest, expectedTrialId });
  }
  const bundlePath = r1EvidenceBundlePathFor(archiveId);
  const bundle = await storage.adapter.readBuffer(bundlePath);
  if (!bundle || bundle.length !== manifest.compressedBytes || sha256(bundle) !== manifest.bundleSha256) {
    throw new Error(`R1 evidence bundle integrity failure: ${bundlePath}`);
  }
  let payload;
  try {
    payload = JSON.parse(gunzipSync(bundle).toString("utf8"));
  } catch {
    throw new Error(`R1 evidence bundle roundtrip failure: ${bundlePath}`);
  }
  if (payload.schemaVersion !== R1_EVIDENCE_BUNDLE_SCHEMA_VERSION || payload.entries?.length !== manifest.entryCount) {
    throw new Error(`R1 evidence bundle schema failure: ${bundlePath}`);
  }
  const trialDirectory = expectedTrialId.replace("sha256:", "sha256_");
  const metadataByPath = new Map(manifest.entries.map((entry) => [entry.relativePath, entry]));
  if (metadataByPath.size !== manifest.entryCount) throw new Error(`R1 evidence archive path integrity failure: ${archiveId}`);
  let originalBytes = 0;
  const seen = new Set();
  for (const bundled of payload.entries) {
    const entry = metadataByPath.get(bundled.relativePath);
    const isTrialEvidence = bundled.relativePath.startsWith(`trials/${trialDirectory}/`) &&
      bundled.relativePath !== `trials/${trialDirectory}/baseline-report.json`;
    const telemetryMatch = /^telemetry\/child-\d{6}-([a-f0-9]{64})\.json$/.exec(bundled.relativePath);
    if (!entry || (!isTrialEvidence && !telemetryMatch) || seen.has(bundled.relativePath) || typeof bundled.text !== "string") {
      throw new Error(`R1 evidence archive path integrity failure: ${bundled.relativePath}`);
    }
    seen.add(bundled.relativePath);
    const original = Buffer.from(bundled.text, "utf8");
    if (original.length !== entry.originalBytes || sha256(original) !== entry.originalSha256 || bundled.text.includes('"candles":[')) {
      throw new Error(`R1 evidence roundtrip integrity failure: ${bundled.relativePath}`);
    }
    if (telemetryMatch) {
      const telemetry = JSON.parse(bundled.text);
      if (telemetry.trialId !== expectedTrialId || telemetry.telemetryId !== `sha256:${telemetryMatch[1]}`) {
        throw new Error(`R1 archived telemetry scope failure: ${bundled.relativePath}`);
      }
    }
    if (telemetryMatch) storage.adapter.mountReadText(bundled.relativePath, bundled.text);
    originalBytes += original.length;
  }
  if (seen.size !== manifest.entryCount || originalBytes !== manifest.originalBytes) {
    throw new Error(`R1 evidence archive byte accounting failure: ${archiveId}`);
  }
  return manifest;
}

export async function finalizeR1EvidenceArchive({ storage, manifest }) {
  for (const entry of manifest.entries) await storage.adapter.removeFile(entry.relativePath);
}

export async function verifyAndFinalizeCommittedR1EvidenceArchives({ modules, storage, checkpoint }) {
  const manifests = [];
  for (const disposition of checkpoint.dispositions.filter((item) => ["completed", "rejected"].includes(item.disposition))) {
    if (!disposition.evidenceArchiveId) throw new Error(`R1 terminal disposition is missing evidence archive identity: ${disposition.trialId}`);
    const manifest = await verifyR1EvidenceArchive({ modules, storage, archiveId: disposition.evidenceArchiveId,
      expectedTrialId: disposition.trialId });
    await finalizeR1EvidenceArchive({ storage, manifest });
    manifests.push(manifest);
  }
  return Object.freeze(manifests);
}
