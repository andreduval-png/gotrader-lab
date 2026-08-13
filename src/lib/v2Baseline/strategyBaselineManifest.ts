import { STRATEGY_DEFINITIONS, STRATEGY_LIBRARY_AUTHORITY } from "../strategyLibrary/strategyRegistry";
import type { StrategyDefinition } from "../strategyLibrary/strategyLibraryTypes";
import type {
  StrategyBaselineClassification,
  StrategyBaselineDetectorStatus,
  StrategyBaselineManifestEntry,
  StrategyBaselineManifestValidationIssue,
  StrategyBaselineManifestValidationResult
} from "./baselineTypes";

type StrategyBaselineSupplement = {
  profileVersion: string;
  classification: StrategyBaselineClassification;
  detectorStatus?: StrategyBaselineDetectorStatus;
  detectorPaths?: string[];
  typePaths?: string[];
  tradeConstructionPaths?: string[];
  validationProfilePaths?: string[];
  replayScripts?: string[];
  oosScripts?: string[];
  evidencePaths?: string[];
  uiConsumers?: string[];
  testCommands: string[];
  baselineFixtureIds: string[];
  notes?: string[];
};

const suite = "src/lib/ict-strategy-suite";
const registryPath = "src/lib/strategyLibrary/strategyRegistry.ts";
const sharedTradeConstruction = [`${suite}/ictTradeConstruction.ts`];
const sharedUi = [
  "src/components/operator/OperatorDecisionsView.tsx",
  "src/components/advisor/ResearchAdvisorView.tsx",
  "src/components/ict-lab/ICTLab.tsx"
];

