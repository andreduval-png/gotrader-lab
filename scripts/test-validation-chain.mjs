#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const projectRoot = process.cwd();
const libRoot = path.join(projectRoot, "src", "lib");
const outRoot = path.join(projectRoot, ".gotrader", "validation-chain-test");
const sourceFiles = [
  "validationChain/validationChainTypes.ts",
  "validationChain/buildValidationChain.ts",
  "validationProvenance/validationProvenanceTypes.ts",
  "validationProvenance/validationProvenance.ts",
  "validationProvenance/index.ts"
];

function compileForNode() {
  fs.mkdirSync(outRoot, { recursive: true });
  for (const file of sourceFiles) {
    const sourcePath = path.join(libRoot, file);
    const source = fs.readFileSync(sourcePath, "utf8");
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
        verbatimModuleSyntax: false
      },
      fileName: sourcePath
    }).outputText;
    const rewritten = transpiled
      .replace(/from\s+"\.\.\/validationProvenance"/g, 'from "../validationProvenance/index.mjs"')
      .replace(/from\s+'\.\.\/validationProvenance'/g, "from '../validationProvenance/index.mjs'")
      .replace(/from\s+"\.\/([^"]+)"/g, 'from "./$1.mjs"')
      .replace(/from\s+'\.\/([^']+)'/g, "from './$1.mjs'");
    const outputPath = path.join(outRoot, file.replace(/\.ts$/, ".mjs"));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, rewritten, "utf8");
  }
}

