import { assertV2Authority, V2_AUTHORITY_NONE } from "../../authority/v2Authority";
import type { V2IfvgV3LiveShadowObservation } from "./v2IfvgV3LiveShadowTypes";
import {
  V2_IFVG_V3_LIVE_SHADOW_LEDGER_SCHEMA,
  V2_IFVG_V3_LIVE_SHADOW_LEDGER_VERSION,
  V2_IFVG_V3_LIVE_SHADOW_MAX_OBSERVATIONS,
  V2_IFVG_V3_LIVE_SHADOW_VERSION,
  type V2IfvgV3LiveShadowAppendResult,
  type V2IfvgV3LiveShadowLedger
} from "./v2IfvgV3LiveShadowTypes";

const uniqueCount = (values: readonly string[]) => new Set(values).size;
const freezeObservations = (values: readonly Readonly<V2IfvgV3LiveShadowObservation>[]) =>
  Object.freeze(values.map((value) => Object.freeze(value)));

const summarize = (
  observations: readonly Readonly<V2IfvgV3LiveShadowObservation>[],
  base: Pick<V2IfvgV3LiveShadowLedger, "processedObservationCount" | "compactedObservationCount">,
  compactedIncrement = 0
): Pick<
  V2IfvgV3LiveShadowLedger,
  | "observations"
  | "processedObservationCount"
  | "compactedObservationCount"
  | "exactParityCount"
  | "regressionCount"
  | "insufficientComparisonCount"
  | "blockedContextCount"
  | "distinctClosedWindowCount"
  | "distinctMarketDateCount"
> => ({
  observations: freezeObservations(observations),
  processedObservationCount: base.processedObservationCount,
  compactedObservationCount: base.compactedObservationCount + compactedIncrement,
  exactParityCount: observations.filter((item) => item.status === "exact_parity").length,
  regressionCount: observations.filter((item) => item.status === "regression").length,
  insufficientComparisonCount: observations.filter((item) => item.status === "insufficient_comparison_data").length,
  blockedContextCount: observations.filter((item) => item.status === "blocked_context").length,
  distinctClosedWindowCount: uniqueCount(observations.map((item) => item.source.distinctClosedWindowKey)),
  distinctMarketDateCount: uniqueCount(observations.map((item) => item.source.marketDateNewYork))
});

export function createV2IfvgV3LiveShadowLedger({
  requestedSymbol,
  brokerSymbol,
  timeframe
}: {
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
}): Readonly<V2IfvgV3LiveShadowLedger> {
  if (!requestedSymbol.trim() || !brokerSymbol.trim() || !timeframe.trim()) {
    throw new Error("IFVG live shadow ledger identity is incomplete.");
  }
  return Object.freeze({
    schemaId: V2_IFVG_V3_LIVE_SHADOW_LEDGER_SCHEMA,
    version: V2_IFVG_V3_LIVE_SHADOW_LEDGER_VERSION,
    policyVersion: V2_IFVG_V3_LIVE_SHADOW_VERSION,
    requestedSymbol,
    brokerSymbol,
    timeframe,
    ...summarize([], { processedObservationCount: 0, compactedObservationCount: 0 }),
    productionAdoptionAllowed: false as const,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  });
}

export function appendV2IfvgV3LiveShadowObservation({
  ledger,
  observation
}: {
  ledger: Readonly<V2IfvgV3LiveShadowLedger>;
  observation: Readonly<V2IfvgV3LiveShadowObservation>;
}): Readonly<V2IfvgV3LiveShadowAppendResult> {
  assertV2Authority(ledger.authority);
  assertV2Authority(observation.authority);
  const identityMismatch =
    ledger.requestedSymbol !== observation.source.requestedSymbol ||
    ledger.brokerSymbol !== observation.source.brokerSymbol ||
    ledger.timeframe !== observation.source.timeframe;
  if (identityMismatch) {
    return Object.freeze({
      action: "rejected_conflict" as const,
      ledger,
      blockers: Object.freeze(["live_shadow_ledger_identity_mismatch"])
    });
  }
  const existing = ledger.observations.find(
    (item) => item.source.distinctClosedWindowKey === observation.source.distinctClosedWindowKey
  );
  if (existing?.observationId === observation.observationId) {
    return Object.freeze({
      action: "idempotent" as const,
      ledger,
      blockers: Object.freeze([])
    });
  }
  if (existing) {
    return Object.freeze({
      action: "rejected_conflict" as const,
      ledger,
      blockers: Object.freeze(["live_shadow_closed_window_result_conflict"])
    });
  }
  const withObservation = [...ledger.observations, observation];
  const overflow = Math.max(0, withObservation.length - V2_IFVG_V3_LIVE_SHADOW_MAX_OBSERVATIONS);
  const observations = overflow ? withObservation.slice(overflow) : withObservation;
  const next = Object.freeze({
    ...ledger,
    ...summarize(
      observations,
      {
        processedObservationCount: ledger.processedObservationCount + 1,
        compactedObservationCount: ledger.compactedObservationCount
      },
      overflow
    ),
    productionAdoptionAllowed: false as const,
    shadowOnly: true as const,
    authority: V2_AUTHORITY_NONE
  });
  return Object.freeze({
    action: "added" as const,
    ledger: next,
    blockers: Object.freeze([])
  });
}
