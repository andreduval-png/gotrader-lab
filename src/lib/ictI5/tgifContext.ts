import { CANONICAL_ICT_NONE_AUTHORITY } from "@/lib/ictCanonical/canonicalIctTypes";
import { stableIctI5Id, validIctI5Timestamp } from "@/lib/ictI5/ictI5Identity";
import type { IctI5TgifContext } from "@/lib/ictI5/ictI5Types";

export interface IctI5TgifInput {
  asOf: string;
  sourceFingerprint: string;
  supportingFactIds?: readonly string[];
}

export const evaluateTgifContext = (input: IctI5TgifInput): IctI5TgifContext => {
  validIctI5Timestamp(input.asOf, "TGIF asOf");
  const supportingFactIds = [...(input.supportingFactIds ?? [])].sort();
  const blockers = [
    "tgif_setup_definition_unresolved",
    "tgif_friday_session_window_unresolved",
    "tgif_weekly_context_unresolved",
    "tgif_entry_stop_target_expiry_unresolved"
  ];
  return {
    contextId: stableIctI5Id("ict-i5-tgif-context", [input.asOf, input.sourceFingerprint, ...supportingFactIds]),
    artifactId: "gotrader.ict.i5.tgif-context.v1",
    displayName: "ICT TGIF / Friday Model Context",
    decision: "BLOCKED_SOURCE_SEMANTICS",
    executable: false,
    state: "SOURCE_BLOCKED",
    blockers,
    supportingFactIds,
    sourceFingerprint: input.sourceFingerprint,
    authority: CANONICAL_ICT_NONE_AUTHORITY,
    researchValidated: false
  };
};
