#!/usr/bin/env node

import fs from "node:fs/promises";
import http from "node:http";

const portIndex = process.argv.indexOf("--port");
const stateIndex = process.argv.indexOf("--state");
const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : 0);
const stateFile = stateIndex >= 0 ? process.argv[stateIndex + 1] : undefined;
if (!Number.isInteger(port) || port <= 0 || !stateFile) {
  throw new Error("Fixture market source requires --port and --state.");
}

const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const load = async () => JSON.parse(await fs.readFile(stateFile, "utf8"));
const json = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
};

const server = http.createServer(async (request, response) => {
  try {
    const state = await load();
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    if (request.method !== "GET") {
      json(response, 403, { error: "read_only_fixture", ...authority });
      return;
    }
    if (url.pathname === "/health" || url.pathname === "/status") {
      json(response, 200, {
        status: "healthy",
        connectionStatus: "connected",
        serviceVersion: "gotrader-runtime-test-market-source-v1",
        ...authority
      });
      return;
    }
    if (url.pathname === "/time-contract") {
      json(response, 200, {
        version: "fixture-time-contract-v1",
        currentLiveTimeBasisVerified: state.timeVerified !== false,
        historicalDstPolicyVerified: state.timeVerified !== false,
        providerTimeBasis: state.timeVerified === false ? "unknown" : "utc",
        terminalEvidenceStatus: state.timeVerified === false ? "missing" : "fresh",
        ...authority
      });
      return;
    }
    if (url.pathname === "/quote") {
      json(response, 200, {
        requestedSymbol: "MNQ",
        brokerSymbol: "USTECH",
        timestamp: state.marketTime,
        bid: 100,
        ask: 101,
        ...authority
      });
      return;
    }
    if (url.pathname === "/candles") {
      const timeframe = url.searchParams.get("timeframe") || "1m";
      json(response, 200, {
        requestedSymbol: "MNQ",
        brokerSymbol: "USTECH",
        timeframe,
        candles: state.candlesByTimeframe?.[timeframe] ?? [],
        ...authority
      });
      return;
    }
    json(response, 404, { error: "not_found", ...authority });
  } catch (error) {
    json(response, 503, {
      error: error instanceof Error ? error.message : String(error),
      ...authority
    });
  }
});

server.listen(port, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
