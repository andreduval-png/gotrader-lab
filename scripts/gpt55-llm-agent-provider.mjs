#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.5";
const DEFAULT_ADVISORY_TIMEOUT_MS = 120_000;

const requiredAgents = [
  {
    agentId: "llm-ict-liquidity-reviewer",
    agentName: "LLM ICT Liquidity Reviewer",
    role: "Review liquidity sweeps, target liquidity, missing liquidity context, and sweep quality."
  },
  {
    agentId: "llm-market-structure-reviewer",
    agentName: "LLM Market Structure Reviewer",
    role: "Review market structure shift, break of structure, displacement, and higher-timeframe bias evidence."
  },
  {
    agentId: "llm-session-timing-reviewer",
    agentName: "LLM Session Timing Reviewer",
    role: "Review session tag, ICT kill zone, time-of-day quality, and session-specific fragility."
  },
  {
    agentId: "llm-risk-reward-reviewer",
    agentName: "LLM Risk/Reward Reviewer",
    role: "Review invalidation, target, average R, drawdown pressure, and stop-model quality."
  },
  {
    agentId: "llm-validation-reviewer",
    agentName: "LLM Validation Reviewer",
    role: "Review validation results, conservative scenario stability, false positives, and confidence calibration."
  },
  {
    agentId: "llm-self-improvement-reviewer",
    agentName: "LLM Self-Improvement Reviewer",
    role: "Suggest calibration improvements that stay simulation-only and change one variable or small grouped set."
  },
  {
    agentId: "llm-cio-synthesis-reviewer",
    agentName: "LLM CIO Synthesis Reviewer",
    role: "Synthesize the advisory review without approving execution or bypassing readiness."
  },
  {
    agentId: "llm-session-levels-reviewer",
    agentName: "LLM Session Levels Reviewer",
    role: "Review prior day/week/month, overnight, Globex, and opening-range levels for meaningful futures liquidity sweeps."
  },
  {
    agentId: "llm-auction-volume-profile-reviewer",
    agentName: "LLM Auction/Volume Profile Reviewer",
    role: "Review VWAP, anchored VWAP, VPOC, VAH, VAL, and acceptance/rejection evidence."
  },
  {
    agentId: "llm-macro-event-risk-reviewer",
    agentName: "LLM Macro Event Risk Reviewer",
    role: "Review scheduled macro risk, Fed speakers, and event proximity that can distort normal ICT behavior."
  },
  {
    agentId: "llm-intermarket-confirmation-reviewer",
    agentName: "LLM Intermarket Confirmation Reviewer",
    role: "Review ES/NQ, YM/ES, VIX, DXY, yields, bonds, crude, and gold context for confirmation or conflict."
  },
  {
    agentId: "llm-positioning-gamma-reviewer",
    agentName: "LLM Positioning/Gamma Reviewer",
    role: "Review COT, put/call, gamma levels, dealer gamma flip, and higher-timeframe positioning risk."
  },
  {
    agentId: "llm-volatility-regime-reviewer",
    agentName: "LLM Volatility Regime Reviewer",
    role: "Review VIX, ATR/range expansion, realized volatility, stop assumptions, and target expectations."
  },
  {
    agentId: "llm-order-flow-planning-reviewer",
    agentName: "LLM Order Flow Planning Reviewer",
    role: "Review missing DOM, footprint, delta, cumulative delta, and large-print evidence as planned later context only."
  },
  {
    agentId: "llm-edge-auditor",
    agentName: "LLM Edge Auditor",
    role: "Review out-of-sample edge statistics, bootstrap expectancy, sample size, and overfitting flags before any calibration is trusted."
  },
  {
    agentId: "llm-execution-risk-reviewer",
    agentName: "LLM Execution Risk Reviewer",
    role: "Review staged execution readiness, risk limits, kill switch state, and pre-trade checklist blockers without approving live orders."
  }
];
const compactDashboardAgent = requiredAgents.find((agent) => agent.agentId === "llm-cio-synthesis-reviewer") ?? requiredAgents[0];

