import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code = ts.transpileModule(fs.readFileSync("src/lib/operatorConsole/operatorCycleGuard.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { createOperatorCycleGuard, awaitOperatorAbort } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
const never = new Promise(() => {});
const stalled = new AbortController();
const guard = createOperatorCycleGuard(stalled, { stallMs: 10, totalMs: 1000 });
await assert.rejects(awaitOperatorAbort(never, stalled.signal), (reason) => reason === "operator_timeout");
guard.dispose();
const busy = new AbortController();
const bounded = createOperatorCycleGuard(busy, { stallMs: 100, totalMs: 30 });
const progress = setInterval(bounded.progress, 2);
try {
  await assert.rejects(awaitOperatorAbort(never, busy.signal), (reason) => reason === "operator_timeout");
} finally { clearInterval(progress); bounded.dispose(); }
const stopped = new AbortController();
stopped.abort("operator_stop_requested");
await assert.rejects(awaitOperatorAbort(Promise.resolve("late"), stopped.signal), (reason) => reason === "operator_stop_requested");
const success = new AbortController();
const completed = createOperatorCycleGuard(success, { stallMs: 10, totalMs: 20 });
assert.equal(await awaitOperatorAbort(Promise.resolve("ok"), success.signal), "ok");
completed.dispose();
await new Promise((resolve) => setTimeout(resolve, 30));
assert.equal(success.signal.aborted, false);
console.log("PASS: stall, absolute deadline, pre-abort and timer cleanup");

const clientSource = fs.readFileSync("src/lib/integrations/mt5/mt5ReadOnlyClient.ts", "utf8");
const ast = ts.createSourceFile("client.ts", clientSource, ts.ScriptTarget.Latest, true);
const fetchNode = ast.statements.find((node) => ts.isVariableStatement(node) &&
  node.declarationList.declarations.some((item) => item.name.getText(ast) === "fetchJson"));
const clientCode = ts.transpileModule(`const REQUEST_TIMEOUT_MS = 1000; ${fetchNode.getText(ast)}; export { fetchJson };`, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
const { fetchJson } = await import(`data:text/javascript;base64,${Buffer.from(clientCode).toString("base64")}`);
const originalFetch = globalThis.fetch;
let underlyingAborted = false;
globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
  signal.addEventListener("abort", () => { underlyingAborted = true; reject(signal.reason); }, { once: true });
});
try {
  const canceledFetch = new AbortController();
  const request = fetchJson("http://fixture.invalid", canceledFetch.signal);
  canceledFetch.abort("operator_stop_requested");
  await assert.rejects(request, (reason) => reason === "operator_stop_requested");
  assert.equal(underlyingAborted, true);
} finally { globalThis.fetch = originalFetch; }
console.log("PASS: production MT5 fetch receives cancellation");

const rangeNames = new Set(["fetchMt5CandlesByDateRange", "fetchMt5CandlesInChunks", "dateRangeWindows", "parseDateOrUndefined"]);
const rangeNodes = ast.statements.filter((node) =>
  (ts.isFunctionDeclaration(node) && rangeNames.has(node.name?.text)) ||
  (ts.isVariableStatement(node) && node.declarationList.declarations.some((item) => rangeNames.has(item.name.getText(ast)))));
const rangeCode = ts.transpileModule(`
  const REQUEST_TIMEOUT_MS = 1000;
  const selectedBrokerSymbol = () => 'USTECH';
  const endpoint = () => 'http://fixture.invalid/candles/range';
  ${fetchNode.getText(ast)}
  ${rangeNodes.map((node) => node.getText(ast)).join('\n')}
`, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const rangeClient = await import(`data:text/javascript;base64,${Buffer.from(rangeCode).toString("base64")}`);
let rangeCalls = 0;
globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
  rangeCalls += 1;
  signal.addEventListener("abort", () => reject(signal.reason), { once: true });
});
try {
  const cancel = new AbortController();
  const range = rangeClient.fetchMt5CandlesInChunks({ symbol: "MNQ", timeframe: "5m", lookbackDays: 90, chunkDays: 10 }, {}, cancel.signal);
  cancel.abort("operator_stop_requested");
  await assert.rejects(range, (reason) => reason === cancel.signal.reason);
  assert.equal(rangeCalls, 1, "range abort must not become a disconnected response or start the next chunk");
} finally { globalThis.fetch = originalFetch; }
console.log("PASS: history-chunk abort propagates and stops subsequent requests");
