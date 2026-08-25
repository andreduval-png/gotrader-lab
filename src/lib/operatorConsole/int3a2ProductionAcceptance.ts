import { resolveResearchRuntimeSnapshot, type ResearchRuntimeSnapshot } from "@/lib/runtime";
import { assessIctIfvgFreshRetestV3, compactIctIfvgFreshRetestV3Assessment } from "@/lib/ict-strategy-suite/ictIfvgFreshRetestV3";
import { runIctActivateMarketPipeline, readLatestActivateMarketSummary } from "@/lib/ict-strategy-suite/ictActivateMarketPipeline";
import { buildIctCurrentReadFromPacket } from "@/lib/ict-strategy-suite/ictCurrentRead";
import type { IctAdvisorPacket } from "@/lib/ict-strategy-suite/ictAdvisorTypes";
import type { IctAnalysisTimeframe, IctAnalysisTimeframeRole, IctMarketAnalysisContextBundle } from "@/lib/ict-strategy-suite/ictMarketAnalysisContextTypes";
import { evaluateIct2022Model, buildIctCoreCandidateCollection } from "@/lib/ictI2";
import type { IctCoreDetectionInput } from "@/lib/ictI2";
import type { Candle, Timeframe } from "@/lib/types";
import { buildOperatorConsoleSnapshot } from "./buildOperatorConsoleSnapshot";
import { OPERATOR_AUTHORITY } from "./operatorConsoleTypes";
import { readOperatorCycleState, saveOperatorCycleState } from "./operatorCycle";

const CYCLE_ID = "int-3a-2-production-conflict";
const SOURCE_FINGERPRINT = "mt5|ES|ES|5m|int-1-1-live";
const ICT_SOURCE_FINGERPRINT = "mt5|ES|ES|5m|int-3a-1";
const at = (minute: number) => new Date(Date.UTC(2026, 5, 12, 13, 30 + minute)).toISOString();
const candle = (minute: number, open: number, high: number, low: number, close: number, volume = 100, timeframe: Timeframe = "5m"): Candle => ({
  id: `int3a2-${timeframe}-${minute}`,
  symbol: "ES",
  timeframe,
  timestamp: at(minute), open, high, low, close, volume
});
const overlap = (startMinute: number, count: number, base = 100) => Array.from({ length: count }, (_, index) => {
  const open = base + (index % 3) * 0.12;
  const close = base + ((index + 1) % 3) * 0.12;
  return candle(startMinute + index * 5, open, base + 1.2, base - 1.2, close, 150 + index);
});

const ifvgCandles = () => [
  ...overlap(-30, 6),
  ...overlap(0, 10),
  candle(50, 101, 104, 96, 97),
  candle(55, 97, 99, 95.5, 96.8),
  candle(60, 93, 94, 90, 91),
  candle(65, 91, 93.4, 90.5, 92.2),
  candle(70, 92.5, 98.6, 92.2, 98),
  candle(75, 98, 99.2, 97.2, 98.8),
  candle(80, 98.8, 100.2, 98.2, 99.8),
  candle(85, 99.6, 100, 94.8, 95.6)
];
const contextCandles = {
  "15m": [candle(-120, 90, 93, 89, 92, 100, "15m"), candle(-105, 92, 98, 91, 97, 100, "15m"), candle(-90, 97, 102, 96, 101, 100, "15m")],
  "1h": [candle(-240, 88, 94, 87, 93, 100, "1h"), candle(-180, 93, 103, 92, 101, 100, "1h")]
};

const ictAuthority = {
  executionAuthority: "none" as const,
  brokerAuthority: "none" as const,
  readinessOverrideAuthority: "none" as const,
  productionAdoptionAllowed: false as const,
  canCreateEvidence: false as const,
  canApproveReadiness: false as const,
  canApplyCalibration: false as const,
  canCreateTradeIntent: false as const
};
const factBase = (factId: string, factType: string, minute: number, timeframe = "5m") => ({
  factId, factType, symbol: "ES", timeframe, occurredAt: at(minute), confirmedAt: at(minute), validFrom: at(minute), state: "ACTIVE",
  lineage: { sourceCandleIds: [`ict-${minute}`], sourceFactIds: [], sourceFingerprint: ICT_SOURCE_FINGERPRINT, policyId: "int-3a-1-fixture", policyVersion: "1" },
  authority: ictAuthority
});

