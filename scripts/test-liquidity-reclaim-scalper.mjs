#!/usr/bin/env node
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd(); const src = path.join(root, "src", "lib"); const out = path.join(root, ".gotrader", "lrs-test");
compileTypescriptModules({ outRoot: out, files: ["canonical/canonicalValueSerialization.ts", "backtestSimulation/simulationAuthority.ts",
  "backtestSimulation/simulationTypes.ts", "strategyLibrary/liquidityReclaimScalper/liquidityReclaimScalperTypes.ts",
  "strategyLibrary/liquidityReclaimScalper/liquidityReclaimScalperParameters.ts",
  "strategyLibrary/liquidityReclaimScalper/liquidityReclaimScalperStateMachine.ts"].map((f) => path.join(src, f)) });
const load = (f) => import(`${pathToFileURL(path.join(out, f)).href}?t=${Date.now()}`);
const params = await load("liquidityReclaimScalperParameters.mjs");
const state = await load("liquidityReclaimScalperStateMachine.mjs");
const profile = await params.buildLrsBaseProfile();
assert.equal(profile.parameters.minimumTheoreticalRR, null); assert.equal(profile.researchValidated, false); assert.equal(profile.productionAdoptionAllowed, false);
assert.equal(await params.buildLrsParameterHash({ ...profile.parameters }), profile.parameterHash);
assert.notEqual(await params.buildLrsParameterHash({ ...profile.parameters, maximumEntryWaitBars: 11 }), profile.parameterHash);
assert.throws(() => params.validateLrsParameters({ ...profile.parameters, unknown: true }), /unknown/);
assert.throws(() => params.validateLrsParameters({ ...profile.parameters, entryRetracementRatio: 2 }), /outside/);
assert.equal(state.canTransitionLrs("SEARCHING", "LIQUIDITY_OBJECTIVE_IDENTIFIED"), true);
assert.equal(state.canTransitionLrs("SEARCHING", "IFVG_RECLAIMED"), false);
assert.equal(state.canTransitionLrs("TARGET_CONSUMED", "ENTRY_ELIGIBLE"), false);
await assert.rejects(state.buildLrsTransition({ previousState: "SETUP_EXPIRED", nextState: "ACTIVE", marketTime: "2026-01-01T00:00:00.000Z", triggerFactIds: [], blockers: [] }), /Illegal/);
console.log(JSON.stringify({ status: "passed", strategyId: "liquidity_reclaim_scalper_v1", parameterCount: Object.keys(profile.parameters).length, parameterHash: profile.parameterHash }, null, 2));
