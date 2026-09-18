import assert from "node:assert/strict";
import path from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";

// Dedicated origin and real source modules; never attach to the user's browser or MT5.
const server = await createServer({
  configFile: false, root: process.cwd(), cacheDir: ".gotrader/p1-vite-cache",
  resolve: { alias: { "@": path.resolve("src") } },
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{ name: "p1-browser-fixture", configureServer(vite) {
    vite.middlewares.use("/__p1", (_req, res) => {
      res.setHeader("Content-Type", "text/html");
      res.end("<!doctype html><title>P1 isolated browser regression</title><body>P1 fixture</body>");
    });
  } }]
});
let browser;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1" && url.port === String(port) ? route.continue() : route.abort();
  });
  await page.goto(`http://127.0.0.1:${port}/__p1`);
  const result = await page.evaluate(async () => {
    const cycleModule = await import("/src/lib/operatorConsole/operatorCycle.ts");
    const { buildOperatorConsoleSnapshot } = await import("/src/lib/operatorConsole/buildOperatorConsoleSnapshot.ts");
    const { createCandleSourceFingerprint } = await import("/src/lib/candleSources/candleSourceFingerprint.ts");
    const { buildMt5ReadOnlyCandleFingerprint } = await import("/src/lib/integrations/mt5/mt5ReadOnlyNormalizer.ts");
    const candles = [
      { timestamp: "2026-09-18T12:00:00Z", open: 100, high: 103, low: 99, close: 101, volume: 1 },
      { timestamp: "2026-09-18T12:05:00Z", open: 101, high: 104, low: 100, close: 102, volume: 1 }
    ];
    const identity = { candles, provider: "mt5_read_only", sourceId: "mt5_read_only:MNQ:USTECH:5m", symbol: "MNQ", timeframe: "5m" };
    const canonical = createCandleSourceFingerprint(identity);
    const feed = buildMt5ReadOnlyCandleFingerprint(candles);
    const changed = createCandleSourceFingerprint({ ...identity, candles: [...candles, { ...candles[1], timestamp: "2026-09-18T12:10:00Z", close: 103 }] });
    const state = { cycleId: "A", status: "completed", stage: "complete", progressPercent: 100, message: "fixture", sourceFingerprint: canonical };
    cycleModule.saveOperatorCycleState(state);
    const original = Storage.prototype.setItem;
    let saved;
    try {
      Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
      cycleModule.saveOperatorCycleState({ ...state, cycleId: "B" });
      saved = cycleModule.readOperatorCycleState();
    } finally { Storage.prototype.setItem = original; }
    const activation = {
      cycleId: "B", sourceFingerprint: canonical, currentReadEvaluatedAt: "2026-09-18T12:05:00Z", researchOnly: true,
      modelName: "Fixture research setup", candidatePlans: []
    };
    const runtime = {
      marketData: { activeResearchSource: { provider: "mt5_read_only", fingerprint: changed, candleCount: 3,
        provenance: { providerSymbol: "USTECH" }, eligibility: { researchCycle: false }, authority: {} } },
      performance: {}, latestResearchCycle: {}, walkForward: {}, readiness: {}, evidence: {}, maturity: {}, proposal: {}
    };
    const snapshot = buildOperatorConsoleSnapshot({ cycle: saved, activation, runtime });
    const wrong = buildOperatorConsoleSnapshot({ cycle: { ...saved, sourceFingerprint: "wrong" }, activation, runtime });
    cycleModule.saveOperatorCycleState({ ...saved, cycleId: "C" });
    return { distinctEncodings: feed !== canonical, tapeChanged: changed !== canonical,
      stored: saved.cycleId, bound: snapshot.researchPlan.planIdentityStatus, wrong: wrong.researchPlan.planIdentityStatus,
      signal: snapshot.researchPlan.signal, executable: snapshot.researchPlan.executionAllowed };
  });
  assert.deepEqual(result, { distinctEncodings: true, tapeChanged: true, stored: "B", bound: "current", wrong: "source_mismatch", signal: "NO_TRADE", executable: false });
  await page.reload();
  const restored = await page.evaluate(async () => {
    const { readOperatorCycleState } = await import("/src/lib/operatorConsole/operatorCycle.ts");
    return readOperatorCycleState().cycleId;
  });
  assert.equal(restored, "C");
  console.log("PASS: Chromium actual-module quota fallback, generated fingerprints, tape drift, mismatch rejection and reload");
} finally {
  if (browser) await browser.close();
  await server.close();
}
