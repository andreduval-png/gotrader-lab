import assert from "node:assert/strict";
import { verifyAllPartitions, canonicalHash, createCanonicalTimeframeHasher } from "./lib/bt-g1-3-certified-dataset.mjs";

// The forbidden fast path must fail before inspecting files or trusting metadata.
const forbidden = new Proxy({}, {
  get() { throw new Error("Dataset accessed before checksum-policy rejection"); }
});
assert.throws(
  () => verifyAllPartitions(forbidden, { verifyChecksums: false }),
  /BT_G1_3_CHECKSUM_VERIFICATION_REQUIRED/
);
console.log("PASS: certified partition verification cannot bypass content checksums");
const candles = [{ open: 100, close: 101 }, { open: 101, close: 99 }];
const metadata = { normalizationVersion: "synthetic-v1", timeframe: "5m" };
const hasher = createCanonicalTimeframeHasher(metadata);
hasher.update(candles.slice(0, 1));
hasher.update(candles.slice(1));
const result = hasher.digest();
assert.equal(result.timeframeChecksum, canonicalHash({ ...metadata, candles }));
assert.equal(result.candleCount, 2);
assert.notEqual(result.timeframeChecksum, canonicalHash({
  ...metadata, candles: [{ open: 100, close: 102 }, candles[1]]
}));
assert.throws(() => hasher.update(candles), /ALREADY_FINALIZED/);
console.log("PASS: streamed checksum matches canonical content and detects candle changes");
