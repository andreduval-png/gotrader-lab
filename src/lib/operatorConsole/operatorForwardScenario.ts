import type { ForwardScenarioMap } from "@/lib/forwardScenario";
import type { Mt5ActivateMarketSourceSummary } from "@/lib/ict-strategy-suite/ictActivateMarketSourceActivation";

export type OperatorForwardScenarioPreparationReason =
  | "ready"
  | "missing_scenario"
  | "inactive_research_source"
  | "missing_source_fingerprint"
  | "unsafe_source_provider"
  | "source_identity_mismatch";

export interface OperatorForwardScenarioPreparation {
  ok: boolean;
  reason: OperatorForwardScenarioPreparationReason;
  scenarioMap?: ForwardScenarioMap;
}

const canonicalSymbol = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

const canonicalTimeframe = (value: string) => {
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = {
    m1: "1m",
    m5: "5m",
    m15: "15m",
    m30: "30m",
    h1: "1h",
    h4: "4h",
    d1: "1d",
    w1: "1w"
  };
  return aliases[normalized] ?? normalized;
};

const sameSeries = (map: ForwardScenarioMap, source: Mt5ActivateMarketSourceSummary) =>
  canonicalSymbol(map.requestedSymbol) === canonicalSymbol(source.requestedSymbol) &&
  canonicalSymbol(map.brokerSymbol) === canonicalSymbol(source.brokerSymbol) &&
  canonicalTimeframe(map.timeframe) === canonicalTimeframe(source.timeframe);

export const prepareOperatorForwardScenario = (
  map: ForwardScenarioMap | undefined,
  source: Mt5ActivateMarketSourceSummary
): OperatorForwardScenarioPreparation => {
  if (!map) return { ok: false, reason: "missing_scenario" };
  if (!source.activeForResearch) return { ok: false, reason: "inactive_research_source" };
  if (!source.sourceFingerprint) return { ok: false, reason: "missing_source_fingerprint" };
  if (source.provider !== "mt5_read_only" || !/^mt5(?:_read_only)?$/i.test(map.sourceProvider)) {
    return { ok: false, reason: "unsafe_source_provider" };
  }
  if (!sameSeries(map, source)) return { ok: false, reason: "source_identity_mismatch" };

  return {
    ok: true,
    reason: "ready",
    scenarioMap: {
      ...map,
      sourceProvider: "mt5_read_only",
      requestedSymbol: source.requestedSymbol,
      brokerSymbol: source.brokerSymbol,
      timeframe: source.timeframe,
      sourceFingerprint: source.sourceFingerprint
    }
  };
};
