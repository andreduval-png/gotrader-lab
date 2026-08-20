import type { IctI2DatasetIdentity } from "@/lib/ictI2/ictI2Types";
import { ICT_2022_BASE_PARAMETERS } from "@/lib/ictI2/ict2022Model";
import { ICT_JUDAS_BLOCKED_PARAMETERS } from "@/lib/ictI2/ictJudasSwingModel";
import { ICT_PO3_BASE_PARAMETERS } from "@/lib/ictI2/ictPowerOfThreeModel";
import { parameterHash } from "@/lib/ictI2/ictI2Shared";

export interface IctI2BaselineMetrics {
  eligibleDays: number;
  formingSetups: number;
  confirmedSetups: number;
  entryEligibleSetups: number;
  filledTrades: number;
  noFills: number;
  expired: number;
  wins: number;
  losses: number;
  grossR: number;
  netR: number;
  winRate: number | null;
  expectancy: number | null;
  profitFactor: number | null;
  drawdown: number | null;
  tradesPerYear: number | null;
  longTrades: number;
  shortTrades: number;
  sessionDistribution: Readonly<Record<string, number>>;
  ambiguityCount: number;
}

export interface IctI2BaselineManifest {
  strategyId: string;
  profileId: string;
  parameterHash: string;
  status: "COMPLETED_DESCRIPTIVE" | "BLOCKED_DATASET_UNAVAILABLE" | "BLOCKED_SOURCE_SEMANTICS";
  dataset: IctI2DatasetIdentity | null;
  metrics: IctI2BaselineMetrics | null;
  blockers: readonly string[];
  tuned: false;
  researchValidated: false;
}

export const ICT_I2_BASELINE_MANIFESTS: readonly IctI2BaselineManifest[] = Object.freeze([
  {
    strategyId: "ict_2022_model_v1",
    profileId: "ict_2022_base_research_v1",
    parameterHash: parameterHash("gotrader.ict.i2.2022.parameters.v1", ICT_2022_BASE_PARAMETERS),
    status: "BLOCKED_DATASET_UNAVAILABLE",
    dataset: null,
    metrics: null,
    blockers: ["No accepted certified dataset identity with required 1h/15m/5m coverage exists in the I2 worktree."],
    tuned: false,
    researchValidated: false
  },
  {
    strategyId: "ict_power_of_three_v1",
    profileId: "po3_external_liquidity_base_v1",
    parameterHash: parameterHash("gotrader.ict.i2.po3.parameters.v1", ICT_PO3_BASE_PARAMETERS),
    status: "BLOCKED_DATASET_UNAVAILABLE",
    dataset: null,
    metrics: null,
    blockers: ["No accepted certified dataset identity with required 15m/5m coverage exists in the I2 worktree."],
    tuned: false,
    researchValidated: false
  },
  {
    strategyId: "ict_judas_swing_v1",
    profileId: "judas_source_blocked_v1",
    parameterHash: parameterHash("gotrader.ict.i2.judas.parameters.v1", ICT_JUDAS_BLOCKED_PARAMETERS),
    status: "BLOCKED_SOURCE_SEMANTICS",
    dataset: null,
    metrics: null,
    blockers: ["Session window, opening reference, and reversal confirmation are unresolved."],
    tuned: false,
    researchValidated: false
  }
]);

export const assertIctI2BaselineGovernance = () => {
  for (const manifest of ICT_I2_BASELINE_MANIFESTS) {
    if (manifest.status === "COMPLETED_DESCRIPTIVE" && !manifest.dataset) throw new Error("Completed baseline lacks certified dataset identity.");
    if (manifest.status !== "COMPLETED_DESCRIPTIVE" && manifest.metrics) throw new Error("Blocked baseline must not publish synthetic metrics.");
    if (manifest.tuned || manifest.researchValidated) throw new Error("I2 baseline cannot tune or validate a model.");
  }
  return ICT_I2_BASELINE_MANIFESTS;
};
