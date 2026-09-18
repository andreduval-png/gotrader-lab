import { getTimingDateKey, resolveSessionTimeMapping, resolveSessionTimestampParts } from "@/lib/sessions";

export const ICT_I5_TIME_POLICY = Object.freeze({
  timeAuthorityId: "gotrader.sessions.iana-america-new-york",
  timezone: "America/New_York" as const,
  dstPolicy: "IANA_TIME_ZONE" as const,
  dayBoundaryPolicyId: "I5_DAY_BOUNDARY_SOURCE_UNRESOLVED" as const,
  weekBoundaryPolicyId: "I5_WEEK_BOUNDARY_SOURCE_UNRESOLVED" as const,
  openingReferencePolicyId: "I5_OPENING_REFERENCE_SOURCE_UNRESOLVED" as const,
  calendarEvidencePolicyId: "gotrader.ict.i5.market-calendar-evidence.v1"
});

const nyMapping = () => resolveSessionTimeMapping({ provider: "canonical_ict", requestedSymbol: "NQ", brokerSymbol: "USTECH" });

export const resolveIctI5NewYorkParts = (timestamp: string) => resolveSessionTimestampParts(timestamp, nyMapping());

export const resolveIctI5MarketDate = (timestamp: string) => getTimingDateKey(timestamp, nyMapping());

export const resolveIctI5MarketWeek = (timestamp: string) => {
  const dateKey = resolveIctI5MarketDate(timestamp);
  const date = new Date(`${dateKey}T12:00:00Z`);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  return date.toISOString().slice(0, 10);
};
