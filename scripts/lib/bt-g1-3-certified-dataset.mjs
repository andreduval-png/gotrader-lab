import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { evaluateCapacityPreflight } from "./p4-capacity-preflight.mjs";

export const BT_G1_3_IDENTITY = Object.freeze({
  certificateId: "sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193",
  datasetId: "sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d",
  datasetChecksum: "sha256:4e51534035ca982a217ba64ec4438f7c2d7d7d19c7f0c1a0b6dff57b4539a0be",
  manifestHash: "sha256:4e318ea660cba48330eba6442bcf2f679524d0fcede54b48d7c8b05d0b0b860d",
  sourceFingerprint: "sha256:e164236affb51072322ce78bf297c03b3c403243e206a685b917792ac6db07bd",
  bundleId: "sha256:4a0bb904e6e90c99249f876679ba4b41bc95cbad1cff229f1a68c36c00283d76",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  startUtc: "2024-08-01T00:00:00.000Z",
  endUtc: "2026-08-01T00:00:00.000Z"
});

const HASH_VERSION = "gotrader-v2-sha256-v1";
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const PATH_KEY_PATTERN = /(?:path|directory|workspace|file)$/i;
const AUTHORITY_NONE = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

const canonicalString = (value, key) => {
  const normalized = value.replace(/\r\n?/g, "\n");
  return key && PATH_KEY_PATTERN.test(key) ? normalized.replace(/\\/g, "/") : normalized;
};

const updateCanonicalHash = (hash, value, seen, key) => {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    hash.update(JSON.stringify(typeof value === "string" ? canonicalString(value, key) : value));
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical hash rejects non-finite numbers.");
    hash.update(JSON.stringify(Object.is(value, -0) ? 0 : value));
    return;
  }
  if (!value || typeof value !== "object" || Array.isArray(value) && seen.has(value) || seen.has(value)) {
    throw new TypeError("Canonical hash received an unsupported or cyclic value.");
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      hash.update("[");
      value.forEach((item, index) => {
        if (index) hash.update(",");
        updateCanonicalHash(hash, item, seen);
      });
      hash.update("]");
      return;
    }
    if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      throw new TypeError("Canonical hash accepts plain objects and arrays only.");
    }
    hash.update("{");
    Object.keys(value).sort((left, right) => left.localeCompare(right)).forEach((nestedKey, index) => {
      if (index) hash.update(",");
      hash.update(JSON.stringify(nestedKey));
      hash.update(":");
      updateCanonicalHash(hash, value[nestedKey], seen, nestedKey);
    });
    hash.update("}");
  } finally {
    seen.delete(value);
  }
};

export const canonicalHash = (value) => {
  const hash = createHash("sha256");
  hash.update(`${HASH_VERSION}\n`);
  updateCanonicalHash(hash, value, new WeakSet());
  return `sha256:${hash.digest("hex")}`;
};

export const createCanonicalTimeframeHasher = ({ normalizationVersion, timeframe }) => {
  const hash = createHash("sha256");
  hash.update(`${HASH_VERSION}\n`);
  hash.update(`{${JSON.stringify("candles")}:[`);
  let candleCount = 0;
  let finalized = false;
  const update = (batch) => {
    if (finalized) throw new Error("BT_G1_3_TIMEFRAME_HASH_ALREADY_FINALIZED");
    for (const candle of batch) {
      if (candleCount) hash.update(",");
      updateCanonicalHash(hash, candle, new WeakSet());
      candleCount += 1;
    }
  };
  const digest = () => {
    if (finalized) throw new Error("BT_G1_3_TIMEFRAME_HASH_ALREADY_FINALIZED");
    finalized = true;
    hash.update(`],${JSON.stringify("normalizationVersion")}:`);
    updateCanonicalHash(hash, normalizationVersion, new WeakSet(), "normalizationVersion");
    hash.update(`,${JSON.stringify("timeframe")}:`);
    updateCanonicalHash(hash, timeframe, new WeakSet(), "timeframe");
    hash.update("}");
    return Object.freeze({ timeframeChecksum: `sha256:${hash.digest("hex")}`, candleCount });
  };
  return Object.freeze({ update, digest });
};