const allowedBiases = new Set(["bullish", "bearish", "neutral", "no_opinion"]);
const allowedRecommendations = new Set([
  "continue_research",
  "rerun_validation",
  "paper_demo_candidate_review"
]);
const unsafeTextMatchers = [
  { reason: "direct trade execution", pattern: /\b(?:execute|place|send)\s+(?:a\s+|an\s+|the\s+)?(?:trade|order)s?\b/i },
  { reason: "position control", pattern: /\b(?:open|close)\s+(?:a\s+|an\s+|the\s+)?position\b/i },
  { reason: "broker connection or control", pattern: /\b(?:connect|route|submit|control)\s+(?:to\s+)?(?:a\s+)?broker\b/i },
  { reason: "broker connection or control", pattern: /\bbroker\s+(?:connection|control|routing)\b/i },
  {
    reason: "broker execution enablement",
    pattern: /\b(?:enable|initiate|perform|authorize|allow|use|start|proceed\s+with)\s+(?:direct\s+|live\s+)?broker\s+execution\b/i
  },
  { reason: "readiness bypass", pattern: /\b(?:bypass|override|ignore|skip)\s+(?:the\s+)?readiness\b/i },
  { reason: "readiness bypass", pattern: /\breadiness\s+(?:bypass|override)\b/i },
  { reason: "approval authority", pattern: /\bapprove\s+(?:the\s+)?(?:trade|order|paper|demo|live|execution)\b/i },
  { reason: "trading enablement", pattern: /\benable\s+(?:paper\s+|demo\s+|live\s+)?trading\b/i },
  { reason: "API key handling", pattern: /\b(?:api\s*key|secret\s+key|openai_api_key)\b/i }
];

class ProviderValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ProviderValidationError";
    this.details = details;
  }
}

function printHelp() {
  process.stdout.write(`GoTrader AI Lab GPT-5.5 LLM agent provider

Reads a restricted research context JSON packet from stdin, calls the OpenAI Responses API,
and prints validated advisory-only LLM agent response JSON to stdout.

Usage:
  node scripts/gpt55-llm-agent-provider.mjs
  node scripts/gpt55-llm-agent-provider.mjs --input-file llm/requests/latest-llm-context.json --output-file llm/responses/latest-llm-response.json
  node scripts/gpt55-llm-agent-provider.mjs --validate-response-file docs/sample-llm-agent-response.json
  node scripts/gpt55-llm-agent-provider.mjs --debug-validation --validate-response-file docs/sample-llm-agent-response-unsafe.json
  node scripts/gpt55-llm-agent-provider.mjs --dry-run
  node scripts/gpt55-llm-agent-provider.mjs --help

Environment:
  OPENAI_API_KEY             Required. Never commit this value.
  LLM_ADVISORY_MODEL         Optional. Overrides the advisory model.
  GOTRADER_LLM_MODEL         Optional fallback model. Defaults to ${DEFAULT_MODEL}.
  LLM_ADVISORY_TIMEOUT_MS    Optional. Defaults to ${DEFAULT_ADVISORY_TIMEOUT_MS}.

Safety:
  Advisory only. No execution authority. No broker control. No readiness override.
`);
}

function parseArgs(argv) {
  const valueAfter = (flag) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : undefined;
  };

  return {
    help: argv.includes("--help") || argv.includes("-h"),
    dryRun: argv.includes("--dry-run"),
    debugValidation: argv.includes("--debug-validation"),
    inputFile: valueAfter("--input-file"),
    outputFile: valueAfter("--output-file"),
    validateResponseFile: valueAfter("--validate-response-file"),
    task: valueAfter("--task") ?? "advisory"
  };
}

function sanitizeError(value) {
  return String(value ?? "Unknown error")
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, "Bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9._\-]{16,}\b/g, "sk-[redacted]");
}

function positiveIntegerEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 2_000 ? Math.round(value) : fallback;
}

const advisoryTimeoutMs = () => positiveIntegerEnv("LLM_ADVISORY_TIMEOUT_MS", DEFAULT_ADVISORY_TIMEOUT_MS);
const advisoryModel = () => process.env.LLM_ADVISORY_MODEL || process.env.GOTRADER_LLM_MODEL || DEFAULT_MODEL;

const isCompactDashboardReview = (packet) =>
  packet?.advisoryResponseMode === "compact_dashboard_review" ||
  packet?.dashboardAdvisoryRequest?.status === "plain_language_review";

function fail(message) {
  process.stderr.write(`GPT-5.5 LLM provider error: ${sanitizeError(message)}\n`);
  process.exitCode = 1;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("error", reject);
    process.stdin.on("end", () => resolve(raw));
  });
}