const supplements: Record<string, StrategyBaselineSupplement> = {
  silver_bullet_v1: {
    profileVersion: "v1",
    classification: "behavioral_fixture",
    detectorPaths: [`${suite}/ictSilverBullet.ts`],
    typePaths: [`${suite}/ictSilverBulletTypes.ts`],
    tradeConstructionPaths: sharedTradeConstruction,
    validationProfilePaths: [registryPath],
    replayScripts: ["scripts/test-silver-bullet-performance.mjs"],
    oosScripts: ["scripts/test-silver-bullet-performance.mjs"],
    evidencePaths: ["docs/silver-bullet-performance-audit.md"],
    testCommands: ["test:ict-silver-bullet", "test:silver-bullet-performance"],
    baselineFixtureIds: ["silver_bullet_v1_behavior"],
    notes: ["Executable research baseline; historical performance is not a positive-edge claim."]
  },
  silver_bullet_v2_refined_research: {
    profileVersion: "v2",
    classification: "behavioral_fixture",
    detectorPaths: [`${suite}/ictSilverBullet.ts`],
    typePaths: [`${suite}/ictSilverBulletTypes.ts`],
    tradeConstructionPaths: sharedTradeConstruction,
    validationProfilePaths: [registryPath],
    replayScripts: ["scripts/test-silver-bullet-v2-performance.mjs"],
    oosScripts: ["scripts/test-silver-bullet-v2-performance.mjs"],
    evidencePaths: ["docs/silver-bullet-v2-refinement-audit.md"],
    testCommands: ["test:ict-silver-bullet-v2", "test:silver-bullet-v2-performance"],
    baselineFixtureIds: ["silver_bullet_v2_behavior"],
    notes: ["Refined research detector with a small historical sample."]
  },
  camerons_model_research_v1: {
    profileVersion: "v1",
    classification: "placeholder",
    detectorStatus: "placeholder",
    testCommands: ["test:strategy-library"],
    baselineFixtureIds: ["camerons_model_catalog_only"],
    notes: ["Catalog vocabulary only; no deterministic detector or trade plan."]
  },
  ifvg_v1: {
    profileVersion: "v1",
    classification: "behavioral_fixture",
    detectorPaths: [`${suite}/ictIfvg.ts`],
    typePaths: [`${suite}/ictIfvgTypes.ts`],
    tradeConstructionPaths: sharedTradeConstruction,
    validationProfilePaths: ["src/lib/backtesting/runBacktest.ts", registryPath],
    replayScripts: ["scripts/test-ifvg-performance.mjs"],
    oosScripts: ["scripts/test-ifvg-performance.mjs"],
    evidencePaths: ["docs/ifvg-performance-audit.md"],
    testCommands: ["test:ict-ifvg", "test:ifvg-performance"],
    baselineFixtureIds: ["ifvg_v1_valid", "ifvg_v1_blocked"],
    notes: ["Broad IFVG comparator; target-first rate alone is not an edge claim."]
  },
  ifvg_filtered_v2_research: {
    profileVersion: "v2",
    classification: "negative_control",
    detectorPaths: [`${suite}/ictIfvg.ts`, `${suite}/ictIfvgFilteredV2.ts`],
    typePaths: [`${suite}/ictIfvgTypes.ts`],
    tradeConstructionPaths: sharedTradeConstruction,
    validationProfilePaths: ["src/lib/backtesting/runBacktest.ts", "src/lib/walkForward/detectorProfileWalkForward.ts"],
    replayScripts: ["scripts/test-ifvg-performance.mjs", "scripts/test-ifvg-filter-variants.mjs"],
    oosScripts: ["scripts/test-detector-profile-walk-forward.mjs"],
    evidencePaths: ["docs/ifvg-v2-causal-validation-audit.md", "docs/ifvg-expectancy-classifier-audit.md"],
    testCommands: ["test:ict-ifvg", "test:ifvg-filter-variants", "test:detector-profile-walk-forward"],
    baselineFixtureIds: ["ifvg_v2_negative_control"],
    notes: ["Frozen causal negative control; independent validation did not establish a promotable edge."]
  },
  ifvg_fresh_retest_v3_research: {
    profileVersion: "v3",
    classification: "positive_canary",
    detectorPaths: [`${suite}/ictIfvg.ts`, `${suite}/ictIfvgFreshRetestV3.ts`],
    typePaths: [`${suite}/ictIfvgTypes.ts`],
    tradeConstructionPaths: sharedTradeConstruction,
    validationProfilePaths: ["src/lib/backtesting/runBacktest.ts", "src/lib/walkForward/detectorProfileWalkForward.ts"],
    replayScripts: ["scripts/test-ifvg-performance.mjs"],
    oosScripts: ["scripts/test-detector-profile-walk-forward.mjs"],
    evidencePaths: ["docs/ifvg-fresh-retest-v3-validation-audit.md", "src/lib/forwardEvidence"],
    testCommands: ["test:ict-ifvg", "test:detector-profile-walk-forward", "test:forward-evidence-ledger"],
    baselineFixtureIds: ["ifvg_v3_valid", "ifvg_v3_forming", "ifvg_v3_rejected", "ifvg_v3_historical_oos"],
    notes: ["Positive migration canary only; remains research-only and requires untouched forward evidence."]
  },
  ifvg_fresh_retest_v4_candidate: {
    profileVersion: "v4",
    classification: "experimental",
    detectorStatus: "experimental",
    detectorPaths: [`${suite}/ictIfvg.ts`, `${suite}/ictIfvgFreshRetestV3.ts`, `${suite}/ictIfvgShallowRetestV4.ts`],
    typePaths: [`${suite}/ictIfvgTypes.ts`],
    tradeConstructionPaths: sharedTradeConstruction,
    validationProfilePaths: ["src/lib/backtesting/runBacktest.ts", "src/lib/forwardEvidence"],
    replayScripts: ["scripts/test-ifvg-performance.mjs"],
    oosScripts: ["scripts/test-forward-evidence-ledger.mjs"],
    evidencePaths: ["src/lib/forwardEvidence"],
    testCommands: ["test:ict-ifvg", "test:forward-evidence-ledger"],
    baselineFixtureIds: ["ifvg_v4_shallow_candidate", "ifvg_v4_deep_retest_blocked"],
    notes: ["Versioned forward candidate; no automatic Paper-Demo promotion."]
  },
  turtle_soup_v1: {
    profileVersion: "v1",
    classification: "behavioral_fixture",
    detectorPaths: [`${suite}/ictTurtleSoup.ts`],
    typePaths: [`${suite}/ictTurtleSoupTypes.ts`],
    tradeConstructionPaths: sharedTradeConstruction,
    validationProfilePaths: [registryPath],
    replayScripts: ["scripts/test-turtle-soup-performance.mjs"],
    oosScripts: ["scripts/test-turtle-soup-performance.mjs"],
    evidencePaths: ["docs/turtle-soup-performance-audit.md"],
    testCommands: ["test:ict-turtle-soup", "test:turtle-soup-performance"],
    baselineFixtureIds: ["turtle_soup_valid", "turtle_soup_no_setup"],
    notes: ["Strict false-break reversal detector; preserve blocker behavior."]
  },
  crt_research_v1: {
    profileVersion: "v1",
    classification: "placeholder",
    detectorStatus: "placeholder",
    testCommands: ["test:strategy-library"],
    baselineFixtureIds: ["crt_catalog_only"]
  },
  ote_research_v1: {
    profileVersion: "v1",
    classification: "placeholder",
    detectorStatus: "placeholder",
    testCommands: ["test:strategy-library"],
    baselineFixtureIds: ["ote_catalog_only"]
  },
  cisd_v1: {
    profileVersion: "v1",
    classification: "behavioral_fixture",
    detectorPaths: [`${suite}/ictCisd.ts`],
    typePaths: [`${suite}/ictCisdTypes.ts`],
    tradeConstructionPaths: sharedTradeConstruction,
    validationProfilePaths: [registryPath],
    replayScripts: ["scripts/test-cisd-performance.mjs"],
    oosScripts: ["scripts/test-cisd-performance.mjs"],
    evidencePaths: ["docs/cisd-performance-audit.md"],
    testCommands: ["test:ict-cisd", "test:cisd-performance"],
    baselineFixtureIds: ["cisd_bullish_valid", "cisd_chop_blocked"]
  },
  amd_power_of_three_research_v1: {
    profileVersion: "v1",
    classification: "placeholder",
    detectorStatus: "placeholder",
    detectorPaths: [`${suite}/ictSessionNarrative.ts`],
    typePaths: [`${suite}/ictSessionNarrativeTypes.ts`],
    testCommands: ["test:ict-session-model-recognition"],
    baselineFixtureIds: ["amd_catalog_only"],
    notes: ["Catalog entry is not a second implementation of existing session/CMD narrative logic."]
  },
  ict_cmd_short_paper_watchlist_v1: {
    profileVersion: "v1",
    classification: "behavioral_fixture",
    detectorStatus: "placeholder",
    detectorPaths: [`${suite}/ictSessionNarrative.ts`, `${suite}/ictCmdIndependentDateGate.ts`, `${suite}/ictCmdTelemetry.ts`],
    typePaths: [`${suite}/ictCmdIndependentDateGateTypes.ts`, `${suite}/ictCmdTelemetryTypes.ts`],
    tradeConstructionPaths: sharedTradeConstruction,
    validationProfilePaths: [`${suite}/ictCmdIndependentDateGate.ts`, registryPath],
    replayScripts: ["scripts/test-ict-paper-watchlist-performance.mjs"],
    oosScripts: ["scripts/test-ict-cmd-paper-watchlist-oos.mjs"],
    evidencePaths: ["docs/cmd-deep-telemetry-audit.md"],
    testCommands: ["test:ict-cmd-paper-watchlist-diagnostic", "test:ict-cmd-paper-watchlist-oos", "test:cmd-independent-date-gate"],
    baselineFixtureIds: ["cmd_short_date_concentrated_blocked"],
    notes: ["Adjacent tooling exists, but registry detector ownership remains placeholder-level and overfit-risk."]
  },
  cmd_high_displacement_v2_research: {
    profileVersion: "v2",
    classification: "experimental",
    detectorStatus: "experimental",
    detectorPaths: [`${suite}/ictCmdHighDisplacementV2.ts`],
    typePaths: [`${suite}/ictCmdHighDisplacementV2Types.ts`],
    tradeConstructionPaths: sharedTradeConstruction,
    validationProfilePaths: [registryPath],
    replayScripts: ["scripts/test-cmd-high-displacement-v2-performance.mjs"],
    oosScripts: ["scripts/test-cmd-high-displacement-v2-performance.mjs"],
    evidencePaths: ["docs/cmd-deep-telemetry-audit.md"],
    testCommands: ["test:ict-cmd-high-displacement-v2", "test:cmd-high-displacement-v2-performance"],
    baselineFixtureIds: ["cmd_high_displacement_v2_research_only"]
  },
  grinch_reversal_expansion_confirmation_v1: {
    profileVersion: "v1",
    classification: "behavioral_fixture",
    detectorStatus: "placeholder",
    detectorPaths: ["src/lib/strategyLibrary/grinchPhase2ReversalModel.ts", `${suite}/ictStrategySuiteEngines.ts`],
    typePaths: ["src/lib/strategyLibrary/grinchStrategyTypes.ts", `${suite}/ictGrinchModelTypes.ts`],
    tradeConstructionPaths: sharedTradeConstruction,
    validationProfilePaths: ["src/lib/strategyLibrary/grinchProfileSelection.ts"],
    replayScripts: ["scripts/test-ict-replay-diagnostics.mjs"],
    oosScripts: ["scripts/test-ict-out-of-sample-validation.mjs"],
    evidencePaths: ["src/lib/strategyLibrary/grinchExpansionReplayDiagnostics.ts"],
    testCommands: ["test:ict-strategy-suite", "test:ict-replay-diagnostics"],
    baselineFixtureIds: ["grinch_reversal_legacy_parity"],
    notes: ["Distributed legacy implementation; adapt rather than reinterpret."]
  },
  grinch_model_1_research_v1: {
    profileVersion: "v1",
    classification: "behavioral_fixture",
    detectorStatus: "placeholder",
    detectorPaths: ["src/lib/strategyLibrary/grinchPhase1Model.ts", `${suite}/ictStrategySuiteEngines.ts`],
    typePaths: ["src/lib/strategyLibrary/grinchStrategyTypes.ts"],
    validationProfilePaths: ["src/lib/strategyLibrary/grinchProfileSelection.ts"],
    replayScripts: ["scripts/test-ict-model-fidelity-audit.mjs"],
    oosScripts: ["scripts/test-ict-out-of-sample-validation.mjs"],
    evidencePaths: ["docs/grinch-ict-phase-1.md"],
    testCommands: ["test:ict-strategy-suite", "test:ict-model-fidelity-audit"],
    baselineFixtureIds: ["grinch_model_one_legacy_parity"]
  },
  grinch_consolidation_research_v1: {
    profileVersion: "v1",
    classification: "behavioral_fixture",
    detectorStatus: "placeholder",
    detectorPaths: ["src/lib/strategyLibrary/grinchPhase3ConsolidationModel.ts", `${suite}/ictStrategySuiteEngines.ts`],
    typePaths: ["src/lib/strategyLibrary/grinchStrategyTypes.ts"],
    validationProfilePaths: ["src/lib/strategyLibrary/grinchProfileSelection.ts"],
    replayScripts: ["scripts/test-ict-model-fidelity-audit.mjs"],
    oosScripts: ["scripts/test-ict-out-of-sample-validation.mjs"],
    evidencePaths: ["docs/grinch-ict-phase-3-consolidation-profile.md"],
    testCommands: ["test:ict-strategy-suite", "test:ict-model-fidelity-audit"],
    baselineFixtureIds: ["grinch_consolidation_legacy_parity"]
  },
  pd_array_setup_research_v1: {
    profileVersion: "v1",
    classification: "placeholder",
    detectorStatus: "placeholder",
    detectorPaths: [`${suite}/ictUniversalRecognition.ts`],
    typePaths: [`${suite}/ictUniversalRecognitionTypes.ts`],
    testCommands: ["test:ict-universal-recognition", "test:strategy-library"],
    baselineFixtureIds: ["pd_array_forming_only"],
    notes: ["Recognition alone cannot create evidence."]
  },
  scalp_setup_research_v1: {
    profileVersion: "v1",
    classification: "placeholder",
    detectorStatus: "placeholder",
    detectorPaths: [`${suite}/ictUniversalRecognition.ts`],
    typePaths: [`${suite}/ictUniversalRecognitionTypes.ts`],
    testCommands: ["test:ict-universal-recognition", "test:strategy-library"],
    baselineFixtureIds: ["scalp_forming_only"]
  },
  nasdaq_london_raid_ny_reversal_v1: {
    profileVersion: "v1",
    classification: "behavioral_fixture",
    detectorPaths: [`${suite}/ictSessionRaidReversal.ts`],
    typePaths: [`${suite}/ictSessionRaidReversalTypes.ts`],
    tradeConstructionPaths: sharedTradeConstruction,
    validationProfilePaths: [registryPath],
    replayScripts: ["scripts/test-session-raid-reversal.mjs", "scripts/test-session-raid-reversal-evidence-depth.mjs"],
    oosScripts: ["scripts/test-session-raid-reversal-evidence-depth.mjs"],
    evidencePaths: ["docs/session-raid-reversal-90day-evidence-audit.md"],
    testCommands: ["test:session-raid-reversal", "test:session-raid-reversal-evidence-depth"],
    baselineFixtureIds: ["session_raid_v1_complete", "session_raid_v1_no_trade"]
  },
  nasdaq_london_raid_ny_reversal_v2_filtered_research: {
    profileVersion: "v2",
    classification: "behavioral_fixture",
    detectorPaths: [`${suite}/ictSessionRaidReversal.ts`, `${suite}/ictSessionRaidReversalV2.ts`],
    typePaths: [`${suite}/ictSessionRaidReversalTypes.ts`, `${suite}/ictSessionRaidReversalV2Types.ts`],
    tradeConstructionPaths: sharedTradeConstruction,
    validationProfilePaths: [registryPath],
    replayScripts: ["scripts/test-session-raid-reversal-v2-filtered.mjs"],
    oosScripts: ["scripts/test-session-raid-reversal-v2-filtered.mjs"],
    evidencePaths: ["docs/session-raid-reversal-v2-filtered-audit.md"],
    testCommands: ["test:session-raid-reversal-v2-filtered", "test:session-raid-reversal-winner-loser"],
    baselineFixtureIds: ["session_raid_v2_filtered_behavior"]
  },
  market_map_only_diagnostic_v1: {
    profileVersion: "v1",
    classification: "diagnostic",
    detectorStatus: "diagnostic",
    detectorPaths: ["src/lib/currentOpportunity/detectCurrentOpportunities.ts"],
    typePaths: ["src/lib/currentOpportunity/currentOpportunityTypes.ts"],
    validationProfilePaths: ["src/lib/strategyLibrary/strategyEligibility.ts"],
    evidencePaths: ["src/lib/validationChain/buildValidationChain.ts"],
    testCommands: ["test:current-opportunity-scanner", "test:validation-chain", "test:paper-demo-operations"],
    baselineFixtureIds: ["market_map_context_only"],
    notes: ["Must never receive entry, stop, target, RR, evidence, or Paper-Demo eligibility."]
  }
};

