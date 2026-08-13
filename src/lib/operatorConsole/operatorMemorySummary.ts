import type { ResearchEvidenceAggregateIndex } from "@/lib/researchEvidenceLedger";
import type { GbrainMemoryOutboxState } from "@/lib/researchMemory";

import type { OperatorMemorySummary } from "./operatorConsoleTypes";

export const emptyOperatorMemorySummary = (): OperatorMemorySummary => ({
  storedEvidenceRecords: 0,
  profileIdentities: 0,
  independentCycleDates: 0,
  positiveEdgeCycles: 0,
  gbrainTotal: 0,
  gbrainPending: 0,
  gbrainDelivered: 0,
  gbrainFailed: 0,
  gbrainDeliveryEnabled: false
});

export const buildOperatorMemorySummary = (
  evidence: ResearchEvidenceAggregateIndex,
  outbox: GbrainMemoryOutboxState
): OperatorMemorySummary => {
  const latest = evidence.aggregates[0];
  return {
    storedEvidenceRecords: evidence.totalRecords,
    profileIdentities: evidence.totalProfiles,
    independentCycleDates: latest?.independentCycleDates ?? 0,
    positiveEdgeCycles: evidence.aggregates.reduce((total, item) => total + item.positiveEdgeCycles, 0),
    gbrainTotal: outbox.entries.length,
    gbrainPending: outbox.entries.filter((entry) => entry.status === "pending").length,
    gbrainDelivered: outbox.entries.filter((entry) => entry.status === "delivered").length,
    gbrainFailed: outbox.entries.filter((entry) => entry.status === "failed").length,
    gbrainDeliveryEnabled: outbox.deliveryEnabled,
    latestProfile: latest?.identity.strategyProfile,
    latestUpdatedAt: latest?.lastCompletedAt ?? evidence.generatedAt
  };
};
