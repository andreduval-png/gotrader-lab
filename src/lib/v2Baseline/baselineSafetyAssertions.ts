import type { BaselineAuthority } from "./baselineTypes";

export const BASELINE_AUTHORITY_NONE: BaselineAuthority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const forbiddenKeyPattern = /^(?:rawCandles?|candles|rawRuntimeSnapshot|rawSnapshot|screenshots?|base64|password|secret|apiKey|token|mt5Credentials|account(?:Data|Number|Id)?|orders?|orderData|positions?|positionData)$/i;

const mutationLanguagePattern = /\b(?:place\s+order|buy\s+market|sell\s+market|enable\s+live\s+trading|connect\s+live\s+broker|close\s+position|modify\s+order|cancel\s+order)\b/i;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const inspect = (
  value: unknown,
  path: string,
  issues: string[],
  seen: WeakSet<object>
) => {
  if (typeof value === "string" && mutationLanguagePattern.test(value)) {
    issues.push(`${path || "payload"} contains execution mutation language.`);
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => inspect(item, `${path}[${index}]`, issues, seen));
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    const nextPath = path ? `${path}.${key}` : key;
    if (forbiddenKeyPattern.test(key)) {
      issues.push(`${nextPath} is forbidden in compact baseline artifacts.`);
      continue;
    }
    if (
      key === "executionAuthority" && nested !== "none" ||
      key === "brokerAuthority" && nested !== "none" ||
      key === "readinessOverrideAuthority" && nested !== "none"
    ) {
      issues.push(`${nextPath} must equal none.`);
    }
    if (key === "autoApplyAllowed" && nested !== false) {
      issues.push(`${nextPath} must be false.`);
    }
    inspect(nested, nextPath, issues, seen);
  }
};

export const auditCompactBaselineArtifact = (value: unknown) => {
  const issues: string[] = [];
  inspect(value, "", issues, new WeakSet<object>());
  return { safe: issues.length === 0, issues };
};

export const assertBaselineAuthorityNone = (value: unknown, label = "baseline artifact") => {
  if (!isObject(value) || !isObject(value.authority)) {
    throw new Error(`${label} is missing its authority object.`);
  }
  const authority = value.authority;
  if (
    authority.executionAuthority !== "none" ||
    authority.brokerAuthority !== "none" ||
    authority.readinessOverrideAuthority !== "none"
  ) {
    throw new Error(`${label} deviates from authority none/none/none.`);
  }
};

export const assertCompactBaselineArtifact = (value: unknown, label = "baseline artifact") => {
  const audit = auditCompactBaselineArtifact(value);
  if (!audit.safe) {
    throw new Error(`${label} failed compact safety checks: ${audit.issues.join(" ")}`);
  }
  assertBaselineAuthorityNone(value, label);
};