const detectorStatusFor = (
  definition: StrategyDefinition,
  supplement: StrategyBaselineSupplement
): StrategyBaselineDetectorStatus => {
  if (supplement.detectorStatus) return supplement.detectorStatus;
  if (definition.detectorStatus === "executable_research") return "executable_research";
  if (definition.detectorStatus === "diagnostic_only") return "diagnostic";
  return "placeholder";
};

const entryForDefinition = (definition: StrategyDefinition): StrategyBaselineManifestEntry => {
  const supplement = supplements[definition.id];
  if (!supplement) {
    throw new Error(`Missing Phase 0 supplement for Strategy Library entry ${definition.id}.`);
  }
  return {
    strategyId: definition.id,
    displayName: definition.name,
    family: definition.family,
    profileVersion: supplement.profileVersion,
    classification: supplement.classification,
    catalogSource: "strategy_library",
    registryPath,
    detectorPaths: supplement.detectorPaths ?? [],
    typePaths: supplement.typePaths ?? [],
    tradeConstructionPaths: supplement.tradeConstructionPaths ?? [],
    validationProfilePaths: supplement.validationProfilePaths ?? [],
    replayScripts: supplement.replayScripts ?? [],
    oosScripts: supplement.oosScripts ?? [],
    evidencePaths: supplement.evidencePaths ?? [],
    uiConsumers: supplement.uiConsumers ?? sharedUi,
    testCommands: supplement.testCommands,
    supportedSymbols: definition.supportedSymbols,
    primaryTimeframes: definition.primaryTimeframes,
    supportingTimeframes: definition.higherTimeframes,
    detectorStatus: detectorStatusFor(definition, supplement),
    currentResearchStatus: definition.status,
    authority: definition.authority,
    baselineFixtureIds: supplement.baselineFixtureIds,
    notes: supplement.notes ?? []
  };
};

