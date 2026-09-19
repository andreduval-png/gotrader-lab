import { canonicalHash, BT_G1_3_IDENTITY } from "./bt-g1-3-certified-dataset.mjs";

const dates = [
  "2026-04-06", "2026-04-13", "2026-04-20", "2026-04-27",
  "2026-05-04", "2026-05-11", "2026-05-18", "2026-05-25",
  "2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22"
];

// Fixed calendar selection, never filtered by candidate counts or outcomes.
export const buildExpandedEvaluationProtocol = () => {
  const body = {
    schemaVersion: "gotrader.expanded-evaluation-protocol.v1",
    purpose: "CHRONOLOGICAL_RESEARCH_DIAGNOSTIC",
    untouchedHoldout: false,
    selection: "First four Mondays of April, May and June 2026; no outcome-based replacements",
    dataset: BT_G1_3_IDENTITY,
    owners: ["ifvg_fresh_retest_v3_research", "ict_2022_model_v1",
      "ict_market_maker_buy_model_v1", "ict_market_maker_sell_model_v1",
      "nasdaq_london_raid_ny_reversal_v1"],
    windows: ["2026-04", "2026-05", "2026-06"].map((month) => ({
      windowId: month,
      dates: dates.filter((date) => date.startsWith(month))
    })),
    // These fixed dates are all EDT; tests verify NY wall-clock boundaries.
    evaluationTimes: dates.flatMap((date) => Array.from({ length: 78 }, (_, index) =>
      new Date(Date.parse(`${date}T13:30:00.000Z`) + index * 300_000).toISOString())),
    observationsPerBatch: 6,
    maximumWorkers: 1,
    warmupDays: 10,
    tickSize: 0.25, spreadTicks: 1, slippageTicks: 1, commissionTicks: 1,
    maxBarsToResolveTrade: 48,
    missingObservationPolicy: "UNAVAILABLE_NOT_NO_TRADE_NO_DATE_REPLACEMENT",
    insufficientFuturePolicy: "UNRESOLVED_NOT_WIN_OR_LOSS",
    capacity: { minimumFreeGiB: 4, timeoutMs: 120000, maxRssMiB: 768, maxOutputMiB: 128 },
    performancePolicy: "EXISTING_OWNER_POLICY_HASHES_REQUIRED_AT_ADMISSION_NO_THRESHOLD_CHANGES",
    executionDisposition: "PLANNED_NOT_ADMITTED",
    researchValidated: false,
    productionAdoptionAllowed: false,
    authority: "none/none/none"
  };
  return { ...body, protocolHash: canonicalHash(body) };
};