async function readRequestInput(args) {
  if (args.inputFile) {
    return fs.readFile(args.inputFile, "utf8");
  }
  return readStdin();
}

async function writeJsonFile(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function writeProviderOutput(args, responses) {
  if (args.outputFile) {
    await writeJsonFile(args.outputFile, responses);
    process.stderr.write(`Wrote validated advisory response JSON to ${args.outputFile}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(responses, null, 2)}\n`);
}

async function removeOutputFile(args) {
  if (!args?.outputFile) {
    return;
  }
  await fs.rm(args.outputFile, { force: true }).catch(() => {});
}

async function writeProviderError(args, error) {
  const message = error?.message ?? error;
  const shouldWriteErrorFile = Boolean(
    args?.outputFile || args?.debugValidation || error?.name === "ProviderValidationError"
  );
  if (!shouldWriteErrorFile) {
    return;
  }

  const timestamp = new Date().toISOString();
  const safeBase = path
    .basename(args.inputFile ?? args.validateResponseFile ?? "stdin-request", ".json")
    .replace(/[^A-Za-z0-9._-]/g, "_");
  const errorPath = path.join("llm", "errors", `${safeBase}-error-${Date.now()}.json`);
  await writeJsonFile(errorPath, {
    errorId: `llm_provider_error_${Date.now()}`,
    timestamp,
    provider: "gpt55_llm_agent_provider",
    mode: "advisory_only",
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none",
    inputFile: args.inputFile ?? "stdin",
    outputFile: args.outputFile,
    message: sanitizeError(message),
    validationDetails: error?.details
      ? {
          ...error.details,
          rawModelResponse:
            args?.debugValidation && error.details.rawModelResponse
              ? sanitizeError(error.details.rawModelResponse)
              : undefined
        }
      : undefined,
    safetyNotice: "Advisory-only provider error. No broker control. No execution authority. No readiness override."
  });
  process.stderr.write(`Wrote sanitized provider error JSON to ${errorPath}\n`);
}

function requireApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required. Set it in your shell environment; do not commit it.");
  }
  return apiKey;
}

function parseJson(raw, label) {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

function ensureArrayOfStrings(value, label, errors) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    errors.push(`${label} must be an array of strings`);
  }
}

function validateRequestPacket(packet) {
  const errors = [];
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    errors.push("request packet must be a JSON object");
  } else {
    if (packet.mode !== "advisory_only") {
      errors.push('request mode must be "advisory_only"');
    }
    if (packet.executionAuthority !== "none") {
      errors.push('request executionAuthority must be "none"');
    }
    if (packet.brokerAuthority !== "none") {
      errors.push('request brokerAuthority must be "none"');
    }
    if (packet.readinessOverrideAuthority !== "none") {
      errors.push('request readinessOverrideAuthority must be "none"');
    }
    if (packet.source !== "gotrader_ai_lab") {
      errors.push('request source must be "gotrader_ai_lab"');
    }
    if (!packet.packetId) {
      errors.push("request packetId is required");
    }
    if (!Array.isArray(packet.safetyConstraints)) {
      errors.push("request safetyConstraints must be present");
    }
  }

  if (errors.length > 0) {
    throw new Error(`request validation failed: ${errors.join("; ")}`);
  }
}

function freeTextFieldsFor(response) {
  const fields = [];
  if (typeof response.reasoningSummary === "string") {
    fields.push(["reasoningSummary", response.reasoningSummary]);
  }
  for (const field of ["riskWarnings", "missingEvidence", "suggestedCalibration", "safetyNotes"]) {
    const value = response[field];
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "string") {
          fields.push([`${field}[${index}]`, item]);
        }
      });
    }
  }
  return fields;
}

function isSafelyNegated(text, matchIndex) {
  const prefix = text.slice(Math.max(0, matchIndex - 32), matchIndex).toLowerCase();
  const suffix = text.slice(matchIndex, matchIndex + 96).toLowerCase();
  const clause = text.slice(matchIndex, matchIndex + 160).split(/[.;!?\n]/, 1)[0].toLowerCase();
  return (
    /\b(?:no|not|cannot|can not|must not|do not|does not|without)\s+[\w\s-]*$/.test(prefix) ||
    /\b(?:disabled|locked|blocked|unavailable|not\s+available|not\s+implemented|not\s+permitted|none)\b/.test(suffix) ||
    /\b(?:is|are|remains?|must\s+remain)\s+(?:strictly\s+)?(?:prohibited|forbidden|disallowed|prevented|disabled|blocked|not\s+permitted)\b/.test(clause)
  );
}

