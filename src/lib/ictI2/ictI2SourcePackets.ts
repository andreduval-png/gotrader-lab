import type { IctI2SourcePacket } from "@/lib/ictI2/ictI2Types";

export const ICT_2022_SOURCE_PACKET = Object.freeze({
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
} satisfies IctI2SourcePacket);

export const ICT_PO3_SOURCE_PACKET = Object.freeze({
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
} satisfies IctI2SourcePacket);

export const ICT_JUDAS_SOURCE_PACKET = Object.freeze({
  packetId: "gotrader.ict.i2.judas.source-rules.v1",
  strategyId: "ict_judas_swing_v1",
  version: "1.0.0",
  status: "BLOCKED_SOURCE_SEMANTICS",
  sources: [
    { sourceId: "ict-judas-direct-2017-12-10", sourceType: "DIRECT", title: "ICT Forex - Understanding The ICT Judas Swing", url: "https://www.youtube.com/watch?v=xJMbva8SjzE" },
    { sourceId: "ict-judas-transcript-aid", sourceType: "TRANSCRIPT_AID", title: "Third-party transcript of the direct Judas Swing lesson", url: "https://info.quagmyre.com/xwiki/bin/view/Forex/The-Inner-Circle-Trader/srt/ICT-Market-Maker-Primer-Course-12-Understanding-The-ICT-Judas-Swing-srt/" }
  ],
  rules: [
    { ruleId: "target_market_session", classification: "SOURCE_DEFINED", behavior: "The direct lesson teaches London-session foreign exchange delivery.", material: true, resolution: "Do not conflate the source model with Nasdaq London Raid / New York Reversal." },
    { ruleId: "session_window", classification: "SOURCE_DEFINED", behavior: "The manipulation is sought from 00:00 through 05:00 New York in London delivery context.", material: true, resolution: "Use I1 canonical New York time and DST semantics." },
    { ruleId: "opening_reference", classification: "SOURCE_DEFINED", behavior: "The New York midnight open is the opening reference.", material: true, resolution: "Use the canonical opening reference; never broker wall clock." },
    { ruleId: "reference_liquidity", classification: "SOURCE_DEFINED", behavior: "The established Asian range high and low provide reference liquidity.", material: true, resolution: "Consume I1 canonical liquidity rather than a Judas-specific detector." },
    { ruleId: "manipulation", classification: "SOURCE_DEFINED", behavior: "The initial move is opposite the higher-timeframe thesis, crosses the midnight open, and hunts stops or a key price level at the thesis-opposing Asian boundary.", material: true, resolution: "Bullish attacks sellside/Asian low; bearish attacks buyside/Asian high." },
    { ruleId: "htf_bias", classification: "SOURCE_DEFINED", behavior: "A higher-timeframe directional premise determines which initial move is deceptive.", material: true, resolution: "No setup exists when the directional thesis is unavailable." },
    { ruleId: "mss_requirement", classification: "SOURCE_DEFINED", behavior: "MSS is not a mandatory gate in the direct Judas lesson.", material: false, resolution: "Do not import MSS from another model." },
    { ruleId: "displacement_requirement", classification: "SOURCE_DEFINED", behavior: "Energetic movement is descriptive, but a canonical displacement fact is not mandated.", material: false, resolution: "Do not import a numeric displacement threshold." },
    { ruleId: "fvg_requirement", classification: "SOURCE_DEFINED", behavior: "FVG is not a mandatory gate in the direct Judas lesson.", material: false, resolution: "Do not import an FVG retracement entry." },
    { ruleId: "reversal_confirmation", classification: "UNRESOLVED", behavior: "Aggressive movement away is taught without a deterministic causal close or threshold.", material: true, resolution: "Activation remains blocked until a reviewable confirmation rule is sourced." },
    { ruleId: "entry_condition", classification: "UNRESOLVED", behavior: "An example entry near the attacked Asian boundary does not define a complete symmetric entry contract.", material: true, resolution: "Do not invent confirmation-close, FVG, OTE, or PD-array entry semantics." },
    { ruleId: "stop_condition", classification: "UNRESOLVED", behavior: "The lesson does not specify deterministic model invalidation.", material: true, resolution: "A vague pip allowance cannot be a canonical stop." },
    { ruleId: "target_condition", classification: "UNRESOLVED", behavior: "Directional daily delivery is taught without an exact canonical objective.", material: true, resolution: "Do not substitute arbitrary fixed R or another model's target." },
    { ruleId: "expiry", classification: "CANONICAL_GOTRADER_RULE", behavior: "Any later executable profile must expire at its canonical session boundary and never chase a missed entry.", material: false, resolution: "Use I1 time facts and ENTRY_MISSED semantics." },
    { ruleId: "smt", classification: "CANONICAL_GOTRADER_RULE", behavior: "SMT is optional S1-owned context and is not required by the direct lesson.", material: false, resolution: "No model-local SMT calculation." },
    { ruleId: "london_raid_overlap", classification: "CANONICAL_GOTRADER_RULE", behavior: "A duplicate strategy may not be registered without distinct trigger/session/geometry semantics.", material: true, resolution: "Judas is conceptually broader but not executable; preserve London Raid identities." }
  ]
} satisfies IctI2SourcePacket);

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
