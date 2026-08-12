#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-cmd/generator");
const fixtureRoot = path.join(root, "tests/fixtures/bt3-cmd");
const writeMode = process.argv.includes("--write");
const authority = { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" };
const stable = (value) => {
  const sort = (item) => Array.isArray(item) ? item.map(sort) : item && typeof item === "object"
    ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])])) : item;
  return `${JSON.stringify(sort(value), null, 2)}\n`;
};
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

async function build() {
  compileTypescriptModules({ files: [path.join(root, "src/lib/ict-strategy-suite/ictCmdHighDisplacementV2.ts")], outRoot });
  const detector = await import(pathToFileURL(path.join(outRoot, "ictCmdHighDisplacementV2.mjs")).href);
  const evidence = {
    requestedSymbol: "MNQ", brokerSymbol: "USTECH", timeframe: "5m", sourceProvider: "mt5_read_only",
    sourceFingerprint: "fixture|MNQ|USTECH|5m|bt3_cmd", signalTime: "2026-06-12T14:35:00.000Z",
    modelProfile: "consolidation_manipulation_distribution", modelState: "confirmed", modelDirection: "bearish",
    side: "short", displacementDirection: "bearish", displacementAgeBars: 0, displacementScore: 1.8,
    fvgPresentAtSignal: true, fvgAgeBars: 1, externalLiquidityTargetPresent: true,
    externalLiquidityTargetType: "previous_day_low", entry: 100, stop: 102, target: 94, rr: 3
  };
  const valid = detector.assessIctCmdHighDisplacementV2Evidence(evidence);
  const stale = detector.assessIctCmdHighDisplacementV2Evidence({ ...evidence, displacementAgeBars: 5 });
  const compact = (fixtureId, candidate, eligible) => ({
    schemaVersion: "gotrader-bt3-cmd-fixture-v1",
    identity: {
      fixtureId, strategyId: "cmd_high_displacement_v2_research", profileVersion: "v2", classification: "experimental",
      sourceCommit: "ee7b6be68a0ac03073b3aaeb1738695617c356eb", requestedSymbol: candidate.requestedSymbol,
      brokerSymbol: candidate.brokerSymbol, sourceFingerprint: candidate.sourceFingerprint, timeframe: candidate.timeframe,
      lastClosedCandle: candidate.signalTime, parameterFingerprint: "cmd_v2|displacement_1.25|age_2|fvg_age_6|min_rr_2|max_rr_20"
    },
    detectionState: eligible ? "trade_plan_constructed" : candidate.status,
    blockers: candidate.blockers,
    geometry: eligible ? { side: candidate.side, entry: candidate.entry, stop: candidate.stop, target: candidate.target, rr: candidate.rr } : undefined,
    promotionAllowed: false,
    authority
  });
  return {
    schemaVersion: "gotrader-bt3-cmd-snapshot-v1",
    payload: [
      {
        schemaVersion: "gotrader-bt3-cmd-fixture-v1",
        identity: {
          fixtureId: "cmd_v1_policy_only", strategyId: "ict_cmd_short_paper_watchlist_v1", profileVersion: "v1",
          classification: "behavioral_fixture", sourceCommit: "ee7b6be68a0ac03073b3aaeb1738695617c356eb",
          requestedSymbol: "MNQ", brokerSymbol: "USTECH", sourceFingerprint: "fixture|MNQ|USTECH|policy_only|bt3_cmd",
          timeframe: "5m", lastClosedCandle: "2026-06-12T14:35:00.000Z", parameterFingerprint: "cmd_v1|policy_only|independent_date_gate_3"
        },
        detectionState: "policy_only",
        blockers: ["canonical_cmd_v1_detector_ownership_missing", "independent_date_validation_required"],
        promotionAllowed: false,
        authority
      },
      compact("cmd_v2_valid", valid, true),
      compact("cmd_v2_stale_blocked", stale, false)
    ]
  };
}

const first = stable(await build());
const second = stable(await build());
assert.equal(second, first);
fs.mkdirSync(fixtureRoot, { recursive: true });
const snapshotPath = path.join(fixtureRoot, "cmd.snapshot.json");
const hashPath = path.join(fixtureRoot, "snapshot-hashes.json");
const manifest = stable({ schemaVersion: "gotrader-bt3-cmd-hashes-v1", hashes: { "cmd.snapshot.json": sha256(first) } });
if (writeMode) {
  fs.writeFileSync(snapshotPath, first, "utf8");
  fs.writeFileSync(hashPath, manifest, "utf8");
} else {
  assert.equal(fs.readFileSync(snapshotPath, "utf8").replace(/\r\n/g, "\n"), first);
  assert.equal(fs.readFileSync(hashPath, "utf8").replace(/\r\n/g, "\n"), manifest);
}
console.log(JSON.stringify({ status: writeMode ? "written" : "passed", byteStable: true, fixtureCount: 3, snapshotHash: `sha256:${sha256(first)}`, authority }, null, 2));
