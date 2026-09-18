#!/usr/bin/env node

import assert from "node:assert/strict";
import { createServer } from "vite";
import net from "node:net";
import { chromium } from "@playwright/test";

const freePort = () => new Promise((resolve, reject) => {
  const socket = net.createServer();
  socket.once("error", reject);
  socket.listen(0, "127.0.0.1", () => {
    const address = socket.address();
    socket.close(() => resolve(address.port));
  });
});

const waitForServer = async (url) => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
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
    const response = await page.goto(`${baseUrl}/dashboard?acceptanceScenario=rc1c-plan-first`, { waitUntil: "domcontentloaded" });
    assert.equal(response.status(), 200);
    await page.getByTestId("operator-research-coverage").waitFor({ timeout: 60_000 });
    await page.getByText("Canonical producer geometry.", { exact: true }).waitFor({ timeout: 60_000 });

    const plan = await page.getByTestId("operator-research-risk-preview").innerText();
    const liveRows = page.getByTestId("operator-live-owner-research-rows").locator("[data-owner-strategy]");
    const researchOnly = await page.getByTestId("operator-research-only-lane").innerText();
    assert.match(plan, /ICT 2022/i);
    assert.match(plan, /100\.50[\s\S]*105\.00[\s\S]*89\.00[\s\S]*2\.56R/i);
    assert.match(plan, /current/i);
    assert.equal(await liveRows.count(), 5);
    assert.match(await page.getByTestId("operator-live-owner-research-rows").innerText(), /MMBM[\s\S]*blocked/i);
    assert.match(researchOnly, /IFVG v4[\s\S]*running/i);
    assert.equal(await page.getByTestId("operator-canonical-conflict").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(JSON.stringify({ status: "passed", scenario: "rc1c-plan-first", liveOwners: 5, viewports: ["desktop", "mobile"], authority: "none/none/none" }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