export const canonicalHashTimeframeCandles = ({ normalizationVersion, timeframe, candleBatches }) => {
  const hasher = createCanonicalTimeframeHasher({ normalizationVersion, timeframe });
  for (const batch of candleBatches) hasher.update(batch);
  return hasher.digest();
};

const key = (identity) => identity.replace(":", "_");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const assertEqual = (actual, expected, label) => {
  if (actual !== expected) throw new Error(`BT_G1_3_${label}_MISMATCH: ${actual ?? "missing"}`);
};
const assertAuthority = (authority, label) => {
  for (const [field, expected] of Object.entries(AUTHORITY_NONE)) {
    assertEqual(authority?.[field], expected, `${label}_AUTHORITY_${field.toUpperCase()}`);
  }
};

const candidateDatasetRoots = (workspace) => {
  const explicit = process.env.BT_G1_3_DATASET_ROOT;
  const documents = path.dirname(workspace);
  const suffix = path.join(
    ".gotrader", "bt1-5", "datasets", key(BT_G1_3_IDENTITY.bundleId), "full"
  );
  return [
    explicit,
    path.join(documents, "gotrader-backtest-bt1-6", suffix),
    path.join(workspace, suffix)
  ].filter(Boolean).map((item) => path.resolve(item));
};

export const locateCertifiedDataset = (workspace = process.cwd()) => {
  const attempted = candidateDatasetRoots(workspace);
  for (const datasetRoot of attempted) {
    const repositoryRoot = path.basename(datasetRoot).toLowerCase() === "repository"
      ? datasetRoot
      : path.join(datasetRoot, "repository");
    const manifestPath = path.join(
      repositoryRoot, "manifests", `${key(BT_G1_3_IDENTITY.datasetId)}.json`
    );
    if (!fs.existsSync(manifestPath)) continue;
    const marker = `${path.sep}.gotrader${path.sep}`;
    const markerIndex = repositoryRoot.toLowerCase().indexOf(marker.toLowerCase());
    const ownerRoot = markerIndex >= 0 ? repositoryRoot.slice(0, markerIndex) : path.dirname(repositoryRoot);
    const certificatePath = process.env.BT_G1_3_CERTIFICATE_PATH || path.join(
      ownerRoot, ".gotrader", "bt1-6", "certificates", "bt1-6-v3-certificate.json"
    );
    return Object.freeze({
      classification: path.resolve(ownerRoot) === path.resolve(workspace)
        ? "DATA_EXISTS_NOT_MATERIALIZED"
        : "DATA_EXISTS_IN_OTHER_ISOLATED_ROOT",
      datasetRoot: path.basename(datasetRoot).toLowerCase() === "repository" ? path.dirname(datasetRoot) : datasetRoot,
      repositoryRoot,
      manifestPath,
      certificatePath: path.resolve(certificatePath),
      attempted
    });
  }
  const error = new Error("BT_G1_3_CERTIFIED_DATASET_NOT_FOUND");
  error.attempted = attempted;
  throw error;
};

export const readVerifiedEnvelope = (file, expectedKind) => {
  const envelope = readJson(file);
  assertEqual(envelope.artifactKind, expectedKind, "ARTIFACT_KIND");
  if (!HASH_PATTERN.test(envelope.integrityHash ?? "")) throw new Error("BT_G1_3_ENVELOPE_HASH_INVALID");
  assertEqual(canonicalHash(envelope.payload), envelope.integrityHash, "ENVELOPE_INTEGRITY");
  return envelope.payload;
};

