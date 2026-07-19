import type { BrokerRoute } from "@/lib/brokers";

export type Mt5AdapterStatus = "demo_gateway_available_live_locked";

export interface Mt5ExecutionAdapterPlan {
  adapterId: "mt5_execution_adapter_plan";
  status: Mt5AdapterStatus;
  supportedAssetClasses: Array<"forex" | "cfd" | "futures_proxy">;
  supportedTransportLater: Array<"mcp" | "local_bridge" | "rest" | "websocket_quotes">;
  credentialsLocation: "server_side_only";
  frontendCredentialsAllowed: false;
  liveTradingAllowed: false;
  orderPlacementAllowed: false;
  demoGatewayAvailable: true;
  demoAccountRequired: true;
  authorityNotice: string;
}

export interface Mt5RouteAdapterResult {
  route: BrokerRoute;
  adapterStatus: Mt5AdapterStatus;
  executionEnabled: false;
  warnings: string[];
}

export const mt5ExecutionAdapterPlan: Mt5ExecutionAdapterPlan = {
  adapterId: "mt5_execution_adapter_plan",
  status: "demo_gateway_available_live_locked",
  supportedAssetClasses: ["forex", "cfd", "futures_proxy"],
  supportedTransportLater: ["mcp", "local_bridge", "rest", "websocket_quotes"],
  credentialsLocation: "server_side_only",
  frontendCredentialsAllowed: false,
  liveTradingAllowed: false,
  orderPlacementAllowed: false,
  demoGatewayAvailable: true,
  demoAccountRequired: true,
  authorityNotice: "MT5 is the primary demo execution boundary. The browser cannot submit orders, live accounts are blocked, and the independent gateway must revalidate every handoff."
};
