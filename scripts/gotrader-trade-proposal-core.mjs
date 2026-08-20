/** @deprecated Use gotrader-research-mcp-core.mjs. */
export {
  GOTRADER_RESEARCH_MCP_POLICY_VERSION as TRADE_PROPOSAL_MCP_POLICY_VERSION,
  GOTRADER_RESEARCH_MCP_AUTHORITY as TRADE_PROPOSAL_MCP_AUTHORITY,
  scanForForbiddenRuntimeContent as scanTradeProposalForForbiddenContent,
  evaluateCanonicalTradeProposal as evaluateTradeProposal,
  readRecentCanonicalProposals as readRecentTradeProposalAudits,
  buildResearchMcpStatus as buildTradeProposalControlPlaneStatus
} from "./gotrader-research-mcp-core.mjs";

export const TRADE_PROPOSAL_MCP_ALLOWED_PROFILES = Object.freeze([]);
export const appendTradeProposalAudit = async () => undefined;
