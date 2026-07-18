import type { BrokerRoute } from "@/lib/brokers";

export type TopstepXAdapterStatus = "readiness_only_submission_locked";

export interface TopstepXAdapterPlan {
  adapterId: "topstepx_readiness_adapter";
  status: TopstepXAdapterStatus;
  supportedAssetClasses: Array<"futures">;
  credentialsLocation: "independent_gateway_only";
  frontendCredentialsAllowed: false;
  readinessProbeAllowed: true;
  submissionAllowed: false;
  liveTradingAllowed: false;
  authorityNotice: string;
}

export interface TopstepXRouteAdapterResult {
  route: BrokerRoute;
  adapterStatus: TopstepXAdapterStatus;
  executionEnabled: false;
  warnings: string[];
}

export const topstepXAdapterPlan: TopstepXAdapterPlan = {
  adapterId: "topstepx_readiness_adapter",
  status: "readiness_only_submission_locked",
  supportedAssetClasses: ["futures"],
  credentialsLocation: "independent_gateway_only",
  frontendCredentialsAllowed: false,
  readinessProbeAllowed: true,
  submissionAllowed: false,
  liveTradingAllowed: false,
  authorityNotice:
    "TopstepX may be probed only by the independent local gateway. It has no sandbox, so broker submission remains locked."
};
