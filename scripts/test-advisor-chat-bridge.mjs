#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const sourcePath = path.join(projectRoot, "src", "lib", "llm", "advisorChat.ts");
const outRoot = path.join(projectRoot, ".gotrader", "advisor-chat-bridge-test");

function compileForNode() {
  fs.rmSync(outRoot, { recursive: true, force: true });
  fs.mkdirSync(outRoot, { recursive: true });
  const source = fs.readFileSync(sourcePath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      verbatimModuleSyntax: false
    },
    fileName: sourcePath
  }).outputText
    .replace('from "@/lib/llm/localBridgeClient"', 'from "./localBridgeClient.stub.mjs"')
    .replace('from "@/lib/validationChain"', 'from "./validationChain.stub.mjs"');

  fs.writeFileSync(
    path.join(outRoot, "localBridgeClient.stub.mjs"),
    "export const runLocalBridgeChat = async (packet) => { globalThis.__advisorChatPacket = packet; return globalThis.__advisorChatBridgeResult; };\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(outRoot, "validationChain.stub.mjs"),
    "export const latestValidationChainEntry = () => undefined;\n",
    "utf8"
  );
  const outPath = path.join(outRoot, "advisorChat.mjs");
  fs.writeFileSync(outPath, transpiled, "utf8");
  return outPath;
}

const contextFixture = () => ({
  prompt: "Explain why this setup is blocked without changing readiness.",
  conversation: Array.from({ length: 10 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `compact message ${index}`
  })),
  currentRead: {
    dataStatus: "active",
    side: "short",
    bestSetup: "ifvg",
    approvedStatus: "rejected",
    riskStatus: "clear",
    smtStatus: "insufficient_data",
    topReasons: ["RR below threshold"],
    nextAction: "Run replay validation.",
    opportunityDetected: true,
    opportunityBlockers: ["RR below threshold"]
  },
  snapshot: {
    marketData: {
      symbol: "MNQ",
      timeframe: "5m",
      activeResearchSource: {
        provider: "mt5_read_only",
        candleCount: 1000,
        fingerprint: "safe-fingerprint",
        provenance: { providerSymbol: "USTECH" },
        eligibility: { chartDisplay: true, researchCycle: true }
      }
    },
    readiness: { readinessState: "Not Ready" },
    walkForward: { verdict: "unavailable" },
    evidence: { evidenceQualityScore: 45 }
  },
  manualReplayStatus: "idle",
  marketScorecardStatus: "idle",
  profileOptimizationStatus: "idle"
});

function collectKeys(value, keys = []) {
  if (!value || typeof value !== "object") return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.push(key.toLowerCase());
    collectKeys(child, keys);
  }
  return keys;
}

async function main() {
  const outPath = compileForNode();
  const { buildAdvisorChatPacket, runAdvisorChatWithFallback } = await import(pathToFileURL(outPath).href);
  const context = contextFixture();
  const packet = buildAdvisorChatPacket(context);

  assert.equal(packet.source, "gotrader_ai_lab");
  assert.equal(packet.mode, "advisory_only");
  assert.ok(packet.packetId.startsWith("advisor_chat_"));
  assert.ok(packet.timestamp);
  assert.ok(Array.isArray(packet.safetyConstraints));
  assert.equal(packet.executionAuthority, "none");
  assert.equal(packet.brokerAuthority, "none");
  assert.equal(packet.readinessOverrideAuthority, "none");
  assert.equal(packet.sourceContext.provider, "mt5_read_only");
  assert.equal(packet.sourceContext.brokerSymbol, "USTECH");
  assert.equal(packet.conversation.length, 8, "conversation history must stay bounded");

  const keys = collectKeys(packet);
  for (const forbidden of ["candles", "rawcandles", "account", "orders", "positions", "apikey", "token", "password"]) {
    assert.equal(keys.includes(forbidden), false, `packet must exclude ${forbidden}`);
  }

  globalThis.__advisorChatBridgeResult = {
    advisoryStatus: "available",
    result: { reply: "Specific LLM response.", bias: "neutral", confidence: 0.5 },
    model: "test-model"
  };
  const online = await runAdvisorChatWithFallback(context, () => "fallback");
  assert.equal(online.source, "llm-online");
  assert.equal(online.text, "Specific LLM response.");
  assert.equal(online.model, "test-model");
  assert.equal(globalThis.__advisorChatPacket.source, "gotrader_ai_lab");

  globalThis.__advisorChatBridgeResult = {
    advisoryStatus: "unavailable",
    reason: "timeout",
    confidence: 0,
    warnings: ["LLM request timed out."],
    details: []
  };
  const fallback = await runAdvisorChatWithFallback(context, () => "deterministic response");
  assert.equal(fallback.source, "deterministic-fallback");
  assert.equal(fallback.text, "deterministic response");
  assert.equal(fallback.fallbackReason, "LLM request timed out.");

  const advisorView = fs.readFileSync(
    path.join(projectRoot, "src", "components", "advisor", "ResearchAdvisorView.tsx"),
    "utf8"
  );
  const workspaceSummary = fs.readFileSync(
    path.join(projectRoot, "src", "components", "advisor", "AdvisorWorkspaceSummary.tsx"),
    "utf8"
  );
  assert.match(advisorView, /LLM thinking\.\.\./);
  assert.match(advisorView, /source=\{message\.source\}/);
  assert.match(workspaceSummary, /checkLocalBridgeHealth/);
  assert.doesNotMatch(advisorView, /createAdvisorMessage\("assistant", `\$\{sourceNote\}/);

  console.log("Advisor chat bridge contract test passed.");
  console.log("- required bridge envelope present");
  console.log("- compact conversation history bounded to 8 messages");
  console.log("- LLM and deterministic fallback provenance stay explicit");
  console.log("- raw candles, credentials, account/order/position data excluded");
  console.log("- authority remains none/none/none");
}

main().catch((error) => {
  console.error("Advisor chat bridge contract test failed:", error);
  process.exitCode = 1;
});
