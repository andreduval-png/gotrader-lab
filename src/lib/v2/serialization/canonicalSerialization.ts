export const V2_CANONICAL_HASH_VERSION = "gotrader-v2-sha256-v1";

const pathKeyPattern = /(?:path|directory|workspace|file)$/i;

const normalizeString = (value: string, key?: string) => {
  const lineNormalized = value.replace(/\r\n?/g, "\n");
  return key && pathKeyPattern.test(key) ? lineNormalized.replace(/\\/g, "/") : lineNormalized;
};

const canonicalize = (value: unknown, seen: WeakSet<object>, key?: string): unknown => {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return typeof value === "string" ? normalizeString(value, key) : value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical serialization rejects non-finite numbers.");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (
    value === undefined ||
    typeof value === "function" ||
    typeof value === "symbol" ||
    typeof value === "bigint"
  ) {
    throw new TypeError(`Canonical serialization rejects ${typeof value} values.`);
  }
  if (typeof value !== "object") {
    throw new TypeError("Canonical serialization received an unsupported value.");
  }
  if (seen.has(value)) {
    throw new TypeError("Canonical serialization rejects cyclic references.");
  }
  if (value instanceof Date) {
    throw new TypeError("Canonical serialization requires explicit ISO timestamp strings, not Date objects.");
  }
  if (Object.getOwnPropertySymbols(value).length) {
    throw new TypeError("Canonical serialization rejects symbol-keyed properties.");
  }

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => canonicalize(item, seen));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Canonical serialization accepts only plain objects and arrays.");
    }
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort((left, right) => left.localeCompare(right))
        .map((nestedKey) => [
          nestedKey,
          canonicalize((value as Record<string, unknown>)[nestedKey], seen, nestedKey)
        ])
    );
  } finally {
    seen.delete(value);
  }
};

export function canonicalSerialize(value: unknown) {
  return JSON.stringify(canonicalize(value, new WeakSet<object>()));
}

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export async function canonicalHash(value: unknown, version = V2_CANONICAL_HASH_VERSION) {
  if (version !== V2_CANONICAL_HASH_VERSION) {
    throw new Error(`Unsupported V2 canonical hash version: ${version}`);
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto SHA-256 is unavailable in this runtime.");
  }
  const payload = `${version}\n${canonicalSerialize(value)}`;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return `sha256:${bytesToHex(new Uint8Array(digest))}`;
}