const ict2022ShortInput = (): IctCoreDetectionInput => ({
  facts: [
    { ...factBase("ict-target", "LIQUIDITY", 0, "1h"), liquidityId: "ict-target-liquidity", side: "SELL_SIDE_LIQUIDITY", liquidityClass: "EXTERNAL", sourceStructureIds: ["target-swing"], ownerTimeframe: "1h", price: 89, status: "AVAILABLE" },
    { ...factBase("ict-draw", "DRAW_ON_LIQUIDITY", 0, "1h"), drawId: "ict-primary-draw", direction: "bearish", targetLiquidityId: "ict-target-liquidity", targetClass: "EXTERNAL", ownerTimeframe: "1h", distance: 10, structuralRelevance: 75, available: true, consumed: false, selectionPolicyVersion: "1", nearestLiquidityId: "ict-target-liquidity" },
    { ...factBase("ict-raid", "LIQUIDITY", 5, "15m"), liquidityId: "ict-raid-liquidity", side: "BUY_SIDE_LIQUIDITY", liquidityClass: "EXTERNAL", sourceStructureIds: ["raid-swing"], ownerTimeframe: "15m", price: 105, status: "CONSUMED", consumedAt: at(5), consumingCandleId: "ict-5" },
    { ...factBase("ict-displacement", "DISPLACEMENT", 10), displacementId: "ict-displacement", direction: "bearish", startCandleId: "ict-5", endCandleId: "ict-10", bodySize: 4, baselineBodySize: 2, bodyMultiple: 2, measurementPolicyId: "int-3a-2-acceptance" },
    { ...factBase("ict-mss", "MSS", 15), mssId: "ict-mss", direction: "bearish", brokenStructureId: "ict-swing", breakCandleId: "ict-15", displacementId: "ict-displacement", breakPrice: 100 },
    { ...factBase("ict-fvg", "FVG", 20), fvgId: "ict-fvg", direction: "bearish", proximalPrice: 101, distalPrice: 100, midpoint: 100.5, originCandleIds: ["ict-10", "ict-15", "ict-20"], fvgState: "OPEN", filledPercentage: 0 }
  ] as unknown as IctCoreDetectionInput["facts"],
  candlesByTimeframe: { "5m": [{ id: "ict-retrace", symbol: "ES", timeframe: "5m", timestamp: at(25), open: 101, high: 101.2, low: 100.4, close: 100.8, volume: 100 }] },
  asOf: at(25), sourceFingerprint: ICT_SOURCE_FINGERPRINT,
  narrative: { structural: "bearish", intermediate: "bullish", execution: "bullish", liquidityPath: "sellside", structuralTimeframe: "1h", intermediateTimeframe: "15m", executionTimeframe: "5m", policyId: "gotrader.ict.c1-1.hierarchical-roles.v1", policyVersion: "1.0.0" },
  symbol: "ES", timeframe: "5m"
});

const controlledRuntime = async (): Promise<ResearchRuntimeSnapshot> => {
  const base = await resolveResearchRuntimeSnapshot();
  const source = {
    ...base.marketData.activeResearchSource,
    sourceId: "int-3a-2-controlled-es",
    provider: "mt5_read_only" as const,
    symbol: "ES",
    timeframe: "5m" as const,
    candleCount: 1_000,
    fingerprint: SOURCE_FINGERPRINT,
    sourceLabel: "INT-3A.2 controlled ES acceptance source",
    provenance: { ...base.marketData.activeResearchSource.provenance, providerSymbol: "ES" },
    eligibility: { ...base.marketData.activeResearchSource.eligibility, researchCycle: true },
    authority: OPERATOR_AUTHORITY
  };
  return {
    ...base,
    snapshotId: CYCLE_ID,
    generatedAt: at(90),
    marketData: {
      ...base.marketData,
      activeDataSource: "mt5_read_only",
      activeChartSource: source,
      activeResearchSource: source,
      allAvailableSources: [source],
      activeResearchSourceLabel: source.sourceLabel,
      chartDisplayCandleCount: source.candleCount,
      researchDataFingerprint: SOURCE_FINGERPRINT,
      symbol: "ES",
      contract: "ES",
      timeframe: "5m",
      rawCandleCount: source.candleCount,
      processedCandleCount: source.candleCount
    },
    mt5ReadOnly: { ...base.mt5ReadOnly, brokerSymbol: "ES" }
  };
};