export const verifyCertificateAndManifest = (location = locateCertifiedDataset()) => {
  if (!fs.existsSync(location.certificatePath)) throw new Error("BT_G1_3_CERTIFICATE_NOT_FOUND");
  const certificate = readJson(location.certificatePath);
  const manifest = readVerifiedEnvelope(location.manifestPath, "manifest");
  const manifestEnvelope = readJson(location.manifestPath);
  assertEqual(certificate.certificateId, BT_G1_3_IDENTITY.certificateId, "CERTIFICATE_ID");
  assertEqual(canonicalHash(Object.fromEntries(Object.entries(certificate).filter(([name]) => name !== "certificateId"))), certificate.certificateId, "CERTIFICATE_INTEGRITY");
  for (const field of ["datasetId", "datasetChecksum", "sourceFingerprint", "requestedSymbol", "brokerSymbol", "startUtc", "endUtc"]) {
    assertEqual(certificate[field], BT_G1_3_IDENTITY[field], `CERTIFICATE_${field.toUpperCase()}`);
    assertEqual(manifest[field], BT_G1_3_IDENTITY[field], `MANIFEST_${field.toUpperCase()}`);
  }
  assertEqual(certificate.manifestHash, BT_G1_3_IDENTITY.manifestHash, "CERTIFICATE_MANIFEST_HASH");
  assertEqual(manifestEnvelope.integrityHash, BT_G1_3_IDENTITY.manifestHash, "MANIFEST_HASH");
  assertEqual(canonicalHash(Object.fromEntries(Object.entries(manifest).filter(([name]) => name !== "datasetId"))), manifest.datasetId, "DATASET_ID");
  assertEqual(certificate.historicalTimeVerified, true, "HISTORICAL_TIME");
  assertEqual(certificate.historicalDstVerified, true, "HISTORICAL_DST");
  assertAuthority(certificate.authority, "CERTIFICATE");
  assertAuthority(manifest.authority, "MANIFEST");
  if (Object.values(certificate.capabilities ?? {}).some(Boolean) || Object.values(manifest.capabilities ?? {}).some(Boolean)) {
    throw new Error("BT_G1_3_CAPABILITY_ESCALATION");
  }
  return Object.freeze({ location, certificate, manifest });
};

const partitionPath = (repositoryRoot, partitionId) => path.join(
  repositoryRoot, "partitions", `${key(partitionId)}.json`
);