const supplementalLegacyEntries: StrategyBaselineManifestEntry[] = [
  ["ict-bread-and-butter-buy", "ICT Bread and Butter Buy", "phase2_v1", `${suite}/ictPhase2BreadAndButter.ts`],
  ["ict-bread-and-butter-sell", "ICT Bread and Butter Sell", "phase2_v1", `${suite}/ictPhase2BreadAndButter.ts`],
  ["ict-one-shot-one-kill", "ICT One Shot One Kill", "phase2_v1", `${suite}/ictPhase2OneShotOneKill.ts`]
].map(([strategyId, displayName, profileVersion, detectorPath]) => ({
  strategyId,
  displayName,
  family: "ict_phase2",
  profileVersion,
  classification: "behavioral_fixture" as const,
  catalogSource: "supplemental_legacy_engine" as const,
  detectorPaths: [detectorPath],
  typePaths: [`${suite}/ictPhase2Types.ts`],
  tradeConstructionPaths: sharedTradeConstruction,
  validationProfilePaths: [`${suite}/ictApprovedSetupProfile.ts`],
  replayScripts: ["scripts/test-ict-phase2-models.mjs"],
  oosScripts: [],
  evidencePaths: [],
  uiConsumers: sharedUi,
  testCommands: ["test:ict-phase2-models", "test:gotrader-system-coordination"],
  supportedSymbols: ["MNQ", "NQ", "USTECH"],
  primaryTimeframes: ["5m", "15m"],
  supportingTimeframes: ["15m", "1h"],
  detectorStatus: "executable_research" as const,
  currentResearchStatus: "research_only",
  authority: STRATEGY_LIBRARY_AUTHORITY,
  baselineFixtureIds: [`${strategyId.replace(/-/g, "_")}_parity`],
  notes: ["Legacy Phase 2 engine outside the first-class Strategy Library; preserve through an adapter."]
}));

