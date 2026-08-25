import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export async function loadIctI3() {
  const root = process.cwd();
  const out = path.join(root, ".gotrader", `ict-i3-test-runtime-${process.pid}`);
  fs.rmSync(out, { recursive: true, force: true });
  for (const directory of ["ictCanonical", "tradeGeometry", "ictI2", "ictI3"]) {
    const sourceDirectory = path.join(root, "src", "lib", directory);
    const outputDirectory = path.join(out, directory);
    fs.mkdirSync(outputDirectory, { recursive: true });
    for (const name of fs.readdirSync(sourceDirectory).filter((file) => file.endsWith(".ts"))) {
      const source = fs.readFileSync(path.join(sourceDirectory, name), "utf8");
      const output = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ES2022,
          target: ts.ScriptTarget.ES2022,
          importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
          verbatimModuleSyntax: false
        },
        fileName: name
      }).outputText
        .replace(/from\s+"@\/lib\/ictCanonical\/([^"]+)"/g, 'from "../ictCanonical/$1.mjs"')
        .replace(/from\s+"@\/lib\/ictI2\/([^"]+)"/g, 'from "../ictI2/$1.mjs"')
        .replace(/from\s+"@\/lib\/ictI3\/([^"]+)"/g, 'from "../ictI3/$1.mjs"')
        .replace(/from\s+"@\/lib\/tradeGeometry\/([^"]+)"/g, 'from "../tradeGeometry/$1.mjs"')
        .replace(/from\s+"@\/lib\/tradeGeometry"/g, 'from "../tradeGeometry/index.mjs"');
      fs.writeFileSync(path.join(outputDirectory, name.replace(/\.ts$/, ".mjs")), output, "utf8");
    }
  }
  return import(`${pathToFileURL(path.join(out, "ictI3", "index.mjs")).href}?v=${Date.now()}`);
}

export const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none",
  productionAdoptionAllowed: false,
  canCreateEvidence: false,
  canApproveReadiness: false,
  canApplyCalibration: false,
  canCreateTradeIntent: false
};

export const at = (minute) => new Date(Date.UTC(2026, 1, 3, 14, minute)).toISOString();

export const factBase = (factId, factType, minute) => ({
  factId,
  factType,
  symbol: "NQ",
  timeframe: "5m",
  occurredAt: at(minute),
  confirmedAt: at(minute),
  validFrom: at(minute),
  state: "ACTIVE",
  lineage: {
    sourceCandleIds: [`c${minute}`],
    sourceFactIds: [],
    sourceFingerprint: "i3-fixture-source",
    policyId: "i3-fixture-policy",
    policyVersion: "1.0.0"
  },
  authority
});

export function marketMakerFixture(direction = "BULLISH") {
  const bullish = direction === "BULLISH";
  const factDirection = bullish ? "bullish" : "bearish";
  const engineeringSide = bullish ? "SELL_SIDE_LIQUIDITY" : "BUY_SIDE_LIQUIDITY";
  const objectiveSide = bullish ? "BUY_SIDE_LIQUIDITY" : "SELL_SIDE_LIQUIDITY";
  const engineeringPrice = bullish ? 90 : 110;
  const objectivePrice = bullish ? 120 : 80;
  const pdRange = bullish ? [98, 100] : [100, 102];
  const facts = [
    {
      ...factBase("range", "DEALING_RANGE", 0),
      dealingRangeId: "range-1",
      highSwingId: "range-high",
      lowSwingId: "range-low",
      highPrice: 110,
      lowPrice: 90,
      equilibrium: 100,
      context: "balanced_range"
    },
    {
      ...factBase("pd-location", "PD_LOCATION", 1),
      pdLocationId: "pd-location",
      dealingRangeId: "range-1",
      price: bullish ? 96 : 104,
      location: bullish ? "DISCOUNT" : "PREMIUM",
      equilibriumBandFraction: 0.04
    },
    {
      ...factBase("engineering", "LIQUIDITY", 5),
      liquidityId: "engineering",
      side: engineeringSide,
      liquidityClass: "EXTERNAL",
      sourceStructureIds: [bullish ? "range-low" : "range-high"],
      ownerTimeframe: "1h",
      dealingRangeId: "range-1",
      price: engineeringPrice,
      status: "CONSUMED",
      consumedAt: at(5),
      consumingCandleId: "c5"
    },
    {
      ...factBase("internal", "LIQUIDITY", 6),
      liquidityId: "internal",
      side: objectiveSide,
      liquidityClass: "INTERNAL",
      sourceStructureIds: ["internal-swing"],
      ownerTimeframe: "5m",
      dealingRangeId: "range-1",
      price: 100,
      status: "AVAILABLE"
    },
    {
      ...factBase("transition", "IRL_ERL_TRANSITION", 10),
      transitionId: "transition",
      transitionType: "ERL_TO_IRL_DELIVERY",
      direction: factDirection,
      fromLiquidityId: "engineering",
      toLiquidityId: "internal",
      dealingRangeId: "range-1",
      startedAt: at(5),
      currentState: "ACTIVE"
    },
    {
      ...factBase("displacement", "DISPLACEMENT", 15),
      displacementId: "displacement",
      direction: factDirection,
      startCandleId: "c10",
      endCandleId: "c15",
      bodySize: 5,
      baselineBodySize: 2,
      bodyMultiple: 2.5,
      measurementPolicyId: "fixture"
    },
    {
      ...factBase("mss", "MSS", 16),
      mssId: "mss",
      direction: factDirection,
      brokenStructureId: "internal-swing",
      breakCandleId: "c16",
      displacementId: "displacement",
      breakPrice: bullish ? 101 : 99
    },
    {
      ...factBase("pd-array", "PD_ARRAY", 20),
      pdArrayId: "pd-array",
      pdArrayType: "FVG",
      direction: factDirection,
      priceRange: pdRange,
      sourceFactId: "source-fvg"
    },
    {
      ...factBase("objective", "LIQUIDITY", 0),
      liquidityId: "objective",
      side: objectiveSide,
      liquidityClass: "EXTERNAL",
      sourceStructureIds: [bullish ? "range-high" : "range-low"],
      ownerTimeframe: "1h",
      dealingRangeId: "range-1",
      price: objectivePrice,
      status: "AVAILABLE"
    }
  ];
  const entry = bullish ? 99 : 101;
  return {
    facts,
    candlesByTimeframe: {
      "5m": [{
        id: "entry-touch",
        symbol: "NQ",
        timeframe: "5m",
        timestamp: at(25),
        open: entry,
        high: entry + 1,
        low: entry - 1,
        close: entry,
        volume: 100
      }]
    },
    asOf: at(25),
    sourceFingerprint: "i3-fixture-source",
    narrative: {
      structuralBias: factDirection,
      currentFlowDirection: bullish ? "bearish" : "bullish",
      setupMaturationDirection: factDirection,
      retracementState: "confirmed",
      continuationState: "forming",
      liquidityPath: bullish ? "buyside" : "sellside",
      policyId: "c1-i3-fixture",
      policyVersion: "1.0.0"
    },
    smt: {
      divergenceType: "no_smt",
      confirmsCandidate: false,
      rejectsCandidate: false,
      reason: "No SMT divergence; optional policy remains neutral."
    },
    dataset: {
      datasetCertificateId: "fixture-certificate",
      datasetId: "fixture-dataset",
      datasetChecksum: "sha256:fixture"
    }
  };
}