export const verifyAllPartitions = (verified = verifyCertificateAndManifest(), options = {}) => {
  if (options.verifyChecksums === false) {
    throw new Error("BT_G1_3_CHECKSUM_VERIFICATION_REQUIRED");
  }
  const { manifest } = verified;
  const summary = [];
  const checksumEntries = [];
  const partitionIndex = [];
  let totalBytes = 0;
  let totalCandles = 0;
  let duplicateCount = 0;
  let peakRssBytes = process.memoryUsage().rss;
  let peakHeapUsedBytes = process.memoryUsage().heapUsed;
  for (const entry of manifest.timeframes) {
    const timeframePartitions = [];
    for (const partitionId of entry.partitionIds) {
      const file = partitionPath(verified.location.repositoryRoot, partitionId);
      if (!fs.existsSync(file)) throw new Error(`BT_G1_3_PARTITION_MISSING: ${partitionId}`);
      const partitionBytes = fs.statSync(file).size;
      const payload = readVerifiedEnvelope(file, "partition");
      assertEqual(payload.partitionId, partitionId, "PARTITION_ID_REFERENCE");
      assertEqual(canonicalHash(Object.fromEntries(Object.entries(payload).filter(([name]) => name !== "partitionId"))), partitionId, "PARTITION_ID");
      assertEqual(payload.timeframe, entry.timeframe, "PARTITION_TIMEFRAME");
      if (!Array.isArray(payload.candles) || !payload.candles.length) throw new Error("BT_G1_3_PARTITION_CANDLES_INVALID");
      let localPrior = Number.NEGATIVE_INFINITY;
      for (const candle of payload.candles) {
        const timestampMs = Date.parse(candle.openTimeUtc);
        if (!Number.isFinite(timestampMs) || !Number.isFinite(Date.parse(candle.closeTimeUtc))) {
          throw new Error("BT_G1_3_PARTITION_TIME_INVALID");
        }
        if (![candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) || candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close) || candle.high < candle.low) {
          throw new Error("BT_G1_3_PARTITION_OHLC_INVALID");
        }
        if (timestampMs < localPrior) throw new Error(`BT_G1_3_PARTITION_ORDER_INVALID: ${entry.timeframe}:${candle.openTimeUtc}`);
        localPrior = timestampMs;
      }
      const indexed = {
        partitionId,
        timeframe: entry.timeframe,
        candleCount: payload.candles.length,
        firstCandleTimeUtc: payload.candles[0].openTimeUtc,
        lastCandleTimeUtc: payload.candles.at(-1).closeTimeUtc,
        bytes: partitionBytes
      };
      timeframePartitions.push(indexed);
      partitionIndex.push(indexed);
      totalBytes += partitionBytes;
      const memory = process.memoryUsage();
      peakRssBytes = Math.max(peakRssBytes, memory.rss);
      peakHeapUsedBytes = Math.max(peakHeapUsedBytes, memory.heapUsed);
    }
    timeframePartitions.sort((left, right) => Date.parse(left.firstCandleTimeUtc) - Date.parse(right.firstCandleTimeUtc) || left.partitionId.localeCompare(right.partitionId));
    let timeframeCount = 0;
    let firstCandleTimeUtc;
    let lastCandleTimeUtc;
    let priorTimestampMs = Number.NEGATIVE_INFINITY;
    let priorCandle;
    const timeframeHasher = createCanonicalTimeframeHasher({
      normalizationVersion: manifest.normalizationVersion, timeframe: entry.timeframe
    });
    for (const indexed of timeframePartitions) {
      const payload = readVerifiedEnvelope(partitionPath(verified.location.repositoryRoot, indexed.partitionId), "partition");
      for (const candle of payload.candles) {
        const timestamp = candle.openTimeUtc;
        const timestampMs = Date.parse(timestamp);
        if (timestampMs < priorTimestampMs) throw new Error(`BT_G1_3_PARTITION_ORDER_INVALID: ${entry.timeframe}:${timestamp}`);
        if (timestampMs === priorTimestampMs) {
          if (JSON.stringify(priorCandle) !== JSON.stringify(candle)) {
            throw new Error(`BT_G1_3_DUPLICATE_CONFLICT: ${entry.timeframe}:${timestamp}`);
          }
          duplicateCount += 1;
        }
        firstCandleTimeUtc ??= timestamp;
        lastCandleTimeUtc = candle.closeTimeUtc;
        priorTimestampMs = timestampMs;
        priorCandle = candle;
        timeframeCount += 1;
      }
      timeframeHasher.update(payload.candles);
      const memory = process.memoryUsage();
      peakRssBytes = Math.max(peakRssBytes, memory.rss);
      peakHeapUsedBytes = Math.max(peakHeapUsedBytes, memory.heapUsed);
    }
    assertEqual(timeframeCount, entry.candleCount, "TIMEFRAME_COUNT");
    assertEqual(firstCandleTimeUtc, entry.firstCandleTimeUtc, "TIMEFRAME_FIRST");
    assertEqual(lastCandleTimeUtc, entry.lastCandleTimeUtc, "TIMEFRAME_LAST");
    const streamed = timeframeHasher.digest();
    const timeframeChecksum = streamed.timeframeChecksum;
    assertEqual(timeframeChecksum, entry.timeframeChecksum, "TIMEFRAME_CHECKSUM");
    checksumEntries.push({ timeframe: entry.timeframe, timeframeChecksum, candleCount: timeframeCount });
    const ledgerPath = path.join(verified.location.repositoryRoot, "integrity", `${key(entry.integrityLedgerId)}.json`);
    const ledger = readVerifiedEnvelope(ledgerPath, "integrity");
    assertEqual(ledger.ledgerId, entry.integrityLedgerId, "INTEGRITY_LEDGER");
    summary.push({ timeframe: entry.timeframe, candleCount: timeframeCount, partitionCount: entry.partitionIds.length, timeframeChecksum });
    totalCandles += timeframeCount;
    if (options.collectGarbage === true && typeof global.gc === "function") global.gc();
  }
  const datasetChecksum = canonicalHash({ normalizationVersion: manifest.normalizationVersion, timeframes: checksumEntries });
  assertEqual(datasetChecksum, manifest.datasetChecksum, "DATASET_CHECKSUM");
  return Object.freeze({
    status: "verified",
    partitionCount: summary.reduce((sum, item) => sum + item.partitionCount, 0),
    verifiedCount: partitionIndex.length,
    failedCount: 0,
    totalCandles,
    totalBytes,
    duplicateCount,
    datasetChecksum,
    datasetId: manifest.datasetId,
    certificateId: verified.certificate.certificateId,
    manifestHash: BT_G1_3_IDENTITY.manifestHash,
    peakRssBytes,
    peakHeapUsedBytes,
    timeframes: summary,
    partitionIndex
  });
};

