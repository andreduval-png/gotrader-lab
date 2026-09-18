import type {
  CanonicalLiveResearchOwnerId,
  CanonicalResearchCoverageContract,
  ResearchAuthority,
  ResearchCoverageBlockerCode,
  ResearchParticipationState,
  ResearchTier,
  ResearchTierPolicy
} from "./researchCoverageTypes";
import { RESEARCH_COVERAGE_CONTRACT_VERSION } from "./researchCoverageTypes";

export const RESEARCH_COVERAGE_AUTHORITY: ResearchAuthority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none",
  productionAdoptionAllowed: false,
  canCreateTradeIntent: false
});

const policy = (
  tier: ResearchTier,
  status: ResearchParticipationState,
  reason: string,
  blockers: readonly ResearchCoverageBlockerCode[] = []
): ResearchTierPolicy => Object.freeze({
  tier,
  status,
  supported: status === "SUPPORTED" || status === "SUPPORTED_WITH_LIMITATIONS" || status === "RESEARCH_ONLY",
  reason,
  blockers: Object.freeze([...blockers])
});

const certifiedDataset = (liveRequirementId: string, sessionPolicyVersion: string) => Object.freeze({
  liveRequirementId,
  historicalDatasetFamily: "gotrader.bt-g1-certified-mnq-ustech-proxy",
  historicalDatasetVersion: "sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d",
  certificateRequirement: "REQUIRED" as const,
  certificateId: "sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193",
  datasetChecksum: "sha256:4e51534035ca982a217ba64ec4438f7c2d7d7d19c7f0c1a0b6dff57b4539a0be",
  sourceFingerprintRequirement: "EXACT" as const,
  sourceFingerprint: "sha256:e164236affb51072322ce78bf297c03b3c403243e206a685b917792ac6db07bd",
  timezonePolicy: "America/New_York session-aware canonical timestamps",
  sessionPolicyVersion,
  continuityRequirement: "SESSION_AWARE_REQUIRED",
  completedBarPolicy: "COMPLETED_BARS_ONLY" as const,
  providerFallback: "PROHIBITED" as const
});

const frozenV4Dataset = Object.freeze({
  liveRequirementId: "research.ifvg_v4",
  historicalDatasetFamily: "mt5-read-only-ustech-proxy",
  historicalDatasetVersion: "ifvg-v4-frozen-180-day-source",
  certificateRequirement: "NOT_APPLICABLE" as const,
  sourceFingerprintRequirement: "EXACT" as const,
  sourceFingerprint: "FROZEN_PROFILE_SOURCE_BINDING_REQUIRED",
  timezonePolicy: "America/New_York session-aware canonical timestamps",
  sessionPolicyVersion: "ifvg-v4-session-policy.v1",
  continuityRequirement: "REPORT_ONLY",
  completedBarPolicy: "COMPLETED_BARS_ONLY" as const,
  providerFallback: "PROHIBITED" as const
});

const resource = (resourceClass: "LIGHT" | "MEDIUM" | "HEAVY" | "CERTIFIED_HEAVY", estimatedMemoryMb: number) => Object.freeze({
  resourceClass,
  estimatedMemoryMb,
  supportsCheckpoint: resourceClass === "CERTIFIED_HEAVY",
  supportsBoundedBatch: true,
  schedulingPolicy: "SERIAL" as const,
  maximumStrategyConcurrency: 1,
  sharedCanonicalContextRequired: true
});

const historicalBlockers = (...extra: ResearchCoverageBlockerCode[]) => Object.freeze([
  "HISTORICAL_ADAPTER_NOT_ADOPTED" as const,
  "CERTIFIED_DATASET_NOT_BOUND" as const,
  ...extra
]);

export const CANONICAL_LIVE_RESEARCH_OWNER_ORDER: readonly CanonicalLiveResearchOwnerId[] = Object.freeze([
  "ifvg_fresh_retest_v3_research",
  "ict_2022_model_v1",
  "ict_market_maker_buy_model_v1",
  "ict_market_maker_sell_model_v1",
  "nasdaq_london_raid_ny_reversal_v1"
]);

