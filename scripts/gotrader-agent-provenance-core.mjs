export const GOTRADER_AGENT_INTERFACE = "gotrader_canonical_agent_interface";
export const GOTRADER_AGENT_PROVENANCE_CONTRACT = "gotrader.agent_provenance";
export const GOTRADER_AGENT_PROVENANCE_VERSION = "1.0";
export const GOTRADER_AGENT_AUTHORITY = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

export const buildAgentProvenance = ({
  toolName,
  evidenceClass,
  source,
  generatedAt = new Date().toISOString(),
  observedAt,
  sourceUpdatedAt,
  freshness,
  identities = {}
}) => ({
  contract: GOTRADER_AGENT_PROVENANCE_CONTRACT,
  version: GOTRADER_AGENT_PROVENANCE_VERSION,
  interface: GOTRADER_AGENT_INTERFACE,
  clientAgnostic: true,
  toolName,
  evidenceClass,
  source,
  generatedAt,
  observedAt,
  sourceUpdatedAt,
  freshness,
  identities,
  authority: GOTRADER_AGENT_AUTHORITY
});

export const withAgentProvenance = (payload, options) => ({
  ...payload,
  provenance: buildAgentProvenance(options),
  authority: GOTRADER_AGENT_AUTHORITY
});