export const loadCertifiedTimeframe = ({ verified = verifyCertificateAndManifest(), timeframe, startUtc, endUtc, warmupDays = 0, partitionIndex }) => {
  const entry = verified.manifest.timeframes.find((item) => item.timeframe === timeframe);
  if (!entry) throw new Error(`DATASET_TIMEFRAME_COVERAGE_BLOCKED: ${timeframe}`);
  const startMs = Date.parse(startUtc) - warmupDays * 86_400_000;
  const endMs = Date.parse(endUtc);
  const candles = [];
  for (const partitionId of entry.partitionIds) {
    const indexed = partitionIndex?.find((item) => item.partitionId === partitionId);
    if (indexed && (Date.parse(indexed.lastCandleTimeUtc) <= startMs || Date.parse(indexed.firstCandleTimeUtc) >= endMs)) continue;
    const payload = readVerifiedEnvelope(partitionPath(verified.location.repositoryRoot, partitionId), "partition");
    assertEqual(payload.partitionId, partitionId, "LOAD_PARTITION_ID_REFERENCE");
    assertEqual(canonicalHash(Object.fromEntries(Object.entries(payload).filter(([name]) => name !== "partitionId"))), partitionId, "LOAD_PARTITION_ID");
    assertEqual(payload.timeframe, timeframe, "LOAD_PARTITION_TIMEFRAME");
    for (let index = 0; index < payload.candles.length; index += 1) {
      const candle = payload.candles[index];
      const timestampMs = Date.parse(candle.openTimeUtc);
      if (timestampMs < startMs || timestampMs >= endMs) continue;
      candles.push({
        id: `${BT_G1_3_IDENTITY.datasetId}|${timeframe}|${candle.openTimeUtc}`,
        symbol: "MNQ",
        timeframe,
        timestamp: candle.openTimeUtc,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        ...(Number.isFinite(candle.volume) ? { volume: candle.volume } : {})
      });
    }
  }
  return Object.freeze(candles.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)));
};

export const measureCapacity = (verified = verifyCertificateAndManifest()) => {
  const repositoryFiles = fs.readdirSync(verified.location.repositoryRoot, { recursive: true, withFileTypes: true });
  let bytes = 0;
  let files = 0;
  for (const entry of repositoryFiles) {
    if (!entry.isFile()) continue;
    const file = path.join(entry.parentPath ?? entry.path, entry.name);
    bytes += fs.statSync(file).size;
    files += 1;
  }
  const freeMemoryBytes = os.freemem();
  const disk = fs.statfsSync(verified.location.repositoryRoot);
  const freeDiskBytes = disk.bavail * disk.bsize;
  const preflight = evaluateCapacityPreflight({ freeMemoryBytes, freeDiskBytes });
  return Object.freeze({
    repositoryBytes: bytes,
    repositoryFiles: files,
    partitionCount: verified.manifest.timeframes.reduce((sum, item) => sum + item.partitionIds.length, 0),
    candleCounts: Object.fromEntries(verified.manifest.timeframes.map((item) => [item.timeframe, item.candleCount])),
    freeMemoryBytes,
    freeDiskBytes,
    safeWorkerCount: preflight.safeWorkerCount,
    preflight,
    estimatedPeakWorkerBytes: 768 * 1024 ** 2,
    estimatedCompactOutputBytes: 8 * 1024 ** 2
  });
};
