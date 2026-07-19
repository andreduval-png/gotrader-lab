import type { BrokerAccountMode } from "@/lib/brokers";
import { routeBrokerForSymbol } from "@/lib/brokers";
import { mt5ExecutionAdapterPlan, type Mt5RouteAdapterResult } from "@/lib/brokers/mt5/mt5Types";

export const createMt5RouteAdapterResult = ({
  accountMode = "research",
  symbol
}: {
  accountMode?: BrokerAccountMode;
  symbol: string;
}): Mt5RouteAdapterResult => {
  const route = routeBrokerForSymbol({ accountMode, symbol });
  return {
    route,
    adapterStatus: mt5ExecutionAdapterPlan.status,
    executionEnabled: false,
    warnings: [
      ...route.routingWarnings,
      route.broker === "mt5"
        ? "MT5 demo handoff is available only through the independent local gateway after deterministic readiness passes. Live MT5 remains locked."
        : "Symbol does not route to MT5."
    ]
  };
};
