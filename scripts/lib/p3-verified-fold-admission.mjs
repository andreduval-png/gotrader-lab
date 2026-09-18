import {
  canonicalHash, loadCertifiedTimeframe, verifyAllPartitions, verifyCertificateAndManifest
} from "./bt-g1-3-certified-dataset.mjs";

const admissions = new WeakMap();
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

// No serialized receipt or caller-provided flag can grant an admission.
export const loadVerifiedFoldAdmission = ({ location, requests }) => {
  if (!Array.isArray(requests) || !requests.length ||
    new Set(requests.map((request) => request.timeframe)).size !== requests.length) {
    throw new Error("P3_INVALID_SLICE_REQUESTS");
  }
  for (const request of requests) {
    const start = Date.parse(request.startUtc);
    const end = Date.parse(request.endUtc);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end ||
      !Number.isFinite(request.warmupDays ?? 0) || (request.warmupDays ?? 0) < 0) {
      throw new Error("P3_INVALID_SLICE_RANGE");
    }
  }
  const verified = verifyCertificateAndManifest(location);
  const partitions = verifyAllPartitions(verified, { collectGarbage: true });
  const candlesByTimeframe = Object.fromEntries(requests.map((request) => [
    request.timeframe,
    // Re-read and recheck partition IDs; do not trust a cached index for skipping.
    loadCertifiedTimeframe({ ...request, verified })
  ]));
  Object.values(candlesByTimeframe).forEach((candles) => candles.forEach(freeze));
  freeze(candlesByTimeframe);
  const dataset = freeze({
    datasetId: verified.manifest.datasetId,
    datasetCertificateId: verified.certificate.certificateId,
    datasetChecksum: partitions.datasetChecksum,
    sourceFingerprint: verified.manifest.sourceFingerprint
  });
  const receipt = freeze({
    schemaVersion: "gotrader.verified-fold-admission.v1",
    dataset, manifestHash: partitions.manifestHash,
    slices: requests.map((request) => ({
      ...request, candleCount: candlesByTimeframe[request.timeframe].length,
      contentHash: canonicalHash(candlesByTimeframe[request.timeframe])
    })),
    authority: "none/none/none"
  });
  const admission = Object.freeze({ candlesByTimeframe, dataset, receipt });
  admissions.set(admission, canonicalHash(receipt));
  return admission;
};

export const runVerifiedHistoricalFold = (admission, runner, input) => {
  const admissionHash = admissions.get(admission);
  if (!admissionHash) throw new Error("P3_VERIFIED_ADMISSION_REQUIRED");
  const candlesByTimeframe = {};
  for (const timeframe of new Set([...input.adapter.requiredTimeframes, input.primaryTimeframe])) {
    const candles = admission.candlesByTimeframe[timeframe];
    if (!candles?.length) throw new Error("P3_ADMITTED_TIMEFRAME_MISSING");
    candlesByTimeframe[timeframe] = candles;
  }
  const rawResult = runner({ ...input, dataset: admission.dataset, candlesByTimeframe });
  if (rawResult?.then) throw new Error("P3_SYNCHRONOUS_RUNNER_REQUIRED");
  // Bind the persisted representation, omitting optional undefined properties.
  const result = JSON.parse(JSON.stringify(rawResult, (_key, value) => {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("P3_NONFINITE_RESULT");
    return value;
  }));
  const binding = {
    schemaVersion: "gotrader.verified-fold-result-binding.v1",
    admissionHash, resultContentHash: canonicalHash(result),
    resultIdentityHash: result.resultIdentityHash, foldIdentityHash: result.foldIdentityHash,
    dataset: admission.dataset, slices: admission.receipt.slices,
    authority: "none/none/none"
  };
  return { result, provenance: { ...binding, bindingHash: canonicalHash(binding) } };
};
