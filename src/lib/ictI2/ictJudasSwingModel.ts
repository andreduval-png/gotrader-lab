import { assertCanonicalModelContract, type CanonicalIctModel } from "@/lib/ictCanonical/canonicalIctModelContract";
import { ICT_I2_AUTHORITY, parameterHash, transitionAppender, visibleIctFacts } from "@/lib/ictI2/ictI2Shared";
import { ICT_JUDAS_SOURCE_PACKET } from "@/lib/ictI2/ictI2SourcePackets";
import type { IctI2CurrentReadProjection, IctI2DetectionInput, IctI2ModelCandidate } from "@/lib/ictI2/ictI2Types";

export type IctJudasState =
  | "WAITING_FOR_SESSION"
  | "SESSION_ACTIVE"
  | "INITIAL_MOVE_FORMING"
  | "MANIPULATION_CONFIRMED"
  | "REVERSAL_TRIGGER_FORMING"
  | "REVERSAL_CONFIRMED"
  | "ENTRY_ELIGIBLE"
  | "ACTIVE"
  | "SESSION_EXPIRED"
  | "MANIPULATION_INVALID"
  | "REVERSAL_FAILED"
  | "ENTRY_MISSED"
  | "TARGET_REACHED"
  | "INVALIDATED"
  | "SOURCE_BLOCKED";

export interface IctJudasParameters {
  session: "UNRESOLVED";
  openingReference: "UNRESOLVED";
  reversalConfirmation: "UNRESOLVED";
  smtPolicy: "OPTIONAL";
}

export const ICT_JUDAS_BLOCKED_PARAMETERS: IctJudasParameters = Object.freeze({
  session: "UNRESOLVED",
  openingReference: "UNRESOLVED",
  reversalConfirmation: "UNRESOLVED",
  smtPolicy: "OPTIONAL"
});

export const evaluateIctJudasSwing = (
  input: IctI2DetectionInput,
  parameters: IctJudasParameters = ICT_JUDAS_BLOCKED_PARAMETERS
): IctI2ModelCandidate<IctJudasState> => {
  const facts = visibleIctFacts(input.facts, input.asOf);
  const lifecycle = transitionAppender<IctJudasState>("WAITING_FOR_SESSION", input.asOf);
  const unresolved = ICT_JUDAS_SOURCE_PACKET.rules.filter((rule) => rule.material && rule.classification === "UNRESOLVED");
  lifecycle.add(
    "SOURCE_BLOCKED",
    input.asOf,
    [],
    "Material Judas Swing source semantics are unresolved; no pattern evidence may bypass source governance."
  );
  return {
    candidateId: `ict_judas_swing_v1|blocked|${input.sourceFingerprint}|${input.asOf}`,
    strategyId: "ict_judas_swing_v1",
    strategyVersion: "1.0.0-source-blocked",
    profileId: "judas_source_blocked_v1",
    parameterHash: parameterHash("gotrader.ict.i2.judas.parameters.v1", parameters),
    sourceFingerprint: input.sourceFingerprint,
    datasetCertificateId: input.dataset?.datasetCertificateId,
    symbol: facts[0]?.symbol,
    timeframe: facts[0]?.timeframe,
    marketTimestamp: input.asOf,
    direction: "none",
    state: lifecycle.state(),
    supportingFactIds: [],
    transitions: lifecycle.transitions,
    blockers: unresolved.map((rule) => `${rule.ruleId}: ${rule.resolution}`),
    authority: ICT_I2_AUTHORITY,
    researchValidated: false
  };
};

export const projectIctJudasCurrentRead = (candidate: IctI2ModelCandidate<IctJudasState>): IctI2CurrentReadProjection => ({
  strategyId: candidate.strategyId,
  state: candidate.state,
  headline: "ICT Judas Swing",
  detail: "Source semantics are blocked. Session manipulation must not be inferred or presented as an entry signal.",
  blockers: candidate.blockers,
  authority: candidate.authority
});

export const ICT_JUDAS_LONDON_RAID_COMPARISON = Object.freeze({
  semanticOverlap: ["session context", "liquidity raid", "reversal/expansion"],
  sharedFacts: ["SESSION_WINDOW", "LIQUIDITY", "DISPLACEMENT", "MSS", "FVG"],
  judasSessionModel: "Unresolved; potentially London or New York and tied to an unresolved opening reference.",
  londonRaidSessionModel: "Existing Nasdaq London Raid / NY Reversal has a fixed London-to-New-York sequence.",
  differentTriggerRules: true,
  differentEntry: "Unresolved for Judas; existing London Raid entry behavior remains unchanged.",
  differentTarget: "Unresolved for Judas; no target may be inferred from London Raid.",
  classification: "DISTINCT_CONCEPT_BLOCKED_SOURCE_SEMANTICS",
  alias: false,
  duplicateRegistrationPrevented: true
});

export const ICT_JUDAS_SILVER_BULLET_COMPARISON = Object.freeze({
  semanticOverlap: ["named session context", "liquidity event", "FVG may be relevant"],
  silverBullet: "Fixed one-hour research windows with sweep, displacement/FVG, and retracement semantics.",
  judas: "Opening-context deceptive move and reversal model with unresolved source boundaries.",
  behaviorallyIdentical: false,
  reuseDetector: false
});

// The contract is intentionally non-executable. It documents dependencies and
// rejects detection until an accepted source packet resolves material rules.
export const ICT_JUDAS_BLOCKED_MODEL: CanonicalIctModel = assertCanonicalModelContract({
  strategyId: "ict_judas_swing_v1",
  strategyVersion: "1.0.0-source-blocked",
  classification: "research_only",
  requiredTimeframes: ["15m", "5m"],
  preferredTimeframes: ["1h", "1m"],
  optionalTimeframes: ["4h", "1d"],
  requiredFactTypes: ["SESSION_WINDOW", "LIQUIDITY", "MSS", "DISPLACEMENT", "FVG"],
  factDependencyIds: ["i1.session-window", "i1.opening-reference-unresolved", "i1.liquidity", "i1.structure"],
  narrativePolicyId: "c1.i2.judas-source-blocked.v1",
  smtPolicy: "optional",
  parameterSchema: {
    parameterSchemaId: "gotrader.ict.i2.judas.parameters.v1",
    version: "1.0.0-source-blocked",
    parameters: [
      { name: "session", classification: "UNRESOLVED", allowedValues: ["UNRESOLVED"] },
      { name: "openingReference", classification: "UNRESOLVED", allowedValues: ["UNRESOLVED"] },
      { name: "reversalConfirmation", classification: "UNRESOLVED", allowedValues: ["UNRESOLVED"] },
      { name: "smtPolicy", classification: "CANONICAL_GOTRADER_RULE", allowedValues: ["OPTIONAL"] }
    ]
  },
  authority: ICT_I2_AUTHORITY,
  detect: () => []
});