function unsafeLanguageFindings(response) {
  const findings = [];
  for (const [field, text] of freeTextFieldsFor(response)) {
    for (const matcher of unsafeTextMatchers) {
      matcher.pattern.lastIndex = 0;
      const match = matcher.pattern.exec(text);
      if (match && !isSafelyNegated(text, match.index)) {
        findings.push({
          field,
          phrase: match[0],
          reason: matcher.reason,
          message: `${field} contains unsafe phrase "${match[0]}" (${matcher.reason})`
        });
      }
    }
  }
  return findings;
}

function validateAgentResponse(response) {
  const errors = [];
  const rejectedFields = [];
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return { errors: ["response must be a JSON object"], rejectedFields };
  }
  if (!response.agentId) {
    errors.push("agentId is required");
  }
  if (!response.agentName) {
    errors.push("agentName is required");
  }
  if (response.mode !== "advisory_only") {
    errors.push('mode must be "advisory_only"');
  }
  if (response.executionAuthority !== "none") {
    errors.push('executionAuthority must be "none"');
  }
  if (response.brokerAuthority !== "none") {
    errors.push('brokerAuthority must be "none"');
  }
  if (response.readinessOverrideAuthority !== "none") {
    errors.push('readinessOverrideAuthority must be "none"');
  }
  if (!allowedBiases.has(response.bias)) {
    errors.push("bias must be bullish, bearish, neutral, or no_opinion");
  }
  if (typeof response.confidence !== "number" || !Number.isFinite(response.confidence)) {
    errors.push("confidence must be a finite number");
  } else if (response.confidence < 0 || response.confidence > 1) {
    errors.push("confidence must be between 0 and 1");
  }
  if (
    response.agreesWithBaseline !== true &&
    response.agreesWithBaseline !== false &&
    response.agreesWithBaseline !== null
  ) {
    errors.push("agreesWithBaseline must be true, false, or null");
  }
  if (typeof response.reasoningSummary !== "string" || response.reasoningSummary.trim().length === 0) {
    errors.push("reasoningSummary is required");
  }
  ensureArrayOfStrings(response.riskWarnings, "riskWarnings", errors);
  ensureArrayOfStrings(response.missingEvidence, "missingEvidence", errors);
  ensureArrayOfStrings(response.suggestedCalibration, "suggestedCalibration", errors);
  if (!allowedRecommendations.has(response.proceedRecommendation)) {
    errors.push("proceedRecommendation must be advisory-only");
  }
  ensureArrayOfStrings(response.safetyNotes, "safetyNotes", errors);
  const unsafeFindings = unsafeLanguageFindings(response);
  if (unsafeFindings.length > 0) {
    rejectedFields.push(...unsafeFindings);
    errors.push(...unsafeFindings.map((finding) => finding.message));
  }
  return { errors, rejectedFields };
}

function validateProviderResponses(responses, debugContext = {}, packet = {}) {
  if (!Array.isArray(responses)) {
    throw new ProviderValidationError("model output must contain a responses array", debugContext);
  }
  const requiredSet = isCompactDashboardReview(packet) ? [compactDashboardAgent] : requiredAgents;
  const requiredIds = new Set(requiredSet.map((agent) => agent.agentId));
  const seenIds = new Set();
  const errors = [];
  const rejectedFields = [];

  for (const response of responses) {
    const responseValidation = validateAgentResponse(response);
    if (responseValidation.errors.length > 0) {
      errors.push(`${response?.agentId ?? "unknown"}: ${responseValidation.errors.join(", ")}`);
      rejectedFields.push(
        ...responseValidation.rejectedFields.map((finding) => ({
          agentId: response?.agentId ?? "unknown",
          ...finding
        }))
      );
    }
    if (typeof response?.agentId === "string") {
      seenIds.add(response.agentId);
    }
  }

  for (const requiredId of requiredIds) {
    if (!seenIds.has(requiredId)) {
      errors.push(`${requiredId}: required agent response is missing`);
    }
  }

  if (errors.length > 0) {
    throw new ProviderValidationError(`response validation failed: ${errors.join("; ")}`, {
      ...debugContext,
      errors,
      rejectedFields
    });
  }
}

