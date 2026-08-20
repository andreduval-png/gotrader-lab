#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outDir = path.join(root, ".gotrader", "chart-data-integrity-test");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "seriesAdapters.mjs"),
  "export const candlesToChartData = (candles) => candles;\n",
  "utf8"
);

const sourcePath = path.join(root, "src", "lib", "charting", "chartDataAdapters.ts");
let output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    verbatimModuleSyntax: false
  },
  fileName: sourcePath
}).outputText;
output = output.replace("@/lib/charting/seriesAdapters", "./seriesAdapters.mjs");
const outputPath = path.join(outDir, "chartDataAdapters.mjs");
fs.writeFileSync(outputPath, output, "utf8");

const { fingerprintCandles } = await import(`${pathToFileURL(outputPath).href}?v=${Date.now()}`);
const candle = (id, timestamp, close) => ({
  id,
  symbol: "MNQ",
  timeframe: "5m",
  timestamp,
  open: close - 1,
  high: close + 2,
  low: close - 2,
  close,
  volume: 100
});
const baseline = [
  candle("a", "2026-08-14T10:00:00.000Z", 100),
  candle("b", "2026-08-14T10:05:00.000Z", 101),
  candle("c", "2026-08-14T10:10:00.000Z", 102)
];
const correctedInterior = baseline.map((item, index) => index === 1 ? { ...item, high: item.high + 4 } : item);
const sameContent = baseline.map((item) => ({ ...item }));

const baselineFingerprint = fingerprintCandles(baseline, "live_feed", "MT5 read-only");
assert.equal(fingerprintCandles(sameContent, "live_feed", "MT5 read-only"), baselineFingerprint);
assert.notEqual(
  fingerprintCandles(correctedInterior, "live_feed", "MT5 read-only"),
  baselineFingerprint,
  "an interior OHLC correction must invalidate the chart series"
);

console.log(JSON.stringify({ status: "passed", interiorCorrectionsInvalidateChart: true }, null, 2));
