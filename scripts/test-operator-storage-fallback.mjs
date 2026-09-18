import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

// Execute production persistence code with only its unrelated imports removed.
async function load(file, prelude = "", exports = "") {
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const body = ast.statements.filter((node) => !ts.isImportDeclaration(node))
    .map((node) => node.getText(ast)).join("\n");
  const output = ts.transpileModule(`${prelude}\n${body}\n${exports}`, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}#${Math.random()}`);
}

class Storage {
  values = new Map();
  fail = false;
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) {
    if (this.fail) throw new DOMException("Full", "QuotaExceededError");
    this.values.set(key, value);
  }
}
const authority = { executionAuthority: "none", brokerAuthority: "none", readinessOverrideAuthority: "none" };
for (const failures of [[true, true], [true, false], [false, true]]) {
  const localStorage = new Storage();
  const sessionStorage = new Storage();
  const events = [];
  globalThis.window = { localStorage, sessionStorage, dispatchEvent: (event) => events.push(event) };
  const cycle = await load("src/lib/operatorConsole/operatorCycle.ts",
    `const OPERATOR_AUTHORITY = ${JSON.stringify(authority)}; const ifvgShallowRetestV4FrozenProfile = {profileId:'test'};`);
  const state = { status: "completed", stage: "complete", progressPercent: 100, message: "done" };
  cycle.saveOperatorCycleState({ ...state, cycleId: "A" });
  [sessionStorage.fail, localStorage.fail] = failures;
  cycle.saveOperatorCycleState({ ...state, cycleId: "B" });
  assert.equal(cycle.readOperatorCycleState().cycleId, "B", `stale cycle restored: ${failures}`);
  assert.equal(events.at(-1).detail.cycleId, "B");
  sessionStorage.fail = localStorage.fail = false;
  cycle.saveOperatorCycleState({ ...state, cycleId: "C" });
  assert.equal(cycle.readOperatorCycleState().cycleId, "C");
}

globalThis.window = { localStorage: new Storage(), dispatchEvent() {} };
const activation = await load("src/lib/ict-strategy-suite/ictActivateMarketPipeline.ts", "",
  "export { defaultSaveLatestSummary as saveForTest };");
activation.saveForTest({ researchOnly: true, cycleId: "A" });
window.localStorage.fail = true;
activation.saveForTest({ researchOnly: true, cycleId: "B" });
assert.equal(activation.readLatestActivateMarketSummary().cycleId, "B", "stale activation restored");
delete globalThis.window;
console.log("PASS: production cycle and activation quota fallback preserve current memory");

const projection = await load("src/lib/operatorConsole/buildOperatorConsoleSnapshot.ts",
  `const OPERATOR_AUTHORITY = ${JSON.stringify(authority)}; const projectCanonicalTradeGeometry = () => undefined;`,
  "export { researchPlanFor, candidatePlansFor, marketContextsFor };");
const canonical = "mt5_read_only|source-A|USTECH|5m|2|1000|100|2000|101";
const saved = { cycleId: "B", sourceFingerprint: canonical, currentReadEvaluatedAt: "2026-09-18T12:00:00Z",
  currentCandidateId: "candidate-A", currentOpportunitySummary: { topOpportunity: { id: "candidate-A" } },
  candidatePlans: [{ strategyId: "ifvg", candidateId: "candidate-A", setupName: "IFVG", side: "short", actionable: false, blockers: [] }] };
const bound = { cycleId: "B", sourceFingerprint: canonical };
assert.equal(projection.researchPlanFor(saved, `${canonical}|new-tape`, bound).planIdentityStatus, "current");
assert.equal(projection.candidatePlansFor(saved, `${canonical}|new-tape`, bound).length, 1);
assert.equal(projection.researchPlanFor(saved, canonical, { ...bound, sourceFingerprint: "different-source" }).planIdentityStatus, "source_mismatch");
assert.equal(projection.researchPlanFor(saved, canonical, { ...bound, cycleId: "C" }).planIdentityStatus, "stale_cycle");
assert.equal(projection.researchPlanFor({ ...saved, currentCandidateId: "different" }, canonical, bound).planIdentityStatus, "candidate_mismatch");
assert.equal(projection.researchPlanFor(saved, "different-source", {}).planIdentityStatus, "source_mismatch");
console.log("PASS: cycle-bound identity survives tape updates and rejects mismatched identities");

const contextSummary = { ...saved, contextItems: [{ contextId: "context-A", artifactId: "ote", displayName: "OTE", state: "WAITING", executable: false }] };
assert.equal(projection.marketContextsFor(contextSummary, `${canonical}|new-tape`, bound).length, 1);
assert.deepEqual(projection.marketContextsFor(contextSummary, canonical, { ...bound, cycleId: "C" }), []);
assert.deepEqual(projection.marketContextsFor(contextSummary, canonical, { ...bound, sourceFingerprint: "different-source" }), []);
assert.deepEqual(projection.marketContextsFor({ ...contextSummary, cycleId: undefined }, canonical, bound), []);
assert.equal(projection.marketContextsFor(contextSummary, canonical, bound)[0].executable, false);
console.log("PASS: context-only rows preserve bound identity and reject stale cycles/sources");

globalThis.__guard = await load("src/lib/operatorConsole/operatorCycleGuard.ts");
let releaseActivation;
globalThis.__activation = new Promise((resolve) => { releaseActivation = resolve; });
const runner = await load("src/lib/operatorConsole/operatorCycle.ts", `
  const OPERATOR_AUTHORITY = ${JSON.stringify(authority)};
  const ifvgShallowRetestV4FrozenProfile = {profileId:'test'};
  const { awaitOperatorAbort, createOperatorCycleGuard } = globalThis.__guard;
  const ensureMt5CanonicalResearchSource = () => globalThis.__activation;
`);
const pending = runner.runOperatorResearchCycle({});
assert.equal(runner.readOperatorCycleState().stage, "activating_source");
runner.stopOperatorResearchCycle();
assert.equal((await pending).status, "canceled");
releaseActivation({ ok: false, message: "late result", source: {} });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(runner.readOperatorCycleState().status, "canceled");
assert.notEqual(runner.readOperatorCycleState().message, "late result");
delete globalThis.__guard;
delete globalThis.__activation;
console.log("PASS: real operator cancels a hung activation and ignores late completion");
