import type { IctI2SourcePacket } from "@/lib/ictI2/ictI2Types";

export const ICT_2022_SOURCE_PACKET: IctI2SourcePacket = Object.freeze({
  packetId: "gotrader.ict.i2.2022.source-rules.v1",
  strategyId: "ict_2022_model_v1",
  version: "1.0.0",
  status: "RESOLVED_FOR_RESEARCH",
  rules: [
    { ruleId: "directional_objective", classification: "SOURCE_DEFINED", behavior: "A directional objective and external draw precede setup search.", material: true, resolution: "Use C1/C1.1 narrative plus canonical DRAW_ON_LIQUIDITY." },
    { ruleId: "opposite_liquidity_raid", classification: "SOURCE_DEFINED", behavior: "Opposite-side canonical liquidity must be consumed before confirmation.", material: true, resolution: "Use canonical LIQUIDITY status and consumedAt." },
    { ruleId: "ordered_confirmation", classification: "SOURCE_DEFINED", behavior: "Directional displacement, MSS, and FVG follow the raid in causal order.", material: true, resolution: "Use I1 validFrom timestamps; no strategy-specific detectors." },
    { ruleId: "entry_mode", classification: "RESEARCH_PARAMETER", behavior: "Entry uses FVG proximal, midpoint, or confirmation mode.", material: true, resolution: "Frozen base profile uses FVG_MIDPOINT; no optimization in I2." },
    { ruleId: "stop_mode", classification: "RESEARCH_PARAMETER", behavior: "Invalidation uses raid extreme, displacement origin, or structural swing.", material: true, resolution: "Frozen base profile uses RAID_EXTREME." },
    { ruleId: "target_mode", classification: "SOURCE_DEFINED", behavior: "Target is the established external draw on liquidity.", material: true, resolution: "Canonical DRAW_ON_LIQUIDITY target." },
    { ruleId: "causal_visibility", classification: "CANONICAL_GOTRADER_RULE", behavior: "Facts are unavailable before validFrom and future extension cannot rewrite prior state.", material: true, resolution: "I1 causality contract." },
    { ruleId: "smt", classification: "CANONICAL_GOTRADER_RULE", behavior: "SMT is optional context; opposing SMT blocks only when a later profile says so.", material: false, resolution: "Canonical S1 policy adapter; optional in base profile." }
  ]
});

export const ICT_PO3_SOURCE_PACKET: IctI2SourcePacket = Object.freeze({
  packetId: "gotrader.ict.i2.po3.source-rules.v1",
  strategyId: "ict_power_of_three_v1",
  version: "1.0.0",
  status: "RESOLVED_FOR_RESEARCH",
  rules: [
    { ruleId: "accumulation", classification: "SOURCE_DEFINED", behavior: "A canonical dealing range establishes accumulation context.", material: true, resolution: "Use active DEALING_RANGE; no invented compression threshold." },
    { ruleId: "manipulation", classification: "SOURCE_DEFINED", behavior: "One side of range liquidity is consumed after accumulation.", material: true, resolution: "Use canonical external LIQUIDITY linked to the range." },
    { ruleId: "distribution", classification: "SOURCE_DEFINED", behavior: "Displacement and MSS confirm delivery away from manipulation.", material: true, resolution: "Use ordered I1 DISPLACEMENT and MSS facts." },
    { ruleId: "session_policy", classification: "RESEARCH_PARAMETER", behavior: "Optional canonical session filter bounds the lifecycle.", material: false, resolution: "Frozen base profile is ANY_CANONICAL_SESSION." },
    { ruleId: "hod_lod", classification: "RESEARCH_PARAMETER", behavior: "HOD/LOD changes objective selection but not the AMD detector.", material: false, resolution: "Profile of ict_power_of_three_v1, not a second strategy." },
    { ruleId: "entry", classification: "RESEARCH_PARAMETER", behavior: "Entry uses first eligible PD array retracement after distribution.", material: true, resolution: "Frozen base profile uses FVG midpoint." },
    { ruleId: "smt", classification: "CANONICAL_GOTRADER_RULE", behavior: "SMT is optional context in the base profile.", material: false, resolution: "Consume only through S1 policy." }
  ]
});

export const ICT_JUDAS_SOURCE_PACKET: IctI2SourcePacket = Object.freeze({
  packetId: "gotrader.ict.i2.judas.source-rules.v1",
  strategyId: "ict_judas_swing_v1",
  version: "1.0.0",
  status: "BLOCKED_SOURCE_SEMANTICS",
  rules: [
    { ruleId: "causal_shape", classification: "SOURCE_DEFINED", behavior: "Opening context precedes deceptive liquidity raid, reversal confirmation, and real expansion.", material: true, resolution: "Conceptual order is sufficiently distinct from a generic raid." },
    { ruleId: "session_window", classification: "UNRESOLVED", behavior: "Exact eligible London or New York window is required.", material: true, resolution: "No accepted source packet fixes the window; activation blocked." },
    { ruleId: "opening_reference", classification: "UNRESOLVED", behavior: "Midnight, daily, or session open must be selected.", material: true, resolution: "Repository evidence does not establish one canonical reference; activation blocked." },
    { ruleId: "reversal_confirmation", classification: "UNRESOLVED", behavior: "Required combination of MSS, displacement, and FVG must be fixed.", material: true, resolution: "Do not infer mandatory confirmation folklore; activation blocked." },
    { ruleId: "london_raid_overlap", classification: "CANONICAL_GOTRADER_RULE", behavior: "A duplicate strategy may not be registered without distinct trigger/session/geometry semantics.", material: true, resolution: "Judas is conceptually broader but not executable; preserve London Raid identities." }
  ]
});

export const ICT_I2_SOURCE_PACKETS = Object.freeze([
  ICT_2022_SOURCE_PACKET,
  ICT_PO3_SOURCE_PACKET,
  ICT_JUDAS_SOURCE_PACKET
]);

export const assertIctI2SourcePacket = (packet: IctI2SourcePacket) => {
  const unresolvedMaterial = packet.rules.filter((rule) => rule.material && rule.classification === "UNRESOLVED");
  if (packet.status === "RESOLVED_FOR_RESEARCH" && unresolvedMaterial.length) {
    throw new Error(`${packet.strategyId} has unresolved material source rules.`);
  }
  if (packet.status === "BLOCKED_SOURCE_SEMANTICS" && !unresolvedMaterial.length) {
    throw new Error(`${packet.strategyId} is source-blocked without an unresolved material rule.`);
  }
  return packet;
};