const registry: readonly CanonicalResearchCoverageContract[] = Object.freeze([
  Object.freeze({
    contractVersion: RESEARCH_COVERAGE_CONTRACT_VERSION,
    ownerStrategyId: "ifvg_fresh_retest_v3_research",
    ownerStrategyVersion: "v3",
    researchProfileId: "ifvg_fresh_retest_v3_research",
    runtimeAdmissionStatus: "LIVE_OWNER",
    liveFactComplete: true,
    geometryPolicyId: "ifvg_fresh_retest_v3_research.native-liquidity-target",
    geometryPolicyVersion: "v3",
    parameterIdentity: "ifvg-v3-frozen-profile-2026-07-14",
    tacticalResearchPolicy: policy("TACTICAL_RESEARCH", "SUPPORTED", "The current tree has the owner-native IFVG v3 detector backtest path."),
    historicalValidationPolicy: policy("HISTORICAL_VALIDATION", "SUPPORTED", "RC1B binds the frozen v3 producer, canonical envelope, and certified dataset identity."),
    walkForwardPolicy: policy("WALK_FORWARD", "SUPPORTED_WITH_LIMITATIONS", "RC1B provides an owner-specific causal fold binding; large walk-forward remains a later gate."),
    oosPolicy: policy("OOS", "SUPPORTED_WITH_LIMITATIONS", "Owner-specific certified OOS routing is available; no large OOS run was performed in RC1B."),
    readinessPolicy: policy("READINESS", "ADAPTER_REQUIRED", "Readiness is IFVG-family-centric but is not bound to the current certified historical adapter identity.", ["OWNER_SPECIFIC_READINESS_NOT_IMPLEMENTED"]),
    forwardEvidencePolicy: policy("FORWARD_EVIDENCE", "SUPPORTED_WITH_LIMITATIONS", "Forward evidence is valid only for exact v3 profile and policy identities."),
    historicalGeometryAdapterId: "gotrader.bt-g1.ifvg-v3.canonical-adapter",
    foldRunnerId: "gotrader.fold.ifvg-v3.control-owner-adapter",
    datasetRequirement: certifiedDataset("live.ifvg_v3", "ifvg-v3-session-policy.v1"),
    researchWindow: { contextRequirementId: "live.ifvg_v3", warmupRequirement: "100 M5 bars", evaluationRequirement: "bounded owner-native tactical slice", maximumContextBars: 300, maximumEvaluationBars: 1000 },
    validationWindow: { contextRequirementId: "historical.ifvg_v3", warmupRequirement: "100 M5 bars per fold", evaluationRequirement: "certified chronological partitions", minimumCalendarDays: 180 },
    evidenceNamespace: "gotrader.research.ifvg-v3",
    evidenceVersion: "rc1a-v1",
    resourceBudget: resource("CERTIFIED_HEAVY", 768),
    blockers: ["OWNER_SPECIFIC_READINESS_NOT_IMPLEMENTED"] as const,
    reason: "Live and historical v3 owner identity converge; readiness remains fail-closed pending current evidence.",
    authority: RESEARCH_COVERAGE_AUTHORITY
  }),
  Object.freeze({
    contractVersion: RESEARCH_COVERAGE_CONTRACT_VERSION,
    ownerStrategyId: "ict_2022_model_v1",
    ownerStrategyVersion: "2.0.0-int3a",
    researchProfileId: "ict_2022_canonical_research_v1",
    runtimeAdmissionStatus: "LIVE_OWNER",
    liveFactComplete: true,
    geometryPolicyId: "gotrader.ict-2022.geometry.v1",
    geometryPolicyVersion: "1.0.0",
    parameterIdentity: "ict-2022-v2-int3a-canonical",
    tacticalResearchPolicy: policy("TACTICAL_RESEARCH", "ADAPTER_REQUIRED", "Start Research Cycle has no owner-specific ICT 2022 tactical evaluator.", ["OWNER_SPECIFIC_TACTICAL_ADAPTER_MISSING"]),
    historicalValidationPolicy: policy("HISTORICAL_VALIDATION", "SUPPORTED", "RC1B invokes the current 2.0.0-int3a owner with causal facts and certified identity."),
    walkForwardPolicy: policy("WALK_FORWARD", "SUPPORTED_WITH_LIMITATIONS", "RC1B provides the owner-specific current-version fold binding; large walk-forward remains deferred."),
    oosPolicy: policy("OOS", "SUPPORTED_WITH_LIMITATIONS", "Current-version OOS routing is available; no large OOS run was performed in RC1B."),
    readinessPolicy: policy("READINESS", "ADAPTER_REQUIRED", "The readiness engine lacks ICT 2022 owner identity consumption.", ["OWNER_SPECIFIC_READINESS_NOT_IMPLEMENTED"]),
    forwardEvidencePolicy: policy("FORWARD_EVIDENCE", "ADAPTER_REQUIRED", "No exact owner-specific forward evidence lane is available.", ["OWNER_SPECIFIC_READINESS_NOT_IMPLEMENTED"]),
    historicalGeometryAdapterId: "gotrader.bt-g1.ict-2022.canonical-adapter",
    foldRunnerId: "gotrader.fold.ict-2022.control-owner-adapter",
    datasetRequirement: certifiedDataset("live.ict_2022", "ict-2022-new-york-session.v1"),
    researchWindow: { contextRequirementId: "live.ict_2022", warmupRequirement: "DH1 W1-D1-H4-H1-M15-M5 requirements", evaluationRequirement: "owner-specific tactical window" },
    validationWindow: { contextRequirementId: "historical.ict_2022", warmupRequirement: "owner-specific multi-timeframe warmup", evaluationRequirement: "certified chronological partitions" },
    evidenceNamespace: "gotrader.research.ict-2022",
    evidenceVersion: "rc1a-v1",
    resourceBudget: resource("CERTIFIED_HEAVY", 896),
    blockers: ["OWNER_SPECIFIC_READINESS_NOT_IMPLEMENTED", "OWNER_SPECIFIC_TACTICAL_ADAPTER_MISSING"] as const,
    reason: "Historical current-owner parity is integrated; tactical and readiness orchestration remain later-gate work.",
    authority: RESEARCH_COVERAGE_AUTHORITY
  }),
  ...(["buy", "sell"] as const).map((side): CanonicalResearchCoverageContract => {
    const buy = side === "buy";
    const strategyId = buy ? "ict_market_maker_buy_model_v1" : "ict_market_maker_sell_model_v1";
    const profileId = buy ? "ict_mmbm_base_research_v1" : "ict_mmsm_base_research_v1";
    const shortName = buy ? "mmbm" : "mmsm";
    return Object.freeze({
      contractVersion: RESEARCH_COVERAGE_CONTRACT_VERSION,
      ownerStrategyId: strategyId,
      ownerStrategyVersion: "1.0.0",
      researchProfileId: profileId,
      runtimeAdmissionStatus: "LIVE_OWNER",
      liveFactComplete: true,
      geometryPolicyId: "gotrader.ict.i3.market-maker.geometry.v1",
      geometryPolicyVersion: "1.0.0",
      parameterIdentity: "gotrader.ict.i3.market-maker.parameters.v1",
      tacticalResearchPolicy: policy("TACTICAL_RESEARCH", "ADAPTER_REQUIRED", `Start Research Cycle has no DH4 ${shortName.toUpperCase()} tactical evaluator.`, ["OWNER_SPECIFIC_TACTICAL_ADAPTER_MISSING", "MARKET_MAKER_DH4_SEQUENCE_REQUIRED"]),
      historicalValidationPolicy: policy("HISTORICAL_VALIDATION", "SUPPORTED", "RC1B invokes the frozen DH4 MarketMakerDeliverySequence owner without transition injection."),
      walkForwardPolicy: policy("WALK_FORWARD", "SUPPORTED_WITH_LIMITATIONS", "RC1B provides a DH4 owner-specific fold binding; large walk-forward remains deferred."),
      oosPolicy: policy("OOS", "SUPPORTED_WITH_LIMITATIONS", "DH4 owner-specific OOS routing is available; no large OOS run was performed in RC1B."),
      readinessPolicy: policy("READINESS", "ADAPTER_REQUIRED", "Readiness has no DH4 market-maker evidence identity consumer.", ["OWNER_SPECIFIC_READINESS_NOT_IMPLEMENTED"]),
      forwardEvidencePolicy: policy("FORWARD_EVIDENCE", "ADAPTER_REQUIRED", "No DH4 owner-specific closed-bar evidence lane exists.", ["OWNER_SPECIFIC_READINESS_NOT_IMPLEMENTED"]),
      historicalGeometryAdapterId: `gotrader.bt-g1.${shortName}.canonical-adapter`,
      foldRunnerId: `gotrader.fold.${shortName}.control-owner-adapter`,
      datasetRequirement: certifiedDataset(`live.${shortName}`, "market-maker-new-york-delivery.v1"),
      researchWindow: { contextRequirementId: `live.${shortName}`, warmupRequirement: "DH1 D1-H4-H1-M15-M5 requirements", evaluationRequirement: "same-range delivery sequence" },
      validationWindow: { contextRequirementId: `historical.${shortName}`, warmupRequirement: "same-range canonical fact warmup", evaluationRequirement: "certified DH4 delivery-sequence folds" },
      evidenceNamespace: `gotrader.research.${shortName}`,
      evidenceVersion: "rc1a-v1",
      resourceBudget: resource("CERTIFIED_HEAVY", 960),
      blockers: ["OWNER_SPECIFIC_READINESS_NOT_IMPLEMENTED", "OWNER_SPECIFIC_TACTICAL_ADAPTER_MISSING"] as const,
      reason: "Live and historical DH4 owner semantics converge; legacy transition evidence remains quarantined.",
      authority: RESEARCH_COVERAGE_AUTHORITY
    });
  }),
  Object.freeze({
    contractVersion: RESEARCH_COVERAGE_CONTRACT_VERSION,
    ownerStrategyId: "nasdaq_london_raid_ny_reversal_v1",
    ownerStrategyVersion: "1.0.0",
    researchProfileId: "nasdaq_london_raid_ny_reversal_v1",
    runtimeAdmissionStatus: "LIVE_OWNER",
    liveFactComplete: true,
    geometryPolicyId: "nasdaq_london_raid_ny_reversal_v1.native-sellside-liquidity",
    geometryPolicyVersion: "2.0.0-nearest-native-objective",
    parameterIdentity: "london-raid-v1-session-policy",
    tacticalResearchPolicy: policy("TACTICAL_RESEARCH", "SUPPORTED_WITH_LIMITATIONS", "Dedicated London replay tests exist, but Start Research Cycle has no owner-registry dispatch."),
    historicalValidationPolicy: policy("HISTORICAL_VALIDATION", "SUPPORTED", "The corrected live owner and RC1B historical adapter preserve exact nearest-native-objective geometry and policy identity."),
    walkForwardPolicy: policy("WALK_FORWARD", "SUPPORTED_WITH_LIMITATIONS", "The parity-verified owner-specific fold binding is available; large walk-forward remains a later gate."),
    oosPolicy: policy("OOS", "SUPPORTED_WITH_LIMITATIONS", "Owner-specific OOS routing is available under corrected policy v2; no large OOS run was performed."),
    readinessPolicy: policy("READINESS", "ADAPTER_REQUIRED", "Readiness has no London owner-specific evidence consumer.", ["OWNER_SPECIFIC_READINESS_NOT_IMPLEMENTED"]),
    forwardEvidencePolicy: policy("FORWARD_EVIDENCE", "ADAPTER_REQUIRED", "No London owner-specific forward evidence lane exists.", ["OWNER_SPECIFIC_READINESS_NOT_IMPLEMENTED"]),
    historicalGeometryAdapterId: "gotrader.bt-g1.london-raid-v1.canonical-adapter",
    foldRunnerId: "gotrader.fold.london-raid-v1.control-owner-adapter",
    datasetRequirement: certifiedDataset("live.london_raid_v1", "london-new-york-session.v1"),
    researchWindow: { contextRequirementId: "live.london_raid_v1", warmupRequirement: "DH1 W1-D1-H4-H1-M15-M5 plus session history", evaluationRequirement: "complete Asia/London/New York sessions" },
    validationWindow: { contextRequirementId: "historical.london_raid_v1", warmupRequirement: "two-week/session context", evaluationRequirement: "certified complete-session partitions" },
    evidenceNamespace: "gotrader.research.london-raid-v1",
    evidenceVersion: "london-target-policy-v2",
    resourceBudget: resource("HEAVY", 768),
    blockers: ["OWNER_SPECIFIC_READINESS_NOT_IMPLEMENTED"] as const,
    reason: "Live and historical target policy converge at v2; readiness remains fail-closed and legacy R:R-selected-target evidence stays invalidated.",
    authority: RESEARCH_COVERAGE_AUTHORITY
  }),
  Object.freeze({
    contractVersion: RESEARCH_COVERAGE_CONTRACT_VERSION,
    ownerStrategyId: "ifvg_fresh_retest_v4_candidate",
    ownerStrategyVersion: "v4",
    researchProfileId: "ifvg_fresh_retest_v4_candidate",
    runtimeAdmissionStatus: "RESEARCH_ONLY",
    liveFactComplete: false,
    geometryPolicyId: "ifvg_fresh_retest_v4_candidate.native-liquidity-target",
    geometryPolicyVersion: "v4",
    parameterIdentity: "ifvg-v4-frozen-profile-2026-07-19",
    tacticalResearchPolicy: policy("TACTICAL_RESEARCH", "RESEARCH_ONLY", "Preserve the existing bounded 1000-M5 v4 lane, separately labeled from live owners."),
    historicalValidationPolicy: policy("HISTORICAL_VALIDATION", "SUPPORTED_WITH_LIMITATIONS", "The existing 180-day validation is research-only and does not establish live admission."),
    walkForwardPolicy: policy("WALK_FORWARD", "SUPPORTED_WITH_LIMITATIONS", "Existing detector-profile walk-forward remains isolated to v4 identity."),
    oosPolicy: policy("OOS", "SUPPORTED_WITH_LIMITATIONS", "Existing OOS evidence remains v4-only."),
    readinessPolicy: policy("READINESS", "DISABLED_BY_POLICY", "Research-only v4 cannot confer live-owner readiness.", ["RESEARCH_ONLY_NOT_LIVE_OWNER"]),
    forwardEvidencePolicy: policy("FORWARD_EVIDENCE", "RESEARCH_ONLY", "Forward evidence remains v4 research-only."),
    historicalGeometryAdapterId: "gotrader.current.ifvg-v4.detector-profile-adapter",
    foldRunnerId: "gotrader.current.ifvg-v4.detector-profile-walk-forward",
    datasetRequirement: frozenV4Dataset,
    researchWindow: { contextRequirementId: "research.ifvg_v4", warmupRequirement: "100 M5 bars", evaluationRequirement: "900 M5 bars", maximumContextBars: 100, maximumEvaluationBars: 900 },
    validationWindow: { contextRequirementId: "validation.ifvg_v4", warmupRequirement: "100 M5 bars", evaluationRequirement: "up to 49,900 M5 bars", maximumEvaluationBars: 49_900, minimumCalendarDays: 180 },
    evidenceNamespace: "gotrader.research.ifvg-v4",
    evidenceVersion: "rc1a-v1",
    resourceBudget: resource("HEAVY", 640),
    blockers: ["RESEARCH_ONLY_NOT_LIVE_OWNER" as const],
    reason: "Separate research lane; no v4-to-v3 evidence inheritance and no live admission.",
    authority: RESEARCH_COVERAGE_AUTHORITY
  })
]);

export const canonicalResearchCoverageRegistry = registry;

export const canonicalLiveResearchCoverage = () =>
  registry.filter((entry): entry is CanonicalResearchCoverageContract & { ownerStrategyId: CanonicalLiveResearchOwnerId } =>
    entry.runtimeAdmissionStatus === "LIVE_OWNER"
  );

export const researchOnlyCoverage = () => registry.filter((entry) => entry.runtimeAdmissionStatus === "RESEARCH_ONLY");

export const findResearchCoverage = (strategyId: string) => registry.find((entry) => entry.ownerStrategyId === strategyId);
