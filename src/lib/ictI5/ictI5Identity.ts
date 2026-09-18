export const stableIctI5Id = (namespace: string, values: readonly string[]) => {
  let hash = 2166136261;
  for (const char of `${namespace}|${values.join("|")}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${namespace}:fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

export const validIctI5Timestamp = (timestamp: string, label: string) => {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) throw new Error(`I5 requires a valid ${label} timestamp.`);
  return parsed;
};
