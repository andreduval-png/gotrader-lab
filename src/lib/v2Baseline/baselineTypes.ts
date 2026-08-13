export type StrategyBaselineClassification =
  | "positive_canary"
  | "negative_control"
  | "behavioral_fixture"
  | "placeholder"
  | "diagnostic"
  | "experimental";

export type StrategyBaselineDetectorStatus =
  | "executable_research"
  | "placeholder"
  | "diagnostic"
  | "experimental";

export interface BaselineAuthority {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
}

export interface StrategyBaselineManifestEntry {
  strategyId: string;
  displayName: string;
  family: string;
  profileVersion: string;
  classification: StrategyBaselineClassification;
  catalogSource: "strategy_library" | "supplemental_legacy_engine";

  registryPath?: string;
  detectorPaths: string[];
  typePaths: string[];
  tradeConstructionPaths: string[];
  validationProfilePaths: string[];
  replayScripts: string[];
  oosScripts: string[];
  evidencePaths: string[];
  uiConsumers: string[];
  testCommands: string[];

  supportedSymbols: string[];
  primaryTimeframes: string[];
  supportingTimeframes: string[];
  detectorStatus: StrategyBaselineDetectorStatus;
  currentResearchStatus: string;
  authority: BaselineAuthority;
  baselineFixtureIds: string[];
  notes: string[];
}

export interface StrategyBaselineManifestValidationIssue {
  code:
    | "duplicate_strategy_id"
    | "missing_profile_version"
    | "missing_detector_path"
    | "missing_baseline_classification"
    | "missing_fixture_reference"
    | "missing_test_reference"
    | "placeholder_marked_executable"
    | "authority_deviation";
  strategyId: string;
  detail: string;
}

export interface StrategyBaselineManifestValidationResult {
  valid: boolean;
  entryCount: number;
  issues: StrategyBaselineManifestValidationIssue[];
}

export interface BaselineFixtureIdentity {
  fixtureId: string;
  strategyId: string;
  profileVersion: string;
  classification: StrategyBaselineClassification;
  sourceProvider: string;
  sourceFingerprint: string | null;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframeSet: string[];
  dataWindowStart: string | null;
  dataWindowEnd: string | null;
  lastClosedCandle: string | null;
  detectorVersion: string;
  sourceCommit: string;
  parameterFingerprint: string | null;
  costModel: string;
}

export interface GoldenBaselineFixture {
  schemaVersion: "gotrader-v2-baseline-fixture-v1";
  identity: BaselineFixtureIdentity;
  expectedResultType: string;
  expectedDetectionState: string;
  expectedResearchLifecycleState: string;
  expectedBlockers: string[];
  expectedTradeGeometry?: {
    side: "long" | "short";
    entry: number;
    stop: number;
    target: number;
    rr: number;
  };
  expectedReplaySummary?: Record<string, string | number | boolean | null>;
  expectedOosSummary?: Record<string, string | number | boolean | null>;
  provenanceNotes: string[];
  authority: BaselineAuthority;
}

export interface NormalizedBaselineSnapshot<T = unknown> {
  schemaVersion: "gotrader-v2-normalized-snapshot-v1";
  payload: T;
}
