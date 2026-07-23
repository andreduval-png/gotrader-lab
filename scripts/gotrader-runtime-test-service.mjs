#!/usr/bin/env node

import { createServer } from "node:http";

const portIndex = process.argv.indexOf("--port");
const port = Number(portIndex >= 0 ? process.argv[portIndex + 1] : 0);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error("Fixture service requires --port.");
}

const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  response.setHeader("content-type", "application/json");

  if (url.pathname === "/health") {
    response.end(
      JSON.stringify({
        status: "healthy",
        serviceVersion: "gotrader-runtime-test-service-v1",
        ...authority
      })
    );
    return;
  }
  if (url.pathname === "/status") {
    response.end(JSON.stringify({ connectionStatus: "connected", ...authority }));
    return;
  }
  if (url.pathname === "/time-contract") {
    response.end(
      JSON.stringify({
        verificationStatus: "verified",
        providerTimeBasis: "utc",
        historicalDstPolicyVerified: true,
        ...authority
      })
    );
    return;
  }
  if (url.pathname === "/quote") {
    response.end(
      JSON.stringify({
        connectionStatus: "connected",
        requestedSymbol: "MNQ",
        brokerSymbol: "USTECH",
        ...authority
      })
    );
    return;
  }
  if (url.pathname === "/candles") {
    response.end(
      JSON.stringify({
        connectionStatus: "connected",
        candleCount: 2,
        rawCandlesPersisted: false,
        ...authority
      })
    );
    return;
  }

  response.statusCode = 404;
  response.end(JSON.stringify({ error: "not_found", ...authority }));
});

server.listen(port, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
