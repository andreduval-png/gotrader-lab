#!/usr/bin/env node

import assert from "node:assert/strict";
import { createServer } from "vite";
import fs from "node:fs/promises";
import net from "node:net";
import { chromium } from "@playwright/test";

const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(() => resolve(address.port));
  });
});

const waitForServer = async (url) => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
};

const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = await createServer({
  cacheDir: ".gotrader/p2-vite-cache",
  server: { host: "127.0.0.1", port, strictPort: true },
  plugins: [{ name: "isolate-acceptance-network", configResolved(config) { config.server.proxy = {}; } }]
});

let browser;
try {
  await server.listen();
  await waitForServer(`${baseUrl}/dashboard`);
  browser = await chromium.launch({ headless: true });

  const ordinaryContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ordinaryPage = await ordinaryContext.newPage();
  const ordinaryResponse = await ordinaryPage.goto(`${baseUrl}/dashboard?int3a1Fixture=conflict`, { waitUntil: "domcontentloaded" });
  assert.equal(ordinaryResponse.status(), 200);
  assert.equal(await ordinaryPage.getByTestId("operator-canonical-conflict").count(), 0, "old final-snapshot fixture must not paint conflict");
  await ordinaryContext.close();

  const requiredTrace = [
    "assessIctIfvgFreshRetestV3",
    "adaptIfvgNativeGeometry",
    "evaluateIct2022Model",
    "G1.1 canonical geometry",
    "Current Read production builder",
    "detectCurrentOpportunities",
    "buildCanonicalRuntimeCandidateSet",
    "signal-contract builder",
    "Activate Market production pipeline",
    "buildOperatorConsoleSnapshot"
  ];

  for (const viewport of [{ name: "desktop", width: 1440, height: 1100 }, { name: "mobile", width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return url.origin === baseUrl && !url.pathname.startsWith("/gotrader-research-mcp")
        ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    const response = await page.goto(`${baseUrl}/dashboard?acceptanceScenario=int3a2-live-conflict`, { waitUntil: "domcontentloaded" });
    assert.equal(response.status(), 200);
    await page.getByTestId("operator-canonical-conflict").waitFor({ timeout: 60_000 });

    const conflict = await page.getByTestId("operator-canonical-conflict").innerText();
    const candidates = await page.getByTestId("operator-canonical-candidates").innerText();
    const contexts = await page.getByTestId("operator-market-contexts").innerText();
    assert.match(conflict, /IFVG.*LONG/i);
    assert.match(conflict, /ICT 2022.*SHORT/i);
    assert.match(candidates, /E 95\.0000[\s\S]*S 93\.9095[\s\S]*T 98\.6000/);
    assert.match(candidates, /E 100\.50[\s\S]*S 105\.00[\s\S]*T 89\.0000[\s\S]*2\.56R/);
    assert.match(contexts, /Unicorn[\s\S]*OTE[\s\S]*Opening Gap/i);
    assert.match(contexts, /Context only/i);
    const charter = page.getByTestId("operator-charter-profiles");
    assert.equal(await charter.getAttribute("open"), null, "profile inventory should be collapsed by default");
    await charter.locator("summary").click();
    assert.equal(await charter.locator("[data-charter-model]").count(), 12);
    assert.match(await charter.innerText(), /Owner attribution only/);
    assert.match(await charter.locator('[data-charter-model="5"]').innerText(), /source blocked/i);
    assert.equal(await page.getByTestId("operator-plan-probability").count(), 0);
    assert.equal(await page.getByText("Conflict / context only", { exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    const trace = await page.evaluate(() => window.__GOTRADER_INT3A2_TRACE__);
    requiredTrace.forEach((step) => assert.ok(trace.includes(step), `missing runtime trace step ${step}`));
    assert.deepEqual(errors, []);
    await fs.mkdir(".gotrader/p2-browser", { recursive: true });
    await page.screenshot({ path: `.gotrader/p2-browser/${viewport.name}.png`, fullPage: true });
    await context.close();
  }

  console.log(JSON.stringify({ status: "passed", scenario: "int3a2-live-conflict", viewports: ["desktop", "mobile"], authority: "none/none/none" }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