function normalizeModelOutput(parsed) {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed?.responses)) {
    return parsed.responses;
  }
  if (Array.isArray(parsed?.agentResponses)) {
    return parsed.agentResponses;
  }
  if (parsed?.agentId) {
    return [parsed];
  }
  throw new Error("model output did not include advisory responses");
}

function responseSchema(packet = {}) {
  const compact = isCompactDashboardReview(packet);
  const responseAgents = compact ? [compactDashboardAgent] : requiredAgents;
  const agentResponseSchema = {
    type: "object",
    additionalProperties: false,
    required: [
      "agentId",
      "agentName",
      "mode",
      "executionAuthority",
      "brokerAuthority",
      "readinessOverrideAuthority",
      "bias",
      "confidence",
      "agreesWithBaseline",
      "reasoningSummary",
      "riskWarnings",
      "missingEvidence",
      "suggestedCalibration",
      "proceedRecommendation",
      "safetyNotes"
    ],
    properties: {
      agentId: { type: "string", enum: responseAgents.map((agent) => agent.agentId) },
      agentName: { type: "string" },
      mode: { type: "string", enum: ["advisory_only"] },
      executionAuthority: { type: "string", enum: ["none"] },
      brokerAuthority: { type: "string", enum: ["none"] },
      readinessOverrideAuthority: { type: "string", enum: ["none"] },
      bias: { type: "string", enum: [...allowedBiases] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      agreesWithBaseline: { type: ["boolean", "null"] },
      reasoningSummary: { type: "string" },
      riskWarnings: { type: "array", items: { type: "string" } },
      missingEvidence: { type: "array", items: { type: "string" } },
      suggestedCalibration: { type: "array", items: { type: "string" } },
      proceedRecommendation: { type: "string", enum: [...allowedRecommendations] },
      safetyNotes: { type: "array", items: { type: "string" } }
    }
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["responses"],
    properties: {
      responses: {
        type: "array",
        minItems: responseAgents.length,
        maxItems: responseAgents.length,
        items: agentResponseSchema
      }
    }
  };
}

function buildSystemPrompt(packet = {}) {
  const compact = isCompactDashboardReview(packet);
  const responseAgents = compact ? [compactDashboardAgent] : requiredAgents;
  return [
    "You are the GPT-5.5 advisory provider for GoTrader AI Lab.",
    "You review simulation-only trading research context and return structured JSON only.",
    "You have no execution authority, no broker authority, and no readiness override authority.",
    "You must not place trades, approve trades, call brokers, ask for API keys, or change execution settings.",
    "Avoid free-text words and phrases such as execute, place trade, open position, close position, send order, broker control, override readiness, or approve trade.",
    "Use proceedRecommendation only as one of: continue_research, rerun_validation, paper_demo_candidate_review.",
    "paper_demo_candidate_review means review readiness only. It is not approval to trade, execute, route, or enable paper/demo/live trading.",
    compact
      ? "This is a compact Dashboard LLM Advisory Review. Return exactly one CIO synthesis reviewer response for the user's dashboard question."
      : `Return exactly ${requiredAgents.length} responses, one response for each required LLM agent ID listed below.`,
    compact ? "Do not expand into the full reviewer panel unless the packet asks for full_reviewer_set." : "Do not omit futures market-context reviewers.",
    "Order-flow planning reviewer is planning/advisory only. It should flag missing order-flow evidence and must not require live DOM, footprint, delta, cumulative delta, or large-print feeds.",
    "Prefer stability and evidence quality over profit-only conclusions.",
    "If evidence is missing, recommend continue_research or rerun_validation.",
    "",
    "Required agents:",
    ...responseAgents.map((agent) => `- ${agent.agentId}: ${agent.agentName}. ${agent.role}`),
    "",
    "Every response must include mode advisory_only and all authority fields set to none."
  ].join("\n");
}

const safetyEnvelopeProperties = {
  mode: { type: "string", enum: ["advisory_only"] },
  executionAuthority: { type: "string", enum: ["none"] },
  brokerAuthority: { type: "string", enum: ["none"] },
  readinessOverrideAuthority: { type: "string", enum: ["none"] }
};
const safetyEnvelopeRequired = ["mode", "executionAuthority", "brokerAuthority", "readinessOverrideAuthority"];

const chatResponseSchema = () => ({
  type: "object",
  additionalProperties: false,
  required: [
    ...safetyEnvelopeRequired,
    "reply",
    "bias",
    "confidence",
    "riskWarnings",
    "missingEvidence",
    "suggestedCalibration",
    "safetyNotes"
  ],
  properties: {
    ...safetyEnvelopeProperties,
    reply: { type: "string" },
    bias: { type: "string", enum: [...allowedBiases] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    riskWarnings: { type: "array", items: { type: "string" } },
    missingEvidence: { type: "array", items: { type: "string" } },
    suggestedCalibration: { type: "array", items: { type: "string" } },
    safetyNotes: { type: "array", items: { type: "string" } }
  }
});

const debateRoles = ["bull", "bear", "risk"];
const debateResponseSchema = () => ({
  type: "object",
  additionalProperties: false,
  required: ["turns"],
  properties: {
    turns: {
      type: "array",
      minItems: debateRoles.length,
      maxItems: debateRoles.length,
      items: {
        type: "object",
        additionalProperties: false,
        required: [...safetyEnvelopeRequired, "role", "argument", "keyPoints", "citedFacts", "confidence"],
        properties: {
          ...safetyEnvelopeProperties,
          role: { type: "string", enum: debateRoles },
          argument: { type: "string" },
          keyPoints: { type: "array", items: { type: "string" } },
          citedFacts: { type: "array", items: { type: "string" } },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    }
  }
});

const committeeStances = ["support_more_research", "needs_more_evidence", "do_not_proceed"];
const committeeResponseSchema = () => ({
  type: "object",
  additionalProperties: false,
  required: ["members"],
  properties: {
    members: {
      type: "array",
      minItems: 3,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        required: [...safetyEnvelopeRequired, "memberId", "memberName", "stance", "rationale", "evidenceGaps", "confidence"],
        properties: {
          ...safetyEnvelopeProperties,
          memberId: { type: "string" },
          memberName: { type: "string" },
          stance: { type: "string", enum: committeeStances },
          rationale: { type: "string" },
          evidenceGaps: { type: "array", items: { type: "string" } },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    }
  }
});

const sharedSafetyPromptLines = [
  "You review simulation-only trading research context and return structured JSON only.",
  "You have no execution authority, no broker authority, and no readiness override authority.",
  "You must not place trades, approve trades, call brokers, ask for API keys, or change execution settings.",
  "Avoid free-text words and phrases such as execute, place trade, open position, close position, send order, broker control, override readiness, or approve trade.",
  "Every response object must include mode advisory_only and all authority fields set to none."
];

const buildChatSystemPrompt = () =>
  [
    "You are the GoTrader AI Lab Research Advisor chat provider.",
    ...sharedSafetyPromptLines,
    "Answer the user's question in the chatMessage field of the packet using only the immutable research facts included in the packet (ICT context, validation chain, readiness, evidence).",
    "If evidence is missing to answer confidently, say so in missingEvidence and lower confidence.",
    "The reply is research commentary, never a trade instruction."
  ].join("\n");

const buildDebateSystemPrompt = () =>
  [
    "You are the GoTrader AI Lab research debate provider.",
    ...sharedSafetyPromptLines,
    "Produce exactly three debate turns: one bull, one bear, one risk role.",
    "Each turn argues strictly from the immutable packet facts (recognition, validation, walk-forward, evidence). Cite the specific fact strings used in citedFacts.",
    "The bull argues the research thesis strengths; the bear argues weaknesses and failure modes; the risk role focuses on drawdown, sample size, and overfit risk.",
    "A deterministic moderator resolves consensus outside this call; do not declare a winner."
  ].join("\n");

const buildCommitteeSystemPrompt = () =>
  [
    "You are the GoTrader AI Lab research committee provider.",
    ...sharedSafetyPromptLines,
    "Produce between 3 and 7 committee member reviews of the research packet, each with a distinct specialty (for example validation, market structure, risk, statistics, execution readiness).",
    "Each member gives a stance: support_more_research, needs_more_evidence, or do_not_proceed. The stance concerns research direction only, never trading.",
    "List concrete evidence gaps per member."
  ].join("\n");

function scanFreeTextFields(entries) {
  const findings = [];
  for (const [field, text] of entries) {
    if (typeof text !== "string") {
      continue;
    }
    for (const matcher of unsafeTextMatchers) {
      matcher.pattern.lastIndex = 0;
      const match = matcher.pattern.exec(text);
      if (match && !isSafelyNegated(text, match.index)) {
        findings.push(`${field} contains unsafe phrase "${match[0]}" (${matcher.reason})`);
      }
    }
  }
  return findings;
}

const validateSafetyEnvelope = (item, label, errors) => {
  if (item?.mode !== "advisory_only") errors.push(`${label}: mode must be advisory_only`);
  if (item?.executionAuthority !== "none") errors.push(`${label}: executionAuthority must be none`);
  if (item?.brokerAuthority !== "none") errors.push(`${label}: brokerAuthority must be none`);
  if (item?.readinessOverrideAuthority !== "none") errors.push(`${label}: readinessOverrideAuthority must be none`);
};

function validateChatResponse(result, debugContext = {}) {
  const errors = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new ProviderValidationError("chat output must be a JSON object", debugContext);
  }
  validateSafetyEnvelope(result, "chat", errors);
  if (typeof result.reply !== "string" || !result.reply.trim()) errors.push("chat: reply is required");
  if (!allowedBiases.has(result.bias)) errors.push("chat: bias must be bullish, bearish, neutral, or no_opinion");
  errors.push(
    ...scanFreeTextFields([
      ["reply", result.reply],
      ...["riskWarnings", "missingEvidence", "suggestedCalibration", "safetyNotes"].flatMap((field) =>
        Array.isArray(result[field]) ? result[field].map((item, index) => [`${field}[${index}]`, item]) : []
      )
    ])
  );
  if (errors.length > 0) {
    throw new ProviderValidationError(`chat validation failed: ${errors.join("; ")}`, { ...debugContext, errors });
  }
}

function validateDebateResponse(result, debugContext = {}) {
  const errors = [];
  const turns = result?.turns;
  if (!Array.isArray(turns)) {
    throw new ProviderValidationError("debate output must contain a turns array", debugContext);
  }
  const seenRoles = new Set();
  for (const turn of turns) {
    validateSafetyEnvelope(turn, `debate ${turn?.role ?? "unknown"}`, errors);
    if (!debateRoles.includes(turn?.role)) errors.push("debate: role must be bull, bear, or risk");
    seenRoles.add(turn?.role);
    if (typeof turn?.argument !== "string" || !turn.argument.trim()) errors.push(`debate ${turn?.role}: argument is required`);
    errors.push(
      ...scanFreeTextFields([
        [`${turn?.role}.argument`, turn?.argument],
        ...(Array.isArray(turn?.keyPoints) ? turn.keyPoints.map((item, index) => [`${turn.role}.keyPoints[${index}]`, item]) : [])
      ])
    );
  }
  for (const role of debateRoles) {
    if (!seenRoles.has(role)) errors.push(`debate: missing ${role} turn`);
  }
  if (errors.length > 0) {
    throw new ProviderValidationError(`debate validation failed: ${errors.join("; ")}`, { ...debugContext, errors });
  }
}

function validateCommitteeResponse(result, debugContext = {}) {
  const errors = [];
  const members = result?.members;
  if (!Array.isArray(members) || members.length < 3) {
    throw new ProviderValidationError("committee output must contain at least 3 members", debugContext);
  }
  for (const member of members) {
    validateSafetyEnvelope(member, `committee ${member?.memberId ?? "unknown"}`, errors);
    if (!committeeStances.includes(member?.stance)) errors.push(`committee ${member?.memberId}: invalid stance`);
    if (typeof member?.rationale !== "string" || !member.rationale.trim()) {
      errors.push(`committee ${member?.memberId}: rationale is required`);
    }
    errors.push(
      ...scanFreeTextFields([
        [`${member?.memberId}.rationale`, member?.rationale],
        ...(Array.isArray(member?.evidenceGaps)
          ? member.evidenceGaps.map((item, index) => [`${member.memberId}.evidenceGaps[${index}]`, item])
          : [])
      ])
    );
  }
  if (errors.length > 0) {
    throw new ProviderValidationError(`committee validation failed: ${errors.join("; ")}`, { ...debugContext, errors });
  }
}

const providerTasks = {
  advisory: {
    schemaName: "gotrader_llm_advisory_responses",
    schemaFor: (packet) => responseSchema(packet),
    promptFor: (packet) => buildSystemPrompt(packet)
  },
  chat: {
    schemaName: "gotrader_llm_chat_response",
    schemaFor: () => chatResponseSchema(),
    promptFor: () => buildChatSystemPrompt()
  },
  debate: {
    schemaName: "gotrader_llm_debate_response",
    schemaFor: () => debateResponseSchema(),
    promptFor: () => buildDebateSystemPrompt()
  },
  committee: {
    schemaName: "gotrader_llm_committee_response",
    schemaFor: () => committeeResponseSchema(),
    promptFor: () => buildCommitteeSystemPrompt()
  }
};

function buildResponsesPayload(model, packet, task = "advisory") {
  const definition = providerTasks[task] ?? providerTasks.advisory;
  return {
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: definition.promptFor(packet) }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: JSON.stringify(packet, null, 2) }]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: definition.schemaName,
        strict: true,
        schema: definition.schemaFor(packet)
      }
    },
    store: false
  };
}

