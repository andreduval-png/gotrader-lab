import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export async function loadIctI2() {
  const root = process.cwd();
  const out = path.join(root, ".gotrader", `ict-i2-test-runtime-${process.pid}`);
  fs.rmSync(out, { recursive: true, force: true });
  for (const directory of ["ictCanonical", "ictI2"]) {
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
        .replace(/from\s+"@\/lib\/ictI2\/([^"]+)"/g, 'from "../ictI2/$1.mjs"');
      fs.writeFileSync(path.join(outputDirectory, name.replace(/\.ts$/, ".mjs")), output, "utf8");
    }
  }
  return import(`${pathToFileURL(path.join(out, "ictI2", "index.mjs")).href}?v=${Date.now()}`);
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

export const at = (minute) => new Date(Date.UTC(2026, 0, 5, 14, minute)).toISOString();

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
    sourceFingerprint: "fixture-source",
    policyId: "fixture-policy",
    policyVersion: "1.0.0"
  },
  authority
});

export function ict2022Fixture(direction = "bullish") {
  const long = direction === "bullish";
  const drawSide = long ? "BUY_SIDE_LIQUIDITY" : "SELL_SIDE_LIQUIDITY";
  const raidSide = long ? "SELL_SIDE_LIQUIDITY" : "BUY_SIDE_LIQUIDITY";
  const facts = [
    {
      ...factBase("draw", "DRAW_ON_LIQUIDITY", 0),
      drawId: "draw",
      direction,
      targetLiquidityId: "target",
      targetClass: "EXTERNAL",
      ownerTimeframe: "1h",
      distance: 10,
      structuralRelevance: 1,
      available: true,
      consumed: false,
      selectionPolicyVersion: "1"
    },
    {
      ...factBase("target-fact", "LIQUIDITY", 0),
      liquidityId: "target",
      side: drawSide,
      liquidityClass: "EXTERNAL",
      sourceStructureIds: ["target-swing"],
      ownerTimeframe: "1h",
      price: long ? 110 : 90,
      status: "AVAILABLE"
    },
    {
      ...factBase("raid", "LIQUIDITY", 5),
      liquidityId: "raid",
      side: raidSide,
      liquidityClass: "EXTERNAL",
      sourceStructureIds: ["raid-swing"],
      ownerTimeframe: "15m",
      price: long ? 95 : 105,
      status: "CONSUMED",
      consumedAt: at(5),
      consumingCandleId: "c5"
    },
    {
      ...factBase("displacement", "DISPLACEMENT", 10),
      displacementId: "displacement",
      direction,
      startCandleId: "c5",
      endCandleId: "c10",
      bodySize: 4,
      baselineBodySize: 2,
      bodyMultiple: 2,
      measurementPolicyId: "fixture"
    },
    {
      ...factBase("mss", "MSS", 15),
      mssId: "mss",
      direction,
      brokenStructureId: "swing",
      breakCandleId: "c15",
      displacementId: "displacement",
      breakPrice: 100
    },
    {
      ...factBase("fvg", "FVG", 20),
      fvgId: "fvg",
      direction,
      proximalPrice: long ? 100 : 101,
      distalPrice: long ? 101 : 100,
      midpoint: 100.5,
      originCandleIds: ["c10", "c15", "c20"],
      fvgState: "OPEN",
      filledPercentage: 0
    }
  ];
  const candle = {
    id: "retrace",
    symbol: "NQ",
    timeframe: "5m",
    timestamp: at(25),
    open: 102,
    high: 102,
    low: 100.4,
    close: 101,
    volume: 100
  };
  return {
    facts,
    candlesByTimeframe: { "5m": [candle] },
    asOf: at(25),
    sourceFingerprint: "fixture-source",
    parameterFingerprint: "fixture-parameters",
    narrative: {
      structuralBias: direction,
      currentFlowDirection: direction,
      setupMaturationDirection: direction,
      retracementState: "confirmed",
      continuationState: "forming",
      liquidityPath: long ? "buyside" : "sellside",
      policyId: "c1-fixture",
      policyVersion: "1"
    },
    dataset: {
      datasetCertificateId: "fixture-certificate",
      datasetId: "fixture-dataset",
      datasetChecksum: "sha256:fixture"
    }
  };
}

export function po3Fixture(direction = "bullish") {
  const long = direction === "bullish";
  const manipulationSide = long ? "SELL_SIDE_LIQUIDITY" : "BUY_SIDE_LIQUIDITY";
  const targetSide = long ? "BUY_SIDE_LIQUIDITY" : "SELL_SIDE_LIQUIDITY";
  const facts = [
    {
      ...factBase("range", "DEALING_RANGE", 0),
      dealingRangeId: "range-1",
      highSwingId: "high",
      lowSwingId: "low",
      highPrice: 105,
      lowPrice: 95,
      equilibrium: 100,
      context: "balanced_range"
    },
    {
      ...factBase("manipulation", "LIQUIDITY", 5),
      liquidityId: "manipulation",
      side: manipulationSide,
      liquidityClass: "EXTERNAL",
      sourceStructureIds: ["range-side"],
      ownerTimeframe: "15m",
      dealingRangeId: "range-1",
      price: long ? 94 : 106,
      status: "CONSUMED",
      consumedAt: at(5),
      consumingCandleId: "c5"
    },
    {
      ...factBase("distribution", "DISPLACEMENT", 10),
      displacementId: "distribution",
      direction,
      startCandleId: "c5",
      endCandleId: "c10",
      bodySize: 5,
      baselineBodySize: 2,
      bodyMultiple: 2.5,
      measurementPolicyId: "fixture"
    },
    {
      ...factBase("distribution-mss", "MSS", 15),
      mssId: "distribution-mss",
      direction,
      brokenStructureId: "range-structure",
      breakCandleId: "c15",
      displacementId: "distribution",
      breakPrice: long ? 103 : 97
    },
    {
      ...factBase("po3-fvg", "FVG", 20),
      fvgId: "po3-fvg",
      direction,
      proximalPrice: long ? 100 : 101,
      distalPrice: long ? 101 : 100,
      midpoint: 100.5,
      originCandleIds: ["c10", "c15", "c20"],
      fvgState: "OPEN",
      filledPercentage: 0
    },
    {
      ...factBase("po3-target", "LIQUIDITY", 0),
      liquidityId: "po3-target",
      side: targetSide,
      liquidityClass: "EXTERNAL",
      sourceStructureIds: ["target-side"],
      ownerTimeframe: "1h",
      dealingRangeId: "range-1",
      price: long ? 110 : 90,
      status: "AVAILABLE"
    }
  ];
  return {
    facts,
    candlesByTimeframe: {
      "5m": [{
        id: "po3-retrace",
        symbol: "NQ",
        timeframe: "5m",
        timestamp: at(25),
        open: 102,
        high: 102,
        low: 100.4,
        close: 101,
        volume: 100
      }]
    },
    asOf: at(25),
    sourceFingerprint: "po3-fixture-source",
    parameterFingerprint: "po3-fixture-parameters",
    narrative: {
      structuralBias: direction,
      currentFlowDirection: direction,
      setupMaturationDirection: direction,
      retracementState: "confirmed",
      continuationState: "confirmed",
      liquidityPath: long ? "buyside" : "sellside",
      policyId: "c1-po3-fixture",
      policyVersion: "1"
    }
  };
}