const analysisTimeframe = (
  timeframe: IctAnalysisTimeframe,
  candleCount: number,
  availableLookbackDays: number,
  role: IctAnalysisTimeframeRole
) => ({
  timeframe,
  requestedLookbackDays: 90,
  availableLookbackDays,
  candleCount,
  dataDepthStatus: "sufficient" as const,
  sourceMethod: "int3a2_controlled_acceptance",
  role
});

const controlledBundle = (): IctMarketAnalysisContextBundle => ({
  context: {
    researchOnly: true,
    requestedSymbol: "ES",
    brokerSymbol: "ES",
    displayTimeframe: "5m",
    displayTimeframeRole: "chart_display_reference_only",
    analysisTimeframes: [
      analysisTimeframe("M5", 17_799, 88.95, "confirmation_refinement"),
      analysisTimeframe("M15", 5_933, 88.95, "session_model"),
      analysisTimeframe("H1", 1_484, 88.95, "bias_and_dealing_range"),
      analysisTimeframe("H4", 371, 88.95, "htf_bias"),
      analysisTimeframe("D1", 90, 90, "daily_bias"),
      analysisTimeframe("W1", 18, 90, "weekly_bias")
    ],
    analysisTimeframesRequested: ["W1", "D1", "H4", "H1", "M15", "M5"],
    analysisTimeframesLoaded: ["W1", "D1", "H4", "H1", "M15", "M5"],
    requiredTimeframesLoaded: true,
    chartDisplayCandleCount: 1_000,
    analysisDepthStatus: "sufficient",
    multiTimeframeContextStatus: "built",
    analysisTimeframesUsed: ["W1", "D1", "H4", "H1", "M15", "M5"],
    missingTimeframes: [],
    htfBiasSource: ["W1", "D1", "H4", "H1"],
    sessionModelSourceTimeframe: "M15",
    confirmationSourceTimeframe: "M5",
    weeklyBiasStatus: "loaded",
    weeklyBiasDirection: "bullish",
    weeklyBiasReason: "Controlled acceptance metadata supplies sufficient top-down context.",
    warnings: ["INT-3A.2 deterministic acceptance input."],
    generatedAt: at(90),
    authority: OPERATOR_AUTHORITY,
    safety: { rawCandlesExcluded: true, rawSnapshotsExcluded: true, accountDataExcluded: true, orderDataExcluded: true, positionDataExcluded: true, secretsExcluded: true }
  },
  displayCandles: ifvgCandles(),
  analysisCandlesByTimeframe: { M5: ifvgCandles(), M15: contextCandles["15m"], H1: contextCandles["1h"] },
  depthSummariesByTimeframe: {}
});

const trace: string[] = [];
let scenarioPromise: Promise<ResearchRuntimeSnapshot> | undefined;

export const readInt3a2ProductionAcceptanceTrace = () => trace.slice();