supplementalLegacyEntries.push(
  {
    strategyId: "ict-order-block-taxonomy",
    displayName: "ICT Order Block Taxonomy",
    family: "ict_context",
    profileVersion: "phase2_v1",
    classification: "diagnostic",
    catalogSource: "supplemental_legacy_engine",
    detectorPaths: [`${suite}/ictPhase2OrderBlocks.ts`, `${suite}/ictPhase2BreadAndButter.ts`],
    typePaths: [`${suite}/ictPhase2Types.ts`],
    tradeConstructionPaths: [],
    validationProfilePaths: [],
    replayScripts: [],
    oosScripts: [],
    evidencePaths: [],
    uiConsumers: sharedUi,
    testCommands: ["test:ict-phase2-models"],
    supportedSymbols: ["*"],
    primaryTimeframes: ["5m", "15m"],
    supportingTimeframes: ["15m", "1h"],
    detectorStatus: "diagnostic",
    currentResearchStatus: "research_only",
    authority: STRATEGY_LIBRARY_AUTHORITY,
    baselineFixtureIds: ["order_block_taxonomy_context_only"],
    notes: ["Primitive/context taxonomy; not independently promotable evidence."]
  },
  {
    strategyId: "universal_recognition_service",
    displayName: "ICT Universal Recognition",
    family: "recognition",
    profileVersion: "v1",
    classification: "diagnostic",
    catalogSource: "supplemental_legacy_engine",
    detectorPaths: [`${suite}/ictUniversalRecognition.ts`],
    typePaths: [`${suite}/ictUniversalRecognitionTypes.ts`],
    tradeConstructionPaths: [],
    validationProfilePaths: ["src/lib/currentOpportunity/detectCurrentOpportunities.ts"],
    replayScripts: [],
    oosScripts: [],
    evidencePaths: [],
    uiConsumers: sharedUi,
    testCommands: ["test:ict-universal-recognition", "test:current-opportunity-scanner"],
    supportedSymbols: ["*"],
    primaryTimeframes: ["1m", "5m", "15m"],
    supportingTimeframes: ["15m", "1h", "4h", "1d", "1w"],
    detectorStatus: "diagnostic",
    currentResearchStatus: "research_only",
    authority: STRATEGY_LIBRARY_AUTHORITY,
    baselineFixtureIds: ["universal_recognition_context_only"],
    notes: ["Recognition is context and cannot create evidence without a registered trade setup."]
  }
);

