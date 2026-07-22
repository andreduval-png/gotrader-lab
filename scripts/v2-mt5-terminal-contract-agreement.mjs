const CONTRACT_ID = "gotrader-mt5-readonly-time-contract";
const CONTRACT_VERSION = "1.1.0";
const NONE = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

const same = (left, right) => left === right;

export function evaluateV2Mt5TerminalContractAgreement({
  responseStatus,
  contract,
  classification
}) {
  const blockers = [];
  if (responseStatus !== 200) blockers.push("time_contract_http_status_invalid");
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    return Object.freeze({
      status: "blocked",
      phase2Eligible: false,
      blockers: Object.freeze([...blockers, "time_contract_payload_missing"]),
      authority: NONE
    });
  }

  if (contract.contractId !== CONTRACT_ID) blockers.push("time_contract_id_mismatch");
  if (contract.version !== CONTRACT_VERSION) blockers.push("time_contract_version_mismatch");
  if (String(contract.sourceMethod ?? "").startsWith("contract_stub:")) blockers.push("time_contract_stub_returned");
  if (contract.readOnly !== true || contract.marketDataOnly !== true) blockers.push("time_contract_read_only_boundary_invalid");
  if (
    contract.executionAuthority !== "none" ||
    contract.brokerAuthority !== "none" ||
    contract.readinessOverrideAuthority !== "none" ||
    contract.authority?.executionAuthority !== "none" ||
    contract.authority?.brokerAuthority !== "none" ||
    contract.authority?.readinessOverrideAuthority !== "none"
  ) blockers.push("time_contract_authority_invalid");

  const expectedScope = classification.historicalDstPolicyVerified
    ? "historical"
    : classification.currentLiveTimeBasisVerified
      ? "current_live"
      : "none";
  const expectedStatus = classification.historicalDstPolicyVerified
    ? "verified"
    : classification.currentLiveTimeBasisVerified
      ? "observed_candidate"
      : "unknown";
  const expectedPhase2Eligible = classification.currentLiveTimeBasisVerified === true &&
    classification.historicalDstPolicyVerified === true &&
    classification.phase2Eligible === true;

  if (!same(contract.verificationStatus, expectedStatus)) blockers.push("verification_status_disagrees_with_terminal");
  if (!same(contract.timeVerificationScope, expectedScope)) blockers.push("verification_scope_disagrees_with_terminal");
  if (!same(contract.currentLiveTimeBasisVerified, classification.currentLiveTimeBasisVerified)) {
    blockers.push("current_live_verification_disagrees_with_terminal");
  }
  if (!same(contract.historicalDstPolicyVerified, classification.historicalDstPolicyVerified)) {
    blockers.push("historical_dst_verification_disagrees_with_terminal");
  }
  if (!same(contract.phase2Eligible, expectedPhase2Eligible)) blockers.push("phase2_eligibility_disagrees_with_terminal");
  if (!same(contract.terminalBasisClassification, classification.basisClassification)) {
    blockers.push("basis_classification_disagrees_with_terminal");
  }
  if (!same(contract.pythonTransportBasis, classification.pythonTransportBasis)) {
    blockers.push("python_transport_basis_disagrees_with_terminal");
  }
  if (!same(contract.terminalObservedOffsetMinutes, classification.terminalObservedOffsetMinutes)) {
    blockers.push("terminal_offset_disagrees_with_terminal");
  }
  if (
    classification.basisClassification === "verified_trade_server_wall_clock" &&
    contract.providerTimeBasis !== "mt5_server_wall_clock"
  ) blockers.push("provider_time_basis_disagrees_with_terminal");
  if (classification.basisClassification === "verified_utc_epoch" && contract.providerTimeBasis !== "epoch_utc") {
    blockers.push("provider_time_basis_disagrees_with_terminal");
  }

  return Object.freeze({
    status: blockers.length ? "blocked" : "accepted",
    phase2Eligible: blockers.length ? false : expectedPhase2Eligible,
    blockers: Object.freeze([...new Set(blockers)]),
    authority: NONE
  });
}