export const runInt3a2ProductionConflictAcceptance = () => {
  if (scenarioPromise) return scenarioPromise;
  scenarioPromise = (async () => {
    trace.length = 0;
    const runtime = await controlledRuntime();
    trace.push(`controlledSource:${runtime.marketData.symbol}/${runtime.marketData.activeResearchSource.provenance.providerSymbol ?? runtime.marketData.contract ?? "unavailable"}`);
    const bundle = controlledBundle();
    const ifvg = assessIctIfvgFreshRetestV3({
      sourceProvider: "mt5_read_only",
      sourceFingerprint: SOURCE_FINGERPRINT,
      requestedSymbol: "ES",
      brokerSymbol: "ES",
      timeframe: "5m",
      candles: ifvgCandles(),
      contextCandles
    });
    trace.push("assessIctIfvgFreshRetestV3", "adaptIfvgNativeGeometry");
    const ict2022 = evaluateIct2022Model(ict2022ShortInput());
    trace.push("evaluateIct2022Model", "G1.1 canonical geometry");
    let packetPromise: Promise<IctAdvisorPacket> | undefined;
    const packetBuilder = (): Promise<IctAdvisorPacket> => {
      packetPromise ??= Promise.resolve({
        packetId: "int-3a-2-controlled-packet",
        source: "gotrader_ict_strategy_suite",
        mode: "advisory_only",
        generatedAt: at(90),
        requestedSymbol: "ES",
        brokerSymbol: "ES",
        primaryTimeframe: "5m",
        htfTimeframes: ["15m", "1h"],
        activeSource: {
          provider: "mt5_read_only",
          candleCount: 1_000,
          firstTimestamp: ifvgCandles()[0]?.timestamp,
          lastTimestamp: ifvgCandles().at(-1)?.timestamp,
          sourceFingerprint: SOURCE_FINGERPRINT,
          sourceLabel: "INT-3A.2 controlled ES acceptance source",
          sourceStatus: { isMockOrSample: false, isResearchActive: true, isProxyInstrument: false, statusLabel: "Controlled production-path acceptance" }
        },
        marketAnalysisContext: bundle.context,
        signals: [],
        recommendedSignal: {
          strategyId: "ict-htf-bias",
          phase: "phase_1",
          symbol: "ES",
          requestedSymbol: "ES",
          brokerSymbol: "ES",
          primaryTimeframe: "5m",
          htfTimeframes: ["15m", "1h"],
          researchOnly: true,
          side: "flat",
          decision: "no_trade",
          confidence: 0,
          bias: { primary: "neutral", htf: {}, composite: "neutral" },
          setup: "htf_bias_only",
          summary: "Controlled inputs defer selection to canonical candidates.",
          noTradeReasons: ["Canonical candidate arbitration required."],
          riskNotes: [],
          provenance: { methodology: "ICT", phase: "phase_1", sourceSet: "ICT Mentorship Core Content", researchOnly: true, generatedAt: at(90) }
        },
        compactSummary: {
          compositeBias: "neutral",
          setup: "htf_bias_only",
          decision: "no_trade",
          side: "flat",
          confidence: 0,
          approvedProfileStatus: "no_trade",
          approvalScore: 0,
          noTradeReasonCount: 1,
          ifvgFreshRetestV3: compactIctIfvgFreshRetestV3Assessment(ifvg),
          coreIctCandidates: buildIctCoreCandidateCollection({ generatedAt: at(25), sourceFingerprint: SOURCE_FINGERPRINT, candidates: [ict2022] })
        },
        approvedProfileDecision: {
          profileId: "ict_default_v1",
          status: "no_trade",
          researchOnly: true,
          symbol: "ES",
          requestedSymbol: "ES",
          brokerSymbol: "ES",
          primaryTimeframe: "5m",
          htfTimeframes: ["15m", "1h"],
          strategyId: "ict-htf-bias",
          setup: "htf_bias_only",
          side: "flat",
          confidence: 0,
          approvalScore: 0,
          approvedReasons: [],
          rejectionReasons: ["Canonical candidate arbitration required."],
          watchlistReasons: [],
          authority: OPERATOR_AUTHORITY,
          safety: { rawCandlesExcluded: true, rawSnapshotsExcluded: true, accountDataExcluded: true, orderDataExcluded: true, positionDataExcluded: true, secretsExcluded: true },
          provenance: { methodology: "ICT", profile: "ict_default_v1", sourceSet: "ICT Mentorship Core Content", researchOnly: true, generatedAt: at(90) }
        }
      } as unknown as IctAdvisorPacket);
      return packetPromise;
    };
    const controlledPacket = await packetBuilder();
    const controlledRead = buildIctCurrentReadFromPacket(controlledPacket);
    if (controlledRead.currentOpportunitySummary?.canonicalSetupConflict !== "CONFLICTING_CANONICAL_SETUPS") {
      throw new Error(`INT-3A.2 upstream producer/read failure: ${JSON.stringify({
        ifvgActionable: ifvg.geometry?.actionable,
        ifvgGeometryId: ifvg.geometry?.geometryId,
        ictActionable: ict2022.actionable,
        ictGeometryId: ict2022.canonicalGeometry?.geometryId,
        compactIfvg: controlledPacket.compactSummary.ifvgFreshRetestV3?.geometry?.actionable,
        compactIct: controlledPacket.compactSummary.coreIctCandidates?.candidates.map((candidate) => ({ id: candidate.candidateId, actionable: candidate.actionable })),
        disposition: controlledRead.currentOpportunitySummary?.canonicalCandidateSetDisposition,
        canonicalCandidates: controlledRead.canonicalCandidates?.map((candidate) => ({ id: candidate.candidateId, strategy: candidate.strategyId, direction: candidate.direction, actionable: candidate.actionability })),
        opportunities: controlledRead.currentOpportunities?.filter((candidate) => candidate.strategyId.includes("ifvg") || candidate.strategyId.includes("2022")).map((candidate) => ({ id: candidate.candidateId, strategy: candidate.strategyId, status: candidate.status, blockers: candidate.blockers, missing: candidate.missingConditions })),
        blockers: controlledRead.currentOpportunitySummary?.topBlocker
      })}`);
    }
    saveOperatorCycleState({
      cycleId: CYCLE_ID,
      status: "completed",
      stage: "complete",
      progressPercent: 100,
      message: "INT-3A.2 controlled production conflict complete.",
      completedAt: at(90),
      sourceFingerprint: SOURCE_FINGERPRINT,
      authority: OPERATOR_AUTHORITY,
      autoApplyAllowed: false,
      researchOnly: true
    });
    await runIctActivateMarketPipeline(
      { snapshot: runtime, cycleId: CYCLE_ID },
      { onStepUpdate: (step) => {
        if (step.id === "build_current_read" && step.status === "completed") trace.push("Current Read production builder", "detectCurrentOpportunities", "buildCanonicalRuntimeCandidateSet");
        if (step.id === "build_signal_contract" && step.status === "completed") trace.push("signal-contract builder");
      } },
      { buildMarketAnalysisContext: async () => bundle, buildAdvisorPacketFromRuntime: packetBuilder }
    );
    trace.push("Activate Market production pipeline");
    const activation = readLatestActivateMarketSummary();
    const cycle = readOperatorCycleState();
    const snapshot = buildOperatorConsoleSnapshot({ runtime, activation, cycle, now: at(91) });
    if (snapshot.canonicalSetupConflict !== "CONFLICTING_CANONICAL_SETUPS" || snapshot.candidatePlans.length !== 2) {
      throw new Error(`INT-3A.2 controlled inputs did not produce the expected production conflict: ${JSON.stringify({
        activationConflict: activation?.canonicalSetupConflict,
        activationCandidates: activation?.candidatePlans?.map((candidate) => ({ id: candidate.candidateId, strategy: candidate.strategyId, actionable: candidate.actionable, blockers: candidate.blockers })),
        readDisposition: activation?.currentOpportunitySummary?.canonicalCandidateSetDisposition,
        snapshotConflict: snapshot.canonicalSetupConflict,
        snapshotCandidates: snapshot.candidatePlans.length
      })}`);
    }
    trace.push("buildOperatorConsoleSnapshot");
    if (typeof window !== "undefined") {
      (window as Window & { __GOTRADER_INT3A2_TRACE__?: string[] }).__GOTRADER_INT3A2_TRACE__ = trace.slice();
    }
    return runtime;
  })();
  return scenarioPromise;
};
