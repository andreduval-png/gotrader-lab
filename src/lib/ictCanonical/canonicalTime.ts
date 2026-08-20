import { canonicalFactBase, canonicalFactId, canonicalLineage } from "@/lib/ictCanonical/canonicalIctIdentity";
import type { CanonicalSessionWindowFact } from "@/lib/ictCanonical/canonicalIctTypes";
import type { FuturesSymbol, Timeframe } from "@/lib/types";

export const CANONICAL_ICT_SESSION_SCHEDULE = Object.freeze({
  policyId: "gotrader.canonical.session.accepted-legacy-windows",
  policyVersion: "1.0.0",
  timezone: "America/New_York" as const,
  windows: [
    ["Asia", "SESSION", 18 * 60, 3 * 60],
    ["London", "SESSION", 3 * 60, 8 * 60 + 30],
    ["New York", "SESSION", 8 * 60 + 30, 17 * 60],
    ["Asia range", "KILLZONE", 20 * 60, 24 * 60],
    ["London open", "KILLZONE", 2 * 60, 5 * 60],
    ["NY AM", "KILLZONE", 8 * 60 + 30, 11 * 60],
    ["NY Lunch", "KILLZONE", 11 * 60, 13 * 60 + 30],
    ["NY PM", "KILLZONE", 13 * 60 + 30, 16 * 60]
  ] as const
});

export const buildCanonicalSessionWindows = ({
  symbol,
  timeframe,
  validFrom,
  sourceFingerprint
}: {
  symbol: FuturesSymbol;
  timeframe: Timeframe;
  validFrom: string;
  sourceFingerprint: string;
}): CanonicalSessionWindowFact[] => CANONICAL_ICT_SESSION_SCHEDULE.windows.map(([name, sessionType, startMinute, endMinute]) => {
  const factId = canonicalFactId("SESSION_WINDOW", {
    name,
    sessionType,
    startMinute,
    endMinute,
    scheduleVersion: CANONICAL_ICT_SESSION_SCHEDULE.policyVersion
  });
  return {
    ...canonicalFactBase({
      factId,
      factType: "SESSION_WINDOW",
      symbol,
      timeframe,
      occurredAt: validFrom,
      confirmedAt: validFrom,
      validFrom,
      state: "ACTIVE",
      lineage: canonicalLineage({
        sourceCandleIds: [],
        sourceFingerprint,
        policyId: CANONICAL_ICT_SESSION_SCHEDULE.policyId,
        policyVersion: CANONICAL_ICT_SESSION_SCHEDULE.policyVersion
      })
    }),
    factType: "SESSION_WINDOW",
    sessionWindowId: factId,
    sessionType,
    name,
    timezone: "America/New_York",
    startMinute,
    endMinute,
    scheduleVersion: CANONICAL_ICT_SESSION_SCHEDULE.policyVersion,
    dstPolicy: "IANA_TIME_ZONE",
    resolutionStatus: "RESOLVED"
  };
});

export const canonicalMacroPolicy = Object.freeze({
  policyId: "gotrader.canonical.macro.unresolved",
  policyVersion: "1.0.0",
  resolutionStatus: "UNRESOLVED" as const,
  windows: [] as const,
  reason: "No repository-wide macro schedule has been accepted; I1 does not invent one."
});
