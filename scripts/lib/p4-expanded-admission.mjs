import { canonicalHash } from "./bt-g1-3-certified-dataset.mjs";

export const bindExpandedPolicies = ({ protocol, adapters, policies }) => {
  const { protocolHash, ...body } = protocol;
  if (canonicalHash(body) !== protocolHash) throw new Error("EXPANDED_PROTOCOL_HASH_MISMATCH");
  const owners = protocol.owners.map((owner) => {
    const matches = adapters.filter((adapter) => adapter.strategyId === owner);
    const policyMatches = policies.filter((policy) => policy.ownerStrategyId === owner);
    if (matches.length !== 1 || policyMatches.length !== 1) throw new Error("EXPANDED_OWNER_BINDING_AMBIGUOUS");
    const adapter = matches[0], policy = policyMatches[0];
    if (!policy.policyHash || adapter.strategyVersion !== policy.ownerStrategyVersion) {
      throw new Error("EXPANDED_OWNER_POLICY_MISMATCH");
    }
    const binding = Object.fromEntries([
      "strategyId", "strategyVersion", "adapterId", "adapterVersion", "profileId",
      "profileVersion", "parameterHash", "geometryPolicyId", "geometryPolicyVersion", "sessionPolicyId"
    ].map((key) => [key, adapter[key] ?? null]));
    return { ...binding, performancePolicyHash: policy.policyHash,
      performancePolicyContentHash: canonicalHash(policy) };
  });
  const manifest = { protocolHash, owners, authority: "none/none/none", fullEvaluationAllowed: false };
  return { ...manifest, manifestHash: canonicalHash(manifest) };
};

export const classifyScheduledObservations = (schedule, candles) => {
  const available = new Set(candles.map((candle) => candle.timestamp));
  return schedule.map((asOf) => ({ asOf, status: available.has(asOf) ? "AVAILABLE" : "UNAVAILABLE" }));
};