async function main() {
  compileForNode();
  const {
    queueValidationChainEntry,
    applyValidationChainReplayResult,
    applyValidationChainWalkForwardResult,
    applyValidationChainEvidenceUpdate,
    describeValidationChainStage
  } = await import(pathToFileURL(path.join(outRoot, "validationChain", "buildValidationChain.mjs")).href);
  const {
    attachMatchingCycleValidationProvenance,
    matchActiveResearchIdentity,
    matchValidationProvenance
  } = await import(pathToFileURL(path.join(outRoot, "validationProvenance", "index.mjs")).href);

  const frozenValidationIdentity = {
    strategyProfile: "ifvg_fresh_retest_v3_research",
    strategyProfileVersion: "v3",
    sourceProvider: "mt5_read_only",
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    sourceFingerprint: "mt5_frozen_validation_window",
    parameterFingerprint: "params_ifvg_v3",
    detectorProfileFingerprint: "detector_ifvg_v3",
    validationRunId: "validation_ifvg_v3"
  };
  const activeResearchIdentity = {
    ...frozenValidationIdentity,
    sourceFingerprint: "mt5_current_rolling_window",
    validationRunId: undefined
  };
  assert.equal(
    matchActiveResearchIdentity(activeResearchIdentity, frozenValidationIdentity).matched,
    true,
    "a newly closed MT5 candle must not change the canonical strategy/source-series identity"
  );
  assert.equal(
    matchActiveResearchIdentity(
      { ...activeResearchIdentity, strategyProfile: "agent_consensus" },
      frozenValidationIdentity
    ).matched,
    false,
    "evidence from another active strategy profile must remain blocked"
  );
  assert.equal(
    matchValidationProvenance(frozenValidationIdentity, {
      ...frozenValidationIdentity,
      walkForwardRunId: "walk_forward_ifvg_v3"
    }, {
      purpose: "readiness",
      requireValidationRunId: true,
      requireWalkForwardRunId: true,
      requireMatchingOosEvidence: true
    }).matched,
    true,
    "walk-forward evidence must still match the exact frozen validation fingerprint and run"
  );
  assert.equal(
    matchValidationProvenance(frozenValidationIdentity, {
      ...frozenValidationIdentity,
      sourceFingerprint: "another_frozen_window",
      walkForwardRunId: "walk_forward_ifvg_v3"
    }, {
      purpose: "readiness",
      requireValidationRunId: true,
      requireWalkForwardRunId: true,
      requireMatchingOosEvidence: true
    }).matched,
    false,
    "OOS from another frozen source window must remain blocked"
  );
  const legacyValidationReport = { id: "validation_ifvg_v3", provenance: undefined };
  const restoredValidationReport = attachMatchingCycleValidationProvenance(
    legacyValidationReport,
    {
      validationId: "validation_ifvg_v3",
      provenance: frozenValidationIdentity
    }
  );
  assert.equal(
    matchValidationProvenance(
      frozenValidationIdentity,
      restoredValidationReport?.provenance,
      { requireValidationRunId: true }
    ).matched,
    true,
    "a matching compact cycle summary may restore provenance dropped by a legacy validation record"
  );
  assert.equal(
    legacyValidationReport.provenance,
    undefined,
    "legacy validation evidence must not be mutated in place"
  );
  assert.equal(
    attachMatchingCycleValidationProvenance(legacyValidationReport, {
      validationId: "another_validation",
      provenance: frozenValidationIdentity
    })?.provenance,
    undefined,
    "a different validation id must remain blocked as unverified legacy evidence"
  );
  const validationCutoff = "2026-07-14T04:40:00.000Z";
  const currentPostCutoffValidation = {
    ...frozenValidationIdentity,
    validationCutoff,
    dataRangeStart: "2026-07-14T09:40:00.000Z",
    dataRangeEnd: "2026-07-17T23:55:00.000Z"
  };
  assert.equal(
    matchValidationProvenance(
      currentPostCutoffValidation,
      {
        ...currentPostCutoffValidation,
        walkForwardRunId: "walk_forward_current_ifvg_v3"
      },
      {
        purpose: "readiness",
        requireValidationRunId: true,
        requireWalkForwardRunId: true,
        requireMatchingOosEvidence: true
      }
    ).matched,
    true,
    "an exact post-cutoff validation/OOS pair is the same current research identity"
  );
  assert.equal(
    matchValidationProvenance(
      {
        ...frozenValidationIdentity,
        validationCutoff,
        dataRangeStart: "2026-01-16T00:00:00.000Z",
        dataRangeEnd: validationCutoff
      },
      {
        ...frozenValidationIdentity,
        validationCutoff,
        dataRangeStart: "2026-07-14T09:40:00.000Z",
        dataRangeEnd: "2026-07-17T23:55:00.000Z",
        walkForwardRunId: "walk_forward_post_cutoff"
      },
      {
        purpose: "readiness",
        requireValidationRunId: true,
        requireWalkForwardRunId: true,
        requireMatchingOosEvidence: true
      }
    ).matched,
    false,
    "post-cutoff evidence must not replace a frozen pre-cutoff validation audit"
  );
  const legacyMt5Fingerprint =
    "mt5_read_only|MT5 read-only candle feed - research eligible|1000|2026-07-14T09:40:00.000Z|29387.8|2026-07-17T23:55:00.000Z|28569.44";
  const canonicalMt5Fingerprint =
    "mt5_read_only|mt5_read_only_feed_MNQ_5m|MNQ|5m|1000|2026-07-14T09:40:00.000Z|29387.8|2026-07-17T23:55:00.000Z|28569.44";
  assert.equal(
    matchValidationProvenance(
      { ...frozenValidationIdentity, sourceFingerprint: legacyMt5Fingerprint },
      { ...frozenValidationIdentity, sourceFingerprint: canonicalMt5Fingerprint }
    ).matched,
    true,
    "legacy display and canonical fingerprints for the exact same MT5 candle window must migrate safely"
  );
  assert.equal(
    matchValidationProvenance(
      { ...frozenValidationIdentity, sourceFingerprint: legacyMt5Fingerprint },
      {
        ...frozenValidationIdentity,
        sourceFingerprint: canonicalMt5Fingerprint.replace("28569.44", "28570.44")
      }
    ).matched,
    false,
    "a boundary price change must not be accepted as the same canonical candle window"
  );

  const mt5SourceStatus = {
    sourceProvider: "mt5_read_only",
    isMockOrSample: false,
    isResearchActive: true,
    statusLabel: "MT5 read-only research active"
  };
  const mockSourceStatus = {
    sourceProvider: "mock",
    isMockOrSample: true,
    isResearchActive: false,
    statusLabel: "Mock/sample data"
  };
  const recognitionInput = (overrides = {}) => {
    const input = {
      recognitionId: "recognition_test_1",
      recognitionType: "full_model",
      setupLabel: "CMD Full Model",
      symbol: "MNQ",
      brokerSymbol: "USTECH",
      timeframe: "5m",
      htfContext: ["15m", "1h"],
      sourceFingerprint: "mt5_fp_test",
      sourceStatus: mt5SourceStatus,
      generatedAt: "2026-06-11T10:00:00.000Z",
      ...overrides
    };
    return {
      ...input,
      provenance: {
        strategyProfile: "cmd_validation_fixture_v1",
        candidateId: input.recognitionId,
        sourceProvider: input.sourceStatus.sourceProvider,
        requestedSymbol: input.symbol,
        brokerSymbol: input.brokerSymbol,
        timeframe: input.timeframe,
        sourceFingerprint: input.sourceFingerprint,
        parameterFingerprint: "params_validation_fixture_v1",
        ...overrides.provenance
      }
    };
  };

  // 1. Mock recognition cannot create evidence.
  const mockQueue = queueValidationChainEntry(recognitionInput({ sourceStatus: mockSourceStatus }));
  assert.equal(mockQueue.ok, false, "mock/sample recognition must be rejected from the validation chain");
  assert.match(mockQueue.reason, /mock\/sample/i);
  assert.equal(mockQueue.entry.hypothesisStatus, "not_queued");
  assert.match(mockQueue.entry.nextAction, /Activate MT5/i);

  // 2. MT5 recognition queues replay_required.
  const queued = queueValidationChainEntry(recognitionInput());
  assert.equal(queued.ok, true);
  const entry = queued.entry;
  assert.equal(entry.hypothesisStatus, "replay_required");
  assert.equal(entry.recognitionId, "recognition_test_1");
  assert.equal(entry.candidateFamily, "known_model");
  assert.equal(entry.sourceFingerprint, "mt5_fp_test");
  assert.equal(entry.executionIntent, "none");
  assert.match(describeValidationChainStage(entry), /not evidence/i);

  const marketMapQueue = queueValidationChainEntry(
    recognitionInput({
      recognitionId: "recognition_market_map_only",
      recognitionType: "market_map_only",
      setupLabel: "Market map context only"
    })
  );
  assert.equal(marketMapQueue.ok, false, "market-map diagnostics must not queue validation-chain evidence");
  assert.match(marketMapQueue.reason, /Context-only|registered trade setup/i);
  assert.equal(marketMapQueue.entry.hypothesisStatus, "not_queued");
  assert.equal(marketMapQueue.entry.candidateFamily, "market_map");
  assert.match(marketMapQueue.entry.paperDemoChecklistImpact, /No Paper-Demo impact/i);

  const ifvgQueued = queueValidationChainEntry(
    recognitionInput({
      recognitionId: "recognition_ifvg_filtered_v2",
      setupLabel: "IFVG filtered v2 - clean retest displacement",
      htfContext: ["15m", "1h", "4h", "1d"],
      sourceFingerprint: "mt5_fp_ifvg_filtered_v2"
    })
  );
  assert.equal(ifvgQueued.ok, true);
  assert.equal(ifvgQueued.entry.candidateFamily, "ifvg");
  assert.equal(ifvgQueued.entry.hypothesisStatus, "replay_required");
  assert.equal(ifvgQueued.entry.sourceFingerprint, "mt5_fp_ifvg_filtered_v2");
  assert.match(ifvgQueued.entry.nextAction, /IFVG filtered v2/i);
  assert.match(ifvgQueued.entry.paperDemoChecklistImpact, /candidate consideration only/i);
  assert.equal(ifvgQueued.entry.executionIntent, "none");

  // 3. Replay result is preserved on the chain entry.
  const replayPassed = applyValidationChainReplayResult(entry, {
    runId: "replay_run_1",
    generatedAt: "2026-06-11T11:00:00.000Z",
    verdict: "passed",
    totalWindows: 12,
    totalSignals: 18,
    targetFirstRate: 0.61,
    averageRr: 1.4,
    usableOutcomes: 18,
    reason: "Target-first rate 61% across 18 signals.",
    provenance: entry.provenance
  });
  assert.ok(replayPassed.replayResult, "replay result summary must be preserved, not dropped");
  assert.equal(replayPassed.replayResult.runId, "replay_run_1");
  assert.equal(replayPassed.replayResult.targetFirstRate, 0.61);

  // 4. Walk-forward required follows a replay pass.
  assert.equal(replayPassed.hypothesisStatus, "walk_forward_required");
  assert.match(replayPassed.nextAction, /walk-forward/i);
  assert.match(replayPassed.paperDemoChecklistImpact, /walk-forward/i);

  // 5. Failed replay blocks walk-forward.
  const replayFailed = applyValidationChainReplayResult(entry, {
    generatedAt: "2026-06-11T11:00:00.000Z",
    verdict: "failed",
    totalWindows: 12,
    totalSignals: 18,
    targetFirstRate: 0.2,
    reason: "Target-first rate 20% across 18 signals.",
    provenance: entry.provenance
  });
  assert.equal(replayFailed.hypothesisStatus, "replay_failed");
  const wfAfterFailedReplay = applyValidationChainWalkForwardResult(replayFailed, {
    runId: "wf_run_blocked",
    generatedAt: "2026-06-11T12:00:00.000Z",
    verdict: "passed",
    warningFlags: [],
    reason: "should be ignored"
  });
  assert.equal(wfAfterFailedReplay.hypothesisStatus, "replay_failed", "failed replay must block walk-forward");
  assert.equal(wfAfterFailedReplay.walkForwardResult, undefined, "walk-forward verdict must not attach after failed replay");
  assert.ok(wfAfterFailedReplay.blockers.some((blocker) => /walk-forward ignored/i.test(blocker)));

  // 6. Walk-forward verdict attaches after replay pass; evidence update follows.
  const wfPassed = applyValidationChainWalkForwardResult(replayPassed, {
    runId: "wf_run_1",
    generatedAt: "2026-06-11T12:30:00.000Z",
    verdict: "passed",
    grade: 71,
    oosVerdict: "robust_research",
    tradeCount: 42,
    windowsTested: 5,
    oosWindowsPassed: 4,
    warningFlags: ["low trade count in window 3"],
    reason: "4/5 OOS windows passed.",
    provenance: {
      ...entry.provenance,
      walkForwardRunId: "wf_run_1"
    }
  });
  assert.equal(wfPassed.hypothesisStatus, "walk_forward_passed");
  assert.equal(wfPassed.walkForwardResult.oosVerdict, "robust_research");
  assert.equal(wfPassed.walkForwardResult.tradeCount, 42);
  const evidenceUpdated = applyValidationChainEvidenceUpdate(wfPassed, {
    generatedAt: "2026-06-11T13:00:00.000Z",
    evidenceQualityScore: 64,
    maturityScore: 55,
    maturityGrade: "developing",
    detail: "test evidence snapshot",
    provenance: entry.provenance
  });
  assert.equal(evidenceUpdated.hypothesisStatus, "evidence_updated");
  assert.equal(evidenceUpdated.evidenceQuality.evidenceQualityScore, 64);

  // Failed walk-forward is rejected as evidence.
  const wfFailed = applyValidationChainWalkForwardResult(replayPassed, {
    generatedAt: "2026-06-11T12:30:00.000Z",
    verdict: "failed",
    grade: 18,
    oosVerdict: "fail",
    tradeCount: 10,
    warningFlags: ["oos collapse"],
    reason: "OOS windows failed.",
    provenance: {
      ...entry.provenance,
      walkForwardRunId: "wf_run_failed"
    }
  });
  assert.equal(wfFailed.hypothesisStatus, "walk_forward_failed");
  assert.match(wfFailed.paperDemoChecklistImpact, /Blocked for Paper-Demo/i);

  // 7. Authority remains none and no raw candles are serialized at any stage.
  for (const candidate of [mockQueue.entry, entry, replayPassed, replayFailed, wfPassed, wfFailed, evidenceUpdated]) {
    assert.equal(candidate.authority.executionAuthority, "none");
    assert.equal(candidate.authority.brokerAuthority, "none");
    assert.equal(candidate.authority.readinessOverrideAuthority, "none");
    assert.equal(candidate.executionIntent, "none");
    assert.equal(candidate.researchOnly, true);
    const serialized = JSON.stringify(candidate).toLowerCase();
    assert.ok(!/"candles"\s*:/.test(serialized), "no raw candle arrays may be serialized");
    assert.ok(!serialized.includes('"open":'), "no candle OHLC fields may be serialized");
    assert.ok(!serialized.includes("api_key"), "no secrets may be serialized");
  }

  console.log("validation-chain tests passed:");
  console.log("- mock recognition cannot create evidence");
  console.log("- MT5 recognition queues replay_required");
  console.log("- replay result summary is preserved");
  console.log("- walk-forward required follows replay pass");
  console.log("- failed replay blocks walk-forward");
  console.log("- failed walk-forward blocks Paper-Demo");
  console.log("- authority remains none; no raw candles serialized");
}

main().catch((error) => {
  console.error("validation-chain tests failed:", error);
  process.exitCode = 1;
});
