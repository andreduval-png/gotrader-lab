import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export async function loadIctI5() {
  const root = process.cwd();
  const out = path.join(root, ".gotrader", `ict-i5-test-runtime-${process.pid}`);
  fs.rmSync(out, { recursive: true, force: true });
  for (const directory of ["ictCanonical", "sessions", "ictI5"]) {
    const sourceDirectory = path.join(root, "src", "lib", directory);
    const outputDirectory = path.join(out, directory);
    fs.mkdirSync(outputDirectory, { recursive: true });
    for (const name of fs.readdirSync(sourceDirectory).filter((file) => file.endsWith(".ts"))) {
      const source = fs.readFileSync(path.join(sourceDirectory, name), "utf8");
      const output = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022, importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove },
        fileName: name
      }).outputText
        .replace(/from\s+"@\/lib\/ictCanonical\/([^"]+)"/g, 'from "../ictCanonical/$1.mjs"')
        .replace(/from\s+"@\/lib\/sessions\/([^"]+)"/g, 'from "../sessions/$1.mjs"')
        .replace(/from\s+"@\/lib\/sessions"/g, 'from "../sessions/index.mjs"')
        .replace(/from\s+"@\/lib\/ictI5\/([^"]+)"/g, 'from "../ictI5/$1.mjs"');
      fs.writeFileSync(path.join(outputDirectory, name.replace(/\.ts$/, ".mjs")), output, "utf8");
    }
  }
  return import(`${pathToFileURL(path.join(out, "ictI5", "index.mjs")).href}?v=${Date.now()}`);
}

export const authority = {
  executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none",
  productionAdoptionAllowed: false, canCreateEvidence: false, canApproveReadiness: false,
  canApplyCalibration: false, canCreateTradeIntent: false
};

export const at = (minute) => new Date(Date.UTC(2026, 7, 17, 13, minute)).toISOString();

export const gap = (gapType = "NDOG", orientation = "GAP_UP", validFrom = at(0), id = `${gapType.toLowerCase()}-1`) => {
  const priorReferencePrice = 100;
  const newOpenPrice = orientation === "GAP_UP" ? 110 : orientation === "GAP_DOWN" ? 90 : 100;
  return {
    factId: id, factType: "OPENING_GAP", gapId: id, gapType, symbol: "NQ", timeframe: "5m",
    occurredAt: validFrom, confirmedAt: validFrom, validFrom, state: "ACTIVE",
    priorReferencePrice, newOpenPrice, gapLow: Math.min(priorReferencePrice, newOpenPrice),
    gapHigh: Math.max(priorReferencePrice, newOpenPrice), midpoint: (priorReferencePrice + newOpenPrice) / 2,
    marketDateOrWeekIdentity: gapType === "NDOG" ? "2026-08-17" : "2026-08-17",
    calendarPolicyId: "fixture-calendar", timeAuthorityId: "gotrader.sessions.iana-america-new-york",
    lineage: { sourceCandleIds: [`${id}-prior`, `${id}-open`], sourceFactIds: [], sourceFingerprint: "i5-fixture", policyId: "fixture-calendar", policyVersion: "1" },
    authority
  };
};

export const evidence = (gapType = "NDOG", overrides = {}) => ({
  evidenceId: `evidence-${gapType.toLowerCase()}`,
  boundaryKind: gapType === "NDOG" ? "DAY_ROLLOVER" : "WEEK_REOPEN",
  calendarStatus: "VERIFIED", sourceContinuity: "VERIFIED", openingReferenceAvailable: true,
  holidayStatus: "REGULAR", calendarPolicyId: "fixture-calendar",
  timeAuthorityId: "gotrader.sessions.iana-america-new-york", ...overrides
});

export const observation = (minute, { high = 112, low = 108, close = 109 } = {}) => ({
  observationId: `observation-${minute}-${high}-${low}-${close}`,
  observedAt: at(minute), high, low, close
});

export const input = (gapType = "NDOG", orientation = "GAP_UP", overrides = {}) => ({
  gap: gap(gapType, orientation), asOf: at(10), sourceFingerprint: "i5-fixture",
  calendarEvidence: evidence(gapType), observations: [], ...overrides
});
