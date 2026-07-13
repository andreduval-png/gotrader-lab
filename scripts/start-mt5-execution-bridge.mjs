import { createServer } from "node:http";

const host = "127.0.0.1";
const port = Number(process.env.MT5_EXECUTION_BRIDGE_PORT || 7342);

const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);

  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, {
      status: "ok",
      service: "mt5_execution_bridge_disabled",
      stage: "research",
      killSwitchActive: true,
      message: "Execution bridge is disabled. GoTrader is research-only.",
      ...authority
    });
  }

  return sendJson(response, 403, {
    ok: false,
    status: "blocked",
    error: "Execution, account, order, and position operations are disabled.",
    ...authority
  });
});

server.listen(port, host, () => {
  process.stdout.write(
    `[mt5-execution-bridge] disabled safety stub listening on http://${host}:${port}; authority=none/none/none\n`
  );
});