function extractOutputText(apiResponse) {
  if (typeof apiResponse.output_text === "string" && apiResponse.output_text.trim()) {
    return apiResponse.output_text;
  }

  const chunks = [];
  for (const item of apiResponse.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  const text = chunks.join("").trim();
  if (!text) {
    throw new Error("OpenAI response did not include output text");
  }
  return text;
}

async function callOpenAI(apiKey, model, packet, task = "advisory") {
  if (typeof fetch !== "function") {
    throw new Error("native fetch is required. Use Node 18 or newer.");
  }

  const timeoutMs = advisoryTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(buildResponsesPayload(model, packet, task)),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`OpenAI advisory request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenAI Responses API request failed with status ${response.status}. ${sanitizeError(body)}`);
  }

  return response.json();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  await removeOutputFile(args);

  if (args.validateResponseFile) {
    const rawResponse = await fs.readFile(args.validateResponseFile, "utf8");
    const parsedResponse = parseJson(rawResponse, "response file");
    const responses = normalizeModelOutput(parsedResponse);
    validateProviderResponses(responses, {
      source: "validate-response-file",
      responseFile: args.validateResponseFile,
      rawModelResponse: rawResponse
    });
    if (args.outputFile) {
      await writeProviderOutput(args, responses);
    } else {
      process.stderr.write(`Response file validation passed: ${args.validateResponseFile}\n`);
    }
    return;
  }

  const apiKey = requireApiKey();
  const raw = await readRequestInput(args);
  if (!raw.trim()) {
    throw new Error("request JSON must be provided on stdin or with --input-file");
  }

  const packet = parseJson(raw, "request");
  validateRequestPacket(packet);

  const model = advisoryModel();
  const task = providerTasks[args.task] ? args.task : "advisory";

  if (args.dryRun) {
    process.stderr.write(
      `Dry run passed. Provider would call ${OPENAI_RESPONSES_ENDPOINT} with model ${model} for task ${task}. No response was written.\n`
    );
    return;
  }

  const apiResponse = await callOpenAI(apiKey, model, packet, task);
  const outputText = extractOutputText(apiResponse);
  const parsedOutput = parseJson(outputText, "model output");

  if (task === "chat") {
    validateChatResponse(parsedOutput, { source: "openai_response", rawModelResponse: outputText });
    await writeProviderOutput(args, parsedOutput);
    return;
  }
  if (task === "debate") {
    validateDebateResponse(parsedOutput, { source: "openai_response", rawModelResponse: outputText });
    await writeProviderOutput(args, parsedOutput);
    return;
  }
  if (task === "committee") {
    validateCommitteeResponse(parsedOutput, { source: "openai_response", rawModelResponse: outputText });
    await writeProviderOutput(args, parsedOutput);
    return;
  }

  const responses = normalizeModelOutput(parsedOutput);
  validateProviderResponses(responses, {
    source: "openai_response",
    rawModelResponse: outputText
  }, packet);

  await writeProviderOutput(args, responses);
}

const cliArgs = parseArgs(process.argv.slice(2));

main().catch(async (error) => {
  const message = error?.message ?? error;
  await writeProviderError(cliArgs, error).catch((writeError) => {
    process.stderr.write(`GPT-5.5 LLM provider error: failed to write error JSON: ${sanitizeError(writeError?.message ?? writeError)}\n`);
  });
  fail(message);
});
