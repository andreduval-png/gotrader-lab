#!/usr/bin/env node

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";

const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });

const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

let candleRequestCount = 0;
let transientFailureCount = 0;
const candle = {
  timestamp: "2026-07-20T00:00:00.000Z",
  open: 28000,
  high: 28010,
  low: 27990,
  close: 28005,
  volume: 100
};

const upstream = createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  response.setHeader("content-type", "application/json");
  if (url.pathname === "/health" || url.pathname === "/status") {
    response.end(JSON.stringify({ connectionStatus: "connected", readOnly: true, ...authority }));
    return;
  }
  if (url.pathname === "/candles" || url.pathname === "/api/v1/market/candles/latest") {
    candleRequestCount += 1;
    if (transientFailureCount === 0) {
      transientFailureCount += 1;
      response.statusCode = 503;
      response.end(JSON.stringify({ error: "transient_mt5_ipc_failure", ...authority }));
      return;
    }
    response.end(JSON.stringify([candle, { ...candle, timestamp: "2026-07-20T00:05:00.000Z" }]));
    return;
  }
  if (url.pathname.includes("candles/range") || url.pathname.includes("candles/by-date")) {
    response.end(JSON.stringify({ candles: [candle], ...authority }));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ error: "not_found", ...authority }));
});

const upstreamPort = await listen(upstream);
const portProbe = createServer();
const bridgePort = await listen(portProbe);
await new Promise((resolve) => portProbe.close(resolve));

const bridge = spawn(process.execPath, ["scripts/start-mt5-readonly-bridge.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    MT5_READONLY_BRIDGE_HOST: "127.0.0.1",
    MT5_READONLY_BRIDGE_PORT: String(bridgePort),
    MT5_READONLY_UPSTREAM_BASE_URL: `http://127.0.0.1:${upstreamPort}`,
    MT5_READONLY_UPSTREAM_READ_ATTEMPTS: "2",
    MT5_READONLY_UPSTREAM_RETRY_DELAY_MS: "50"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let bridgeOutput = "";
bridge.stdout.on("data", (chunk) => {
  bridgeOutput += chunk.toString();
});
bridge.stderr.on("data", (chunk) => {
  bridgeOutput += chunk.toString();
});

const bridgeUrl = `http://127.0.0.1:${bridgePort}`;
const waitForBridge = async () => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${bridgeUrl}/tool-policy?tool=status`);
      if (response.ok) return;
    } catch {
      // Startup polling only.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Bridge did not start. Output: ${bridgeOutput}`);
};

try {
  await waitForBridge();
  const statusResponse = await fetch(`${bridgeUrl}/status`);
  const status = await statusResponse.json();
  const candlesResponse = await fetch(`${bridgeUrl}/candles?requestedSymbol=MNQ&symbol=USTECH&timeframe=5m&limit=2`);
  const candles = await candlesResponse.json();
  const mutationResponse = await fetch(`${bridgeUrl}/candles`, { method: "POST" });
  const mutation = await mutationResponse.json();

  const passed =
    statusResponse.ok &&
    status.connectionStatus === "connected" &&
    status.latestEndpointAvailable === true &&
    transientFailureCount === 1 &&
    candleRequestCount >= 2 &&
    candlesResponse.ok &&
    candles.returnedCount === 2 &&
    mutationResponse.status === 405 &&
    mutation.executionAuthority === "none" &&
    [status, candles, mutation].every(
      (payload) =>
        payload.executionAuthority === "none" &&
        payload.brokerAuthority === "none" &&
        payload.readinessOverrideAuthority === "none"
    );

  console.log(JSON.stringify({
    passed,
    transientFailureCount,
    candleRequestCount,
    wrapperStatus: status.connectionStatus,
    latestEndpointAvailable: status.latestEndpointAvailable,
    returnedCount: candles.returnedCount,
    mutationStatus: mutationResponse.status,
    authority
  }, null, 2));
  if (!passed) process.exitCode = 1;
} finally {
  bridge.kill("SIGTERM");
  await Promise.race([once(bridge, "exit"), new Promise((resolve) => setTimeout(resolve, 2000))]);
  await new Promise((resolve) => upstream.close(resolve));
}
