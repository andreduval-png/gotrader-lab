#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const authorityNone = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

const mode = process.argv.includes("--status-only")
  ? "status"
  : process.argv.includes("--sync-only")
    ? "sync"
    : process.argv.includes("--real-integration")
      ? "real"
      : "test";

if (mode === "status" || mode === "sync") {
  const endpoint = "http://127.0.0.1:8799";
  const route = mode === "status" ? "/v1/status" : "/v1/sync";
  const response = await fetch(`${endpoint}${route}`, {
    method: mode === "sync" ? "POST" : "GET",
    headers: mode === "sync" ? { "Content-Type": "application/json" } : undefined
  });
  const payload = await response.json();
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = response.ok ? 0 : 1;
} else if (mode === "real") {
  const reservePort = () => new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
  const run = (command, args, env) => new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", (error) =>
      resolve({ ok: false, stdout: "", stderr: error.message })
    );
    child.on("exit", (exitCode) =>
      resolve({
        ok: exitCode === 0,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      })
    );
  });
  const firstExisting = async (candidates) => {
    for (const candidate of candidates.filter(Boolean)) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // Try the next known Bun location.
      }
    }
    return null;
  };

  const sidecarRuntimeRoot = path.join(repoRoot, ".gotrader", "gbrain-sidecar");
  const vendorCli = path.join(sidecarRuntimeRoot, "vendor", "gbrain", "src", "cli.ts");
  const bun = await firstExisting([
    process.env.BUN_COMMAND,
    path.join(os.homedir(), ".bun", "bin", process.platform === "win32" ? "bun.exe" : "bun"),
    path.join(
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
      "npm",
      "node_modules",
      "bun",
      "bin",
      process.platform === "win32" ? "bun.exe" : "bun"
    )
  ]);
  assert.ok(bun, "Bun is required. Run npm.cmd run gbrain:setup -- --install.");
  await fs.access(vendorCli);

  const port = await reservePort();
  const testRoot = path.join(repoRoot, ".gotrader", `gbrain-real-test-${Date.now()}`);
  const gbrainHome = path.join(testRoot, "gbrain-home");
  const runtimeEnv = {
    ...process.env,
    GBRAIN_HOME: gbrainHome,
    GBRAIN_NO_UPDATE_CHECK: "1"
  };
  await fs.mkdir(testRoot, { recursive: true });
  const initialization = await run(
    bun,
    [vendorCli, "init", "--pglite", "--no-embedding", "--json"],
    runtimeEnv
  );
  assert.equal(initialization.ok, true, initialization.stderr || initialization.stdout);
  const keywordOnly = await run(
    bun,
    [vendorCli, "config", "set", "search.mcp_keyword_only", "true"],
    runtimeEnv
  );
  assert.equal(keywordOnly.ok, true, keywordOnly.stderr || keywordOnly.stdout);

  const spawnSidecar = () => spawn(
    process.execPath,
    [path.join(repoRoot, "scripts", "gbrain-local-sidecar.mjs")],
    {
      cwd: repoRoot,
      env: {
        ...runtimeEnv,
        GOTRADER_GBRAIN_PORT: String(port),
        GOTRADER_GBRAIN_DATA_DIR: testRoot,
        GOTRADER_GBRAIN_VENDOR_CLI: vendorCli
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    }
  );
  let child = spawnSidecar();
  const childOutput = [];
  const collectChildOutput = (nextChild) => {
    nextChild.stdout.on("data", (chunk) => childOutput.push(String(chunk)));
    nextChild.stderr.on("data", (chunk) => childOutput.push(String(chunk)));
  };
  collectChildOutput(child);
  const endpoint = `http://127.0.0.1:${port}`;
  const waitForHealth = async () => {
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${endpoint}/health`);
        if (response.ok) return response.json();
      } catch {
        // Sidecar is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`gbrain sidecar did not start.\n${childOutput.join("")}`);
  };

  try {
    const health = await waitForHealth();
    assert.equal(health.status, "ready");
    assert.equal(health.gbrainBackend, "pglite");
    assert.equal(health.gbrainInitialized, true);
    assert.equal(health.advisoryOnly, true);
    assert.equal(health.nativeEvidenceAuthoritative, true);
    assert.equal(health.productionAdoptionAllowed, false);

    const document = {
      documentId: "gbrain_document_real_integration",
      path: "gotrader/integration/real-sidecar-acceptance.md",
      title: "GoTrader real gbrain sidecar acceptance",
      markdown: [
        "# GoTrader real gbrain sidecar acceptance",
        "",
        "Durable retrieval marker: alpha-context-8799.",
        "",
        "Authority remains none."
      ].join("\n"),
      tags: ["gotrader", "integration", "research-memory"],
      sourceFingerprint: "mt5:USTECH:5m:integration",
      cycleId: "real_integration",
      generatedAt: new Date().toISOString(),
      authority: authorityNone
    };
    const ingestResponse = await fetch(`${endpoint}/v1/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(document)
    });
    assert.equal(ingestResponse.ok, true);
    const ingest = await ingestResponse.json();
    assert.equal(ingest.indexStatus, "indexed");

    const searchResponse = await fetch(`${endpoint}/v1/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "alpha-context-8799", limit: 5 })
    });
    assert.equal(searchResponse.ok, true);
    const search = await searchResponse.json();
    assert.equal(search.backend, "gbrain_pglite_keyword");
    assert.ok(search.results.length >= 1);
    assert.deepEqual(search.authority, authorityNone);

    const status = await (await fetch(`${endpoint}/v1/status`)).json();
    assert.equal(status.durableDocumentCount, 1);
    assert.equal(status.indexedDocumentCount, 1);
    assert.equal(status.pendingDocumentCount, 0);

    child.kill();
    await new Promise((resolve) => child.once("exit", resolve));
    child = spawnSidecar();
    collectChildOutput(child);
    const restartedHealth = await waitForHealth();
    assert.equal(restartedHealth.gbrainInitialized, true);
    const restartedSearchResponse = await fetch(`${endpoint}/v1/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "alpha-context-8799", limit: 5 })
    });
    assert.equal(restartedSearchResponse.ok, true);
    const restartedSearch = await restartedSearchResponse.json();
    assert.ok(restartedSearch.results.length >= 1, "PGLite retrieval must survive sidecar restart");

    console.log(JSON.stringify({
      status: "passed",
      checks: [
        "disposable PGLite brain initializes without embeddings or API spend",
        "sidecar invokes vendored gbrain directly through Bun",
        "compact GoTrader memory is captured into gbrain",
        "keyword retrieval returns the indexed memory",
        "sidecar restart preserves PGLite retrieval",
        "authority remains none/none/none"
      ],
      backend: search.backend,
      durableDocumentCount: status.durableDocumentCount,
      indexedDocumentCount: status.indexedDocumentCount,
      authority: authorityNone
    }, null, 2));
  } finally {
    child.kill();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await fs.rm(testRoot, { recursive: true, force: true });
  }
} else {
  const reservePort = () => new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });

  const port = await reservePort();
  const testRoot = path.join(repoRoot, ".gotrader", `gbrain-sidecar-test-${Date.now()}`);
  const child = spawn(process.execPath, [path.join(repoRoot, "scripts", "gbrain-local-sidecar.mjs")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      GOTRADER_GBRAIN_PORT: String(port),
      GOTRADER_GBRAIN_DATA_DIR: testRoot,
      GBRAIN_COMMAND: path.join(testRoot, "missing-gbrain-command")
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  const childOutput = [];
  child.stdout.on("data", (chunk) => childOutput.push(String(chunk)));
  child.stderr.on("data", (chunk) => childOutput.push(String(chunk)));

  const endpoint = `http://127.0.0.1:${port}`;
  const waitForHealth = async () => {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${endpoint}/health`);
        if (response.ok) return response.json();
      } catch {
        // Sidecar is still starting.
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`gbrain sidecar did not start.\n${childOutput.join("")}`);
  };

  try {
    const health = await waitForHealth();
    assert.equal(health.provider, "gbrain_local");
    assert.equal(health.status, "degraded_spool_only");
    assert.equal(health.gbrainCliInstalled, false);
    assert.equal(health.advisoryOnly, true);
    assert.equal(health.nativeEvidenceAuthoritative, true);
    assert.equal(health.productionAdoptionAllowed, false);
    assert.deepEqual(health.authority, authorityNone);

    const document = {
      documentId: "gbrain_document_test_cycle_001",
      path: "gotrader/research-cycle/test_cycle_001.md",
      title: "GoTrader research cycle test_cycle_001",
      markdown: [
        "# GoTrader research cycle test_cycle_001",
        "",
        "## Summary",
        "IFVG v3 preserved positive out-of-sample expectancy.",
        "",
        "## Blockers",
        "- Needs additional forward evidence.",
        "",
        "## Safety",
        "- executionAuthority: none",
        "- brokerAuthority: none",
        "- readinessOverrideAuthority: none"
      ].join("\n"),
      tags: ["gotrader", "research_cycle", "ifvg-v3"],
      sourceFingerprint: "mt5:USTECH:5m:test",
      cycleId: "test_cycle_001",
      generatedAt: "2026-07-24T12:00:00.000Z",
      authority: authorityNone
    };

    const ingest = await fetch(`${endpoint}/v1/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(document)
    });
    const ingestPayload = await ingest.json();
    assert.equal(ingest.ok, true, JSON.stringify(ingestPayload));
    assert.equal(ingestPayload.status, "stored");
    assert.equal(ingestPayload.indexStatus, "pending");
    assert.deepEqual(ingestPayload.authority, authorityNone);

    const duplicate = await fetch(`${endpoint}/v1/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(document)
    });
    assert.equal(duplicate.ok, true);

    const unsafe = await fetch(`${endpoint}/v1/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...document,
        documentId: "gbrain_document_unsafe",
        path: "gotrader/research-cycle/unsafe.md",
        rawCandles: [{ open: 1 }],
        authority: { ...authorityNone, brokerAuthority: "read_only" }
      })
    });
    assert.equal(unsafe.status, 422);
    const unsafePayload = await unsafe.json();
    assert.equal(unsafePayload.status, "blocked_unsafe_document");
    assert.ok(unsafePayload.blockedFields.includes("document.rawCandles"));
    assert.ok(unsafePayload.blockedFields.includes("document.authority"));

    const search = await fetch(`${endpoint}/v1/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "IFVG expectancy", limit: 5 })
    });
    assert.equal(search.ok, true);
    const searchPayload = await search.json();
    assert.equal(searchPayload.backend, "spool_keyword");
    assert.equal(searchPayload.results.length, 1);
    assert.equal(JSON.stringify(searchPayload.results).includes("rawCandles"), false);
    assert.deepEqual(searchPayload.authority, authorityNone);

    const status = await (await fetch(`${endpoint}/v1/status`)).json();
    assert.equal(status.durableDocumentCount, 1);
    assert.equal(status.indexedDocumentCount, 0);
    assert.equal(status.pendingDocumentCount, 1);
    assert.deepEqual(status.authority, authorityNone);

    for (const route of ["/execute", "/account", "/orders", "/positions"]) {
      const response = await fetch(`${endpoint}${route}`, { method: "POST" });
      assert.equal(response.status, 404);
      const payload = await response.json();
      assert.deepEqual(payload.authority, authorityNone);
    }

    const storedDocument = await fs.readFile(
      path.join(testRoot, "documents", "gotrader", "research-cycle", "test_cycle_001.md"),
      "utf8"
    );
    assert.ok(storedDocument.includes("IFVG v3"));
    assert.equal(storedDocument.includes("rawCandles"), false);

    const packageJson = await fs.readFile(path.join(repoRoot, "package.json"), "utf8");
    const localStack = await fs.readFile(path.join(repoRoot, "scripts", "local-stack-utils.mjs"), "utf8");
    const startStack = await fs.readFile(path.join(repoRoot, "scripts", "start-local-stack.mjs"), "utf8");
    const cycleSource = await fs.readFile(
      path.join(repoRoot, "src", "lib", "researchCycle", "runResearchCycle.ts"),
      "utf8"
    );
    const operatorSource = await fs.readFile(
      path.join(repoRoot, "src", "components", "operator", "OperatorConsoleView.tsx"),
      "utf8"
    );
    const selfImprovementSource = await fs.readFile(
      path.join(
        repoRoot,
        "src",
        "components",
        "self-improvement",
        "ResearchEvidenceMemoryCard.tsx"
      ),
      "utf8"
    );
    assert.match(packageJson, /"gbrain:sidecar"/);
    assert.match(localStack, /port:\s*8799/);
    assert.match(startStack, /"gbrain-sidecar"/);
    assert.match(cycleSource, /syncGbrainResearchMemory/);
    assert.match(operatorSource, /operator-gbrain-memory-status/);
    assert.match(selfImprovementSource, /gbrain-memory-search-results/);

    console.log(JSON.stringify({
      status: "passed",
      checks: [
        "loopback sidecar starts in durable spool-only mode when gbrain is unavailable",
        "compact research memory is persisted atomically",
        "duplicate documents remain deduplicated",
        "unsafe authority and raw candle fields are blocked",
        "keyword retrieval works from the durable spool",
        "research cycles, unified startup, Operator Console, and Self-Improvement are wired",
        "execution/account/order/position routes do not exist",
        "authority remains none/none/none"
      ],
      durableDocumentCount: status.durableDocumentCount,
      indexedDocumentCount: status.indexedDocumentCount,
      authority: authorityNone
    }, null, 2));
  } finally {
    child.kill();
    await new Promise((resolve) => setTimeout(resolve, 150));
    await fs.rm(testRoot, { recursive: true, force: true });
  }
}
