import type { BrokerAccountMode } from "@/lib/brokers";
import { routeBrokerForSymbol } from "@/lib/brokers";
import { topstepXAdapterPlan, type TopstepXRouteAdapterResult } from "@/lib/brokers/topstepx/topstepxTypes";

export const createTopstepXRouteAdapterResult = ({
  accountMode = "research",
  symbol
}: {
  accountMode?: BrokerAccountMode;
  symbol: string;
}): TopstepXRouteAdapterResult => {
  const route = routeBrokerForSymbol({ accountMode, symbol });
  return {
    route,
    adapterStatus: topstepXAdapterPlan.status,
    executionEnabled: false,
    warnings: [
      ...route.routingWarnings,
      route.broker === "topstepx"
        ? "TopstepX readiness is handled by an independent local gateway. No broker submission is enabled."
        : "Symbol does not route to the TopstepX readiness adapter."
    ]
  };
};
