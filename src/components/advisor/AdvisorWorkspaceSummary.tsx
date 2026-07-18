import { useEffect, useMemo, useState } from "react";
import { MessageSquareText } from "lucide-react";

import { useLatestValidationChainEntry } from "@/components/common/ValidationChainCard";
import { Badge } from "@/components/ui/badge";
import {
  advisorProviderStatusInfo,
  checkLocalBridgeHealth,
  classifyLocalLlmCapability,
  getLocalBridgeStatusSnapshot,
  loadAdvisoryProviderSettings,
  type AdvisorProviderStatusLevel
} from "@/lib/llm";
import { validationChainStatusLabel } from "@/lib/validationChain";
import { AUTHORITY_BADGE_LABEL, WORKSPACE_CARD } from "@/components/common/workspaceStyles";

const resolveDefaultProviderStatus = (): AdvisorProviderStatusLevel => {
  const settings = loadAdvisoryProviderSettings();
  if (settings.providerMode === "disabled") {
    return "disabled";
  }
  if (settings.providerMode === "openclaw") {
    return settings.openClawAdvisoryUrl.trim() ? "openclaw_not_configured" : "openclaw_not_configured";
  }
  const localBridgeSnapshot = getLocalBridgeStatusSnapshot();
  if (localBridgeSnapshot.advisoryCapabilityStatus === "unknown") {
    return "local_llm_config_missing";
  }
  return classifyLocalLlmCapability(localBridgeSnapshot.advisoryCapabilityStatus);
};

/**
 * Compact Advisor clarity strip: mode, provider class, validation chain, test next.
 */
export function AdvisorWorkspaceSummary({ testNextAction }: { testNextAction?: string }) {
  const chain = useLatestValidationChainEntry();
  const settings = useMemo(() => loadAdvisoryProviderSettings(), []);
  const [providerStatus, setProviderStatus] = useState<AdvisorProviderStatusLevel>(() => resolveDefaultProviderStatus());
  const statusInfo = advisorProviderStatusInfo(providerStatus);

  useEffect(() => {
    if (settings.providerMode !== "local_llm_bridge") return;
    let active = true;
    void checkLocalBridgeHealth(undefined, { bypassCircuitBreaker: true })
      .then((health) => {
        if (active) setProviderStatus(classifyLocalLlmCapability(health.advisoryCapabilityStatus));
      })
      .catch(() => {
        if (active) setProviderStatus(classifyLocalLlmCapability(getLocalBridgeStatusSnapshot().advisoryCapabilityStatus));
      });
    return () => {
      active = false;
    };
  }, [settings.providerMode]);

  const modeLabel =
    settings.providerMode === "openclaw"
      ? "OpenClaw advisory path (check OpenClaw tab for stub vs skill-routed)"
      : settings.providerMode === "disabled"
        ? "Deterministic Research Helper only"
        : providerStatus === "local_llm_online"
          ? "Research Advisor chat is connected to the local LLM bridge. Deterministic guidance is fallback-only."
          : "Local LLM bridge is unavailable; chat will use clearly labeled deterministic fallback guidance.";

  const validationLine = chain
    ? `${chain.setupLabel} / ${validationChainStatusLabel(chain.hypothesisStatus)} / next: ${chain.nextAction}`
    : "No validation queued. Recognition is not evidence - queue replay from ICT Lab or Validation tab.";

  const testNext =
    testNextAction ??
    chain?.nextAction ??
    "Run Activate Market, then ask the Research Advisor what to test next.";

  return (
    <section data-testid="advisor-workspace-summary" className={`${WORKSPACE_CARD} px-4 py-3`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden="true" />
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Advisor workspace</span>
        <Badge variant="secondary" data-testid="advisor-summary-mode">
          Chat: {providerStatus === "local_llm_online" ? "LLM online" : "Deterministic fallback"}
        </Badge>
        <Badge variant={statusInfo.isOrdinarySuccess ? "success" : "warning"} data-testid="advisor-summary-provider">
          Provider: {statusInfo.label}
        </Badge>
        <Badge variant="muted">{AUTHORITY_BADGE_LABEL}</Badge>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">{modeLabel}</p>
      <p className="mt-1 text-xs leading-5 text-slate-300" data-testid="advisor-summary-validation">
        Validation chain: {validationLine}
      </p>
      <p className="mt-1 text-xs leading-5 text-cyan-100" data-testid="advisor-summary-test-next">
        Test next: {testNext}
      </p>
      {settings.providerMode === "openclaw" ? (
        <p className="mt-2 text-xs text-slate-400">
          Open the <span className="font-medium text-slate-200">OpenClaw</span> tab to see bridge stub vs skill-routed status.
        </p>
      ) : null}
    </section>
  );
}
