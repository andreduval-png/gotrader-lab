import type { IctI3SourceRule } from "@/lib/ictI3/ictI3Types";

export const ICT_I3_SOURCE_PACKET = Object.freeze({
  packetId: "gotrader.ict.i3.market-maker.source-rules.v1",
  version: "1.0.0",
  status: "RESOLVED_FOR_BOUNDED_RESEARCH" as const,
  sources: [
    {
      sourceId: "grinch-transcript-jzdl-0jgo2k",
      sourceType: "TRANSCRIPT_AID" as const,
      title: "Grinch source transcript: Market Maker Sell Model examples",
      repositoryPath: "docs/strategy-sources/(8) Grinch video-jZdl_0Jgo2k.md"
    },
    {
      sourceId: "gotrader-i1-canonical-facts",
      sourceType: "CANONICAL_DEPENDENCY" as const,
      title: "GoTrader I1 canonical ICT facts"
    }
  ],
  rules: [
    {
      ruleId: "i3.mmxm.framework-only",
      classification: "CANONICAL_GOTRADER_RULE",
      behavior: "MMXM describes delivery context; only MMBM and MMSM create executable research candidates.",
      material: true,
      resolution: "Prevents a third alias strategy and preserves one directional core."
    },
    {
      ruleId: "i3.range-relative-delivery",
      classification: "CANONICAL_GOTRADER_RULE",
      behavior: "Every liquidity, IRL/ERL, premium/discount, and PD-array relationship names one canonical dealing range.",
      material: true,
      resolution: "Uses I1 identities and rejects floating market-maker labels."
    },
    {
      ruleId: "i3.external-engineering-event",
      classification: "SOURCE_DEFINED",
      behavior: "The directional model begins from opposite-side external liquidity engineering and consumption.",
      material: true,
      resolution: "The source examples identify engineered highs/lows and liquidity capture before directional completion."
    },
    {
      ruleId: "i3.canonical-transition",
      classification: "CANONICAL_GOTRADER_RULE",
      behavior: "A canonical directional ERL-to-IRL transition confirms delivery away from the engineered extreme.",
      material: true,
      resolution: "Composes I1 transition facts without implementing the future I4 transition strategies."
    },
    {
      ruleId: "i3.displacement-required",
      classification: "CANONICAL_GOTRADER_RULE",
      behavior: "Directional displacement is required after the liquidity event; MSS is profile-controlled.",
      material: true,
      resolution: "Separates observable repricing from unresolved claims that every profile requires MSS."
    },
    {
      ruleId: "i3.pd-array-entry",
      classification: "CANONICAL_GOTRADER_RULE",
      behavior: "Entry intent is owned by one causally visible canonical PD array after delivery confirmation.",
      material: true,
      resolution: "I3 does not redetect FVG, IFVG, BPR, or blocks."
    },
    {
      ruleId: "i3.external-objective",
      classification: "SOURCE_DEFINED",
      behavior: "The native objective is the opposite external liquidity or range objective, never nearest liquidity by default.",
      material: true,
      resolution: "The source example keeps the original consolidation/liquidity objective until model completion."
    },
    {
      ruleId: "i3.smt-optional",
      classification: "CANONICAL_GOTRADER_RULE",
      behavior: "S1 SMT is optional confluence; aligned/absent/insufficient states do not create model facts.",
      material: true,
      resolution: "The transcript uses intermarket divergence context, but does not support a universal mandatory SMT rule."
    },
    {
      ruleId: "i3.base-thresholds",
      classification: "RESEARCH_PARAMETER",
      behavior: "Setup age, minimum R:R, role timeframes, and eligible PD-array types are frozen profile parameters.",
      material: true,
      resolution: "No exact universal numeric threshold is source-supported; I3 performs no optimization."
    },
    {
      ruleId: "i3.reaccumulation-redistribution",
      classification: "UNRESOLVED",
      behavior: "Reaccumulation and redistribution do not create separate transitions in the base profile.",
      material: false,
      resolution: "Deferred until a source packet supports deterministic distinctions."
    }
  ] satisfies readonly IctI3SourceRule[]
});
