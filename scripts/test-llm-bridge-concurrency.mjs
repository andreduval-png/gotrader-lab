#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const testRoot = path.join(root, ".gotrader", "llm-bridge-concurrency-test");
const providerPath = path.join(testRoot, "mock-provider.mjs");
const responseDir = path.join(testRoot, "latest");
const port = 8796;

const mockProvider = `
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) raw += chunk;
const packet = JSON.parse(raw);
await new Promise((resolve) => setTimeout(resolve, Number(packet.testDelayMs ?? 0)));
const outputFile = valueAfter("--output-file");
await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, JSON.stringify({ requestId: packet.requestId }), "utf8");
`;

const packetFor = (requestId, testDelayMs) => ({
  source: "gotrader_ai_lab",
  mode: "advisory_only",
  packetId: `packet_${requestId}`,
  requestId,
  testDelayMs,
  safetyConstraints: ["advisory only", "no execution"],
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

async function waitForHealth() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      // The child may still be binding the loopback port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for the isolated LLM bridge test server.");
}

async function runRequest(requestId, delay) {
  const response = await fetch(`http://127.0.0.1:${port}/llm/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(packetFor(requestId, delay))
  });
  const payload = await response.json();
  assert.equal(response.status, 200, JSON.stringify(payload));
  assert.equal(payload.result.requestId, requestId);
  assert.equal(payload.executionAuthority, "none");
  assert.equal(payload.brokerAuthority, "none");
  assert.equal(payload.readinessOverrideAuthority, "none");
  return payload;
}

async function main() {
  await fs.rm(testRoot, { recursive: true, force: true });
  await fs.mkdir(testRoot, { recursive: true });
  await fs.writeFile(providerPath, mockProvider, "utf8");

  const child = spawn(
    process.execPath,
    [path.join(root, "scripts", "llm-local-bridge-server.mjs"), "--port", String(port)],
    {
      cwd: root,
      env: {
        ...process.env,
        OPENAI_API_KEY: "test-key-never-sent",
        LLM_ADVISORY_PROVIDER_SCRIPT: providerPath,
        LLM_ADVISORY_RESPONSE_DIR: responseDir,
        LLM_ADVISORY_TIMEOUT_MS: "10000"
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    }
  );

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  try {
    await waitForHealth();
    const [slow, fast] = await Promise.all([
      runRequest("slow-request", 250),
      runRequest("fast-request", 25)
    ]);
    assert.equal(slow.result.requestId, "slow-request");
    assert.equal(fast.result.requestId, "fast-request");

    const latest = JSON.parse(
      await fs.readFile(path.join(responseDir, "latest-llm-chat-response.json"), "utf8")
    );
    assert.ok(["slow-request", "fast-request"].includes(latest.requestId));

    const transientDir = path.join(root, ".gotrader", "llm-bridge", "responses");
    const transientFiles = await fs.readdir(transientDir).catch(() => []);
    assert.equal(
      transientFiles.some((name) => name.includes("slow-request") || name.includes("fast-request")),
      false
    );

    console.log(JSON.stringify({
      status: "passed",
      concurrentRequests: 2,
      isolatedResponses: true,
      latestDiagnosticFileValid: true,
      executionAuthority: "none",
      brokerAuthority: "none",
      readinessOverrideAuthority: "none"
    }, null, 2));
  } finally {
    child.kill();
    await new Promise((resolve) => child.once("close", resolve));
    await fs.rm(testRoot, { recursive: true, force: true });
  }

  if (stderr && !stderr.includes("listening on")) {
    throw new Error(stderr);
  }
}

main().catch((error) => {
  console.error("LLM bridge concurrency test failed:", error);
  process.exitCode = 1;
});
