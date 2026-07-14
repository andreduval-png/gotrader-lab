#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader", "detector-profile-walk-forward-test");

const compile = (sourceRelative, outputRelative, replacements = []) => {
  const sourcePath = path.join(root, sourceRelative);
  const outputPath = path.join(outRoot, outputRelative);
  const output = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: sourcePath
  }).outputText;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    replacements.reduce((value, [from, to]) => value.replaceAll(from, to), output),
    "utf8"
  );
};

const timestamp = (start, day, hour = 15) =>
  new Date(Date.parse(start) + day * 86_400_000 + hour * 3_600_000).toISOString();

const buildTrades = ({ start, fromDay, days, tradesPerDay = 1, winning = true }) => {
  const trades = [];
  for (let day = fromDay; day < fromDay + days; day += 1) {
    for (let index = 0; index < tradesPerDay; index += 1) {
      const win = winning ? (day + index) % 2 === 0 : (day + index) % 4 === 0;
      trades.push({
        openedAt: timestamp(start, day, 14 + index),
        rMultiple: win ? 3 : -1,
        outcome: win ? "target_hit" : "stop_hit"
      });
    }
  }
  return trades;
};

async function main() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  compile("src/lib/statistics/edgeStatistics.ts", "statistics/edgeStatistics.mjs");
  compile(
    "src/lib/walkForward/detectorProfileWalkForward.ts",
    "walkForward/detectorProfileWalkForward.mjs",
    [["@/lib/statistics/edgeStatistics", "../statistics/edgeStatistics.mjs"]]
  );
  const { runDetectorProfileWalkForward } = await import(
    pathToFileURL(path.join(outRoot, "walkForward", "detectorProfileWalkForward.mjs")).href
  );

  const sourceStart = "2026-01-01T00:00:00.000Z";
  const sourceEnd = "2026-06-30T00:00:00.000Z";
  const developmentTrades = buildTrades({ start: sourceStart, fromDay: 0, days: 120 });
  const oosTrades = buildTrades({ start: sourceStart, fromDay: 120, days: 60 });
  const safeResult = runDetectorProfileWalkForward({
    profileId: "ifvg_fresh_retest_v3_research",
    sourceProvider: "mt5_read_only",
    sourceFingerprint: "mt5_test_fp",
    sourceStart,
    sourceEnd,
    trades: [...developmentTrades, ...oosTrades]
  });
  assert.equal(safeResult.verdict, "passed");
  assert.equal(safeResult.oosWindowCount, 2);
  assert.equal(safeResult.oosWindowsPassed, 2);
  assert.equal(safeResult.totalOosTrades, 60);
  assert.equal(safeResult.pooledOos.edgeVerdict, "positive_edge");
  assert.ok(safeResult.additionalCost05R.averageR > 0);
  assert.equal(safeResult.authority.executionAuthority, "none");
  assert.equal(safeResult.authority.brokerAuthority, "none");
  assert.equal(safeResult.authority.readinessOverrideAuthority, "none");
  assert.equal(safeResult.safety.readinessPromotionAllowed, false);
  const serialized = JSON.stringify(safeResult);
  for (const forbiddenKey of ["candles", "rawCandles", "accountData", "orders", "positions"]) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(safeResult, forbiddenKey),
      false,
      `Walk-forward output must not expose ${forbiddenKey}.`
    );
  }
  assert.doesNotMatch(
    serialized,
    /"(?:candles|rawCandles|accountData|orders|positions)"\s*:/i
  );

  const concentrated = runDetectorProfileWalkForward({
    profileId: "one_date_cluster",
    sourceProvider: "mt5_read_only",
    sourceFingerprint: "mt5_test_fp",
    sourceStart,
    sourceEnd,
    trades: [
      ...developmentTrades,
      ...Array.from({ length: 50 }, (_, index) => ({
        openedAt: timestamp(sourceStart, 150, 10 + (index % 10)),
        rMultiple: 3,
        outcome: "target_hit"
      }))
    ]
  });
  assert.equal(concentrated.verdict, "failed");
  assert.match(concentrated.blockers.join(" "), /unique OOS dates|Largest OOS date/i);

  const weak = runDetectorProfileWalkForward({
    profileId: "negative_oos",
    sourceProvider: "mt5_read_only",
    sourceFingerprint: "mt5_test_fp",
    sourceStart,
    sourceEnd,
    trades: [
      ...developmentTrades,
      ...buildTrades({ start: sourceStart, fromDay: 120, days: 60, winning: false })
    ]
  });
  assert.equal(weak.verdict, "failed");
  assert.match(weak.blockers.join(" "), /edge verdict|cost stress|windows passed/i);

  const mock = runDetectorProfileWalkForward({
    profileId: "mock_profile",
    sourceProvider: "mock",
    sourceFingerprint: "mock_fp",
    sourceStart,
    sourceEnd,
    trades: [...developmentTrades, ...oosTrades]
  });
  assert.equal(mock.verdict, "blocked_source");

  console.log(
    JSON.stringify(
      {
        ok: true,
        diagnostic: "detector_profile_walk_forward",
        safeProfile: {
          verdict: safeResult.verdict,
          windows: `${safeResult.oosWindowsPassed}/${safeResult.oosWindowCount}`,
          oosTrades: safeResult.totalOosTrades,
          uniqueDates: safeResult.uniqueOosTradingDates,
          averageR: safeResult.pooledOos.averageR,
          stressedAverageR: safeResult.additionalCost05R.averageR,
          edgeVerdict: safeResult.pooledOos.edgeVerdict
        },
        safety: safeResult.safety,
        authority: safeResult.authority
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
