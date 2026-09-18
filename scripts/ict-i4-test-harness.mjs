import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export async function loadIctI4() {
  const root = process.cwd();
  const out = path.join(root, ".gotrader", `ict-i4-test-runtime-${process.pid}`);
  fs.rmSync(out, { recursive: true, force: true });
  for (const directory of ["ictCanonical", "tradeGeometry", "ictI2", "ictI3", "ictI4"]) {
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
        .replace(/from\s+"@\/lib\/ictI2\/([^"]+)"/g, 'from "../ictI2/$1.mjs"')
        .replace(/from\s+"@\/lib\/ictI3\/([^"]+)"/g, 'from "../ictI3/$1.mjs"')
        .replace(/from\s+"@\/lib\/ictI4\/([^"]+)"/g, 'from "../ictI4/$1.mjs"')
        .replace(/from\s+"@\/lib\/tradeGeometry"/g, 'from "../tradeGeometry/index.mjs"');
      fs.writeFileSync(path.join(outputDirectory, name.replace(/\.ts$/, ".mjs")), output, "utf8");
    }
  }
  return import(`${pathToFileURL(path.join(out, "ictI4", "index.mjs")).href}?v=${Date.now()}`);
}

export const authority = {
  executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none",
  productionAdoptionAllowed: false, canCreateEvidence: false, canApproveReadiness: false,
  canApplyCalibration: false, canCreateTradeIntent: false
};
export const at = (minute) => new Date(Date.UTC(2026, 1, 3, 14, minute)).toISOString();
export const base = (factId, factType, minute, direction = "bullish") => ({
  factId, factType, symbol: "NQ", timeframe: "5m", occurredAt: at(minute), confirmedAt: at(minute), validFrom: at(minute),
  state: "ACTIVE", direction,
  lineage: { sourceCandleIds: [`c${minute}`], sourceFactIds: [], sourceFingerprint: "i4-fixture", policyId: "fixture", policyVersion: "1" },
  authority
});
export const narrative = (direction = "bullish") => ({
  structural: direction,
  intermediate: direction,
  execution: direction,
  liquidityPath: direction === "bullish" ? "buyside" : "sellside",
  structuralTimeframe: "1h",
  intermediateTimeframe: "15m",
  executionTimeframe: "5m",
  policyId: "gotrader.ict.c1-1.hierarchical-roles.v1",
  policyVersion: "1.0.0"
});
export function unicornFacts(direction = "bullish", fvgMinute = 2) {
  return [
    { ...base("breaker", "BLOCK", 1, direction), blockId: "breaker", blockType: "BREAKER_BLOCK", originCandleIds: ["c0"], proximalPrice: 102, distalPrice: 98, midpoint: 100, originBlockId: "ob", structureFailureId: "mss", conversionEventId: "conversion" },
    { ...base("fvg", "FVG", fvgMinute, direction), fvgId: "fvg", proximalPrice: 101, distalPrice: 99, midpoint: 100, originCandleIds: ["c1", "c2", "c3"], fvgState: "OPEN", filledPercentage: 0 }
  ];
}
export function oteFacts(direction = "bullish", zoneMinute = 2) {
  const range = {
    ...base("range", "DEALING_RANGE", 1, direction), dealingRangeId: "range", highSwingId: "high", lowSwingId: "low",
    highPrice: 110, lowPrice: 90, equilibrium: 100, context: direction === "bullish" ? "bullish_range" : "bearish_range"
  };
  const prices = direction === "bullish" ? [97.6, 94.2] : [105.8, 102.4];
  const zone = {
    ...base("ote", "OTE_ZONE", zoneMinute, direction), oteZoneId: "ote", dealingRangeId: "range",
    proximalPrice: Math.max(...prices), distalPrice: Math.min(...prices), retracementPolicyId: "gotrader.canonical.ote.legacy-foundation",
    retracementFractions: [0.62, 0.79]
  };
  return [range, zone];
}
export function deliveryFacts(transitionType = "IRL_TO_ERL_DELIVERY", transitionMinute = 3, state = "ACTIVE") {
  const irlToErl = transitionType === "IRL_TO_ERL_DELIVERY";
  const originClass = irlToErl ? "INTERNAL" : "EXTERNAL";
  const objectiveClass = irlToErl ? "EXTERNAL" : "INTERNAL";
  const origin = { ...base("origin", "LIQUIDITY", 1), liquidityId: "origin", side: "SELL_SIDE_LIQUIDITY", liquidityClass: originClass, sourceStructureIds: ["origin-swing"], ownerTimeframe: "1h", price: 95, dealingRangeId: "range", status: "AVAILABLE" };
  const objective = { ...base("objective", "LIQUIDITY", 1), liquidityId: "objective", side: "BUY_SIDE_LIQUIDITY", liquidityClass: objectiveClass, sourceStructureIds: ["objective-swing"], ownerTimeframe: "1h", price: 110, dealingRangeId: "range", status: "AVAILABLE" };
  const transition = { ...base("delivery", "IRL_ERL_TRANSITION", transitionMinute), transitionId: "delivery", transitionType, direction: "bullish", fromLiquidityId: "origin", toLiquidityId: "objective", dealingRangeId: "range", startedAt: at(2), currentState: state };
  return [origin, objective, transition];
}
export function pdArrayFacts(direction = "bullish", minute = 2) {
  return [{ ...base("pd-array", "PD_ARRAY", minute, direction), pdArrayId: "pd-array", pdArrayType: "FVG", direction, priceRange: [99, 101], sourceFactId: "fvg" }];
}