export const STRATEGY_BASELINE_MANIFEST: StrategyBaselineManifestEntry[] = [
  ...STRATEGY_DEFINITIONS.map(entryForDefinition),
  ...supplementalLegacyEntries
];

export const validateStrategyBaselineManifest = (
  entries: StrategyBaselineManifestEntry[] = STRATEGY_BASELINE_MANIFEST
): StrategyBaselineManifestValidationResult => {
  const issues: StrategyBaselineManifestValidationIssue[] = [];
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.strategyId, (counts.get(entry.strategyId) ?? 0) + 1);
    if (!entry.profileVersion.trim()) {
      issues.push({ code: "missing_profile_version", strategyId: entry.strategyId, detail: "Profile version is required." });
    }
    if (!entry.classification) {
      issues.push({ code: "missing_baseline_classification", strategyId: entry.strategyId, detail: "Baseline classification is required." });
    }
    if (entry.detectorStatus === "executable_research" && entry.detectorPaths.length === 0) {
      issues.push({ code: "missing_detector_path", strategyId: entry.strategyId, detail: "Executable research strategy has no detector path." });
    }
    if (entry.classification === "placeholder" && entry.detectorStatus === "executable_research") {
      issues.push({ code: "placeholder_marked_executable", strategyId: entry.strategyId, detail: "Catalog placeholder is marked executable." });
    }
    if (entry.baselineFixtureIds.length === 0) {
      issues.push({ code: "missing_fixture_reference", strategyId: entry.strategyId, detail: "At least one baseline fixture is required." });
    }
    if (entry.testCommands.length === 0) {
      issues.push({ code: "missing_test_reference", strategyId: entry.strategyId, detail: "At least one baseline test command is required." });
    }
    if (
      entry.authority.executionAuthority !== "none" ||
      entry.authority.brokerAuthority !== "none" ||
      entry.authority.readinessOverrideAuthority !== "none"
    ) {
      issues.push({ code: "authority_deviation", strategyId: entry.strategyId, detail: "Authority must remain none/none/none." });
    }
  }
  for (const [strategyId, count] of counts) {
    if (count > 1) {
      issues.push({ code: "duplicate_strategy_id", strategyId, detail: `Strategy ID appears ${count} times.` });
    }
  }
  return { valid: issues.length === 0, entryCount: entries.length, issues };
};

export const listStrategyBaselineManifest = () =>
  STRATEGY_BASELINE_MANIFEST.map((entry) => ({ ...entry }));

export const getStrategyBaselineManifestEntry = (strategyId: string) =>
  STRATEGY_BASELINE_MANIFEST.find((entry) => entry.strategyId === strategyId);
