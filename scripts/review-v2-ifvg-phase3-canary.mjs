#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import { resolveV2IfvgLiveShadowMode } from "./v2-ifvg-live-shadow-collector-core.mjs";

const workspace = process.cwd();
const fixtureRoot = path.join(workspace, "tests", "fixtures", "v2-baseline");
const outRoot = path.join(workspace, ".gotrader", "v2-ifvg-phase3-canary-review");
const brokerSymbol = process.env.MT5_READONLY_BROKER_SYMBOL || "USTECH";
const safeSymbol = brokerSymbol.replace(/[^a-z0-9._-]/gi, "_");
const liveLedgerFile = path.resolve(
  process.env.V2_IFVG_LIVE_SHADOW_STATE_FILE ||
  path.join(workspace, ".gotrader", "v2", `ifvg-v3-live-shadow-${safeSymbol}-5m.json`)
);
const sourceFiles = [
  "src/lib/v2Baseline/baselineTypes.ts",
  "src/lib/v2/authority/v2Authority.ts",
  "src/lib/v2/serialization/canonicalSerialization.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3LiveShadowTypes.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgV3LiveShadowValidation.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3CanaryTypes.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3BaselineAdapter.ts",
  "src/lib/v2/strategyAdapters/ifvg/v2IfvgPhase3CanaryGate.ts"
].map((file) => path.join(workspace, file));

compileTypescriptModules({ files: sourceFiles, outRoot });
const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
const adapter = await load("v2IfvgPhase3BaselineAdapter");
const gate = await load("v2IfvgPhase3CanaryGate");
const liveValidation = await load("v2IfvgV3LiveShadowValidation");
const authority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
const canonicalText = (value) => value.replace(/\r\n/g, "\n");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const readSnapshot = (name) => {
  const text = canonicalText(fs.readFileSync(path.join(fixtureRoot, name), "utf8"));
  return Object.freeze({ hash: sha256(text), payload: JSON.parse(text).payload });
};
const hashManifest = JSON.parse(
  fs.readFileSync(path.join(fixtureRoot, "baseline-snapshot-hashes.json"), "utf8")
).hashes;
const positiveSnapshot = readSnapshot("ifvg-v3-positive-canary.snapshot.json");
const negativeSnapshot = readSnapshot("ifvg-v2-negative-control.snapshot.json");
if (positiveSnapshot.hash !== hashManifest["ifvg-v3-positive-canary.snapshot.json"]) {
  throw new Error("IFVG v3 positive baseline snapshot hash drifted.");
}
if (negativeSnapshot.hash !== hashManifest["ifvg-v2-negative-control.snapshot.json"]) {
  throw new Error("IFVG v2 negative baseline snapshot hash drifted.");
}
const positiveFixture = positiveSnapshot.payload.find(
  (fixture) => fixture.identity.fixtureId === "ifvg_v3_valid"
);
const negativeFixture = negativeSnapshot.payload.find(
  (fixture) => fixture.identity.fixtureId === "ifvg_v2_negative_control"
);
const positiveCanary = await adapter.buildV2IfvgPhase3ResearchLifecycleArtifactFromBaseline({
  fixture: positiveFixture,
  baselineSnapshotHash: positiveSnapshot.hash
});
const negativeControl = await adapter.buildV2IfvgPhase3ResearchLifecycleArtifactFromBaseline({
  fixture: negativeFixture,
  baselineSnapshotHash: negativeSnapshot.hash
});

let liveShadow;
let liveLedgerStatus = "missing";
let liveLedgerBlockers = [];
if (fs.existsSync(liveLedgerFile)) {
  try {
    const validation = await liveValidation.validateV2IfvgV3LiveShadowLedgerFile(
      JSON.parse(fs.readFileSync(liveLedgerFile, "utf8"))
    );
    liveLedgerStatus = validation.status;
    liveLedgerBlockers = validation.blockers;
    if (validation.status === "accepted" && validation.ledger) {
      liveShadow = Object.freeze({
        validationStatus: "accepted",
        exactParityCount: validation.ledger.exactParityCount,
        regressionCount: validation.ledger.regressionCount,
        insufficientComparisonCount: validation.ledger.insufficientComparisonCount,
        distinctClosedWindowCount: validation.ledger.distinctClosedWindowCount,
        distinctMarketDateCount: validation.ledger.distinctMarketDateCount,
        statisticallyIndependentWindowClaimed: false,
        authority
      });
    }
  } catch (error) {
    liveLedgerStatus = "blocked";
    liveLedgerBlockers = [error instanceof Error ? error.message : String(error)];
  }
}
const result = await gate.evaluateV2IfvgPhase3CanaryGate({
  canaryMode: resolveV2IfvgLiveShadowMode(process.env.V2_IFVG_LIVE_SHADOW_MODE),
  evaluatedAtUtc: new Date().toISOString(),
  deterministicParity: Object.freeze({
    detection: "exact_parity",
    geometry: "exact_parity",
    selection: "exact_parity"
  }),
  positiveCanary,
  negativeControl,
  ...(liveShadow ? { liveShadow } : {})
});

console.log(JSON.stringify({
  status: result.status,
  gateId: result.gateId,
  profileId: positiveCanary.profileId,
  positiveCanaryPreserved: result.positiveCanaryPreserved,
  negativeControlPreserved: result.negativeControlPreserved,
  parity: {
    detection: result.detectionParity,
    geometry: result.geometryParity,
    selection: result.selectionParity,
    researchLifecycle: result.researchLifecycleParity,
    liveShadow: result.liveShadowParity
  },
  liveLedger: {
    status: liveLedgerStatus,
    blockers: liveLedgerBlockers,
    ...(liveShadow ? {
      exactParityCount: liveShadow.exactParityCount,
      regressionCount: liveShadow.regressionCount,
      distinctClosedWindowCount: liveShadow.distinctClosedWindowCount,
      distinctMarketDateCount: liveShadow.distinctMarketDateCount
    } : {})
  },
  blockers: result.blockers,
  warnings: result.warnings,
  nextAction: result.nextAction,
  rollbackAction: result.rollbackAction,
  phase3CompletionReviewReady: result.phase3CompletionReviewReady,
  phase4ImplementationAuthorized: false,
  productionAdoptionAllowed: false,
  rawCandlesSerialized: false,
  authority
}, null, 2));
