#!/usr/bin/env node
import assert from "node:assert/strict";
import { at, loadIctI5 } from "./ict-i5-test-harness.mjs";
const ict = await loadIctI5();
const context = ict.evaluateTgifContext({ asOf: at(10), sourceFingerprint: "i5-fixture", supportingFactIds: ["weekly-range", "friday-session"] });
assert.equal(context.decision, "BLOCKED_SOURCE_SEMANTICS");
assert.equal(context.state, "SOURCE_BLOCKED");
assert.equal(context.executable, false);
assert.equal(context.authority.executionAuthority, "none");
assert.equal(context.researchValidated, false);
assert.ok(context.blockers.includes("tgif_entry_stop_target_expiry_unresolved"));
console.log("I5 TGIF source-gate tests passed");
