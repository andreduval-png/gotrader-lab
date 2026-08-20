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
  status: "COMPLETED_DESCRIPTIVE" | "BLOCKED_DATASET_UNAVAILABLE" | "DEFERRED_CONCURRENCY" | "BLOCKED_SOURCE_SEMANTICS";
  dataset: IctI2DatasetIdentity | null;
  metrics: IctI2BaselineMetrics | null;
  blockers: readonly string[];
  tuned: false;
  researchValidated: false;
}

export const ICT_I2_QUALIFIED_DATASET: IctI2DatasetIdentity = Object.freeze({
  datasetCertificateId: "sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193",
  datasetId: "sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d",
  datasetChecksum: "sha256:4e51534035ca982a217ba64ec4438f7c2d7d7d19c7f0c1a0b6dff57b4539a0be"
});

export const ICT_I2_BASELINE_MANIFESTS: readonly IctI2BaselineManifest[] = Object.freeze([
  {
    strategyId: "ict_2022_model_v1",
    profileId: "ict_2022_base_research_v1",
    parameterHash: parameterHash("gotrader.ict.i2.2022.parameters.v1", ICT_2022_BASE_PARAMETERS),
    status: "DEFERRED_CONCURRENCY",
    dataset: ICT_I2_QUALIFIED_DATASET,
    metrics: null,
    blockers: ["The qualified two-year USTECH/MNQ-alias dataset covers 1h/15m/5m; the baseline is deferred while bounded R1 family-v4 owns historical-run resource admission."],
    tuned: false,
    researchValidated: false
  },
  {
    strategyId: "ict_power_of_three_v1",
    profileId: "po3_external_liquidity_base_v1",
    parameterHash: parameterHash("gotrader.ict.i2.po3.parameters.v1", ICT_PO3_BASE_PARAMETERS),
    status: "DEFERRED_CONCURRENCY",
    dataset: ICT_I2_QUALIFIED_DATASET,
    metrics: null,
    blockers: ["The qualified two-year USTECH/MNQ-alias dataset covers 15m/5m; the baseline is deferred while bounded R1 family-v4 owns historical-run resource admission."],
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
    blockers: ["Reversal confirmation, entry, stop, and target semantics remain unresolved."],
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
