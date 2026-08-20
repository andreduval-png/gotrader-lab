import type { IctPaperSignal } from "@/lib/ict-strategy-suite/ictPaperSignalSimulatorTypes";
import { buildPaperOutcomeEvent } from "./buildSimulatedOutcomeEvents";
import { appendSimulatedOutcomeEvent, listSimulatedOutcomeEvents } from "./simulatedOutcomeStorage";
import type { SimulatedOutcomeIdentity } from "./simulatedOutcomeLedgerTypes";

export const persistPaperSignalOutcome = async ({
  paperSignal,
  identity,
  recordedAt
}: {
  paperSignal: IctPaperSignal;
  identity?: Omit<SimulatedOutcomeIdentity, "tradeId">;
  recordedAt?: string;
}) => {
  const ledger = await listSimulatedOutcomeEvents();
  const previousEvent = ledger.latest.find((event) =>
    event.sourceKind === "paper" && event.identity.tradeId === paperSignal.paperSignalId
  );
  const previousIdentity = previousEvent
    ? (({ tradeId: _tradeId, ...rest }) => rest)(previousEvent.identity)
    : undefined;
  const boundIdentity = identity ?? previousIdentity;

  if (!boundIdentity) {
    throw new Error(`Paper outcome ${paperSignal.paperSignalId} has no identity-bound pending ledger record.`);
  }
  if (previousEvent && previousEvent.identity.cycleId !== boundIdentity.cycleId) {
    throw new Error(`Paper outcome ${paperSignal.paperSignalId} does not match its pending cycle identity.`);
  }

  const event = await buildPaperOutcomeEvent({
    paperSignal,
    identity: boundIdentity,
    previousEvent,
    recordedAt
  });
  return appendSimulatedOutcomeEvent(event);
};
