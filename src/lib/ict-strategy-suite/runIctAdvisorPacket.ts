import type { ResearchRuntimeSnapshot } from "../runtime";
import { buildIctAdvisorPacketFromRuntime } from "./ictAdvisorEngine";
import { buildIctMarketAnalysisContextBundle } from "./ictMarketAnalysisContext";
import { appendIctAdvisorJournalEvents } from "./ictAdvisorJournal";
import type { IctAdvisorPacket } from "./ictAdvisorTypes";
import { appendIctIndexSmtJournalEvents } from "./ictIndexSmt";
import { appendIctNewsSessionRiskJournalEvents } from "./ictNewsSessionRisk";

type WorkerResponse =
  | { ok: true; packet: IctAdvisorPacket }
  | { ok: false; error: string };

const persistPacketJournals = (packet: IctAdvisorPacket): IctAdvisorPacket => {
  const journalWrite = appendIctAdvisorJournalEvents(packet.journalEvents);
  appendIctIndexSmtJournalEvents(packet.indexSmtJournalEvents);
  appendIctNewsSessionRiskJournalEvents(packet.newsSessionRiskJournalEvents);
  return {
    ...packet,
    journalStatus:
      journalWrite.storage === "localStorage"
        ? "written"
        : journalWrite.storage === "memory_unavailable"
          ? "memory_only"
          : "unavailable"
  };
};

export async function runIctAdvisorPacket(input: {
  snapshot: ResearchRuntimeSnapshot;
  signal?: AbortSignal;
  timeoutMs?: number;
  asOf?: string;
}): Promise<IctAdvisorPacket> {
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    input.signal?.throwIfAborted();
    const marketAnalysisContextBundle = await buildIctMarketAnalysisContextBundle({ snapshot: input.snapshot, asOf: input.asOf, signal: input.signal });
    input.signal?.throwIfAborted();
    const packet = await buildIctAdvisorPacketFromRuntime(input.snapshot, { marketAnalysisContextBundle });
    input.signal?.throwIfAborted();
    return packet;
  }

  return new Promise<IctAdvisorPacket>((resolve, reject) => {
    const worker = new Worker(new URL("./ictAdvisorPacket.worker.ts", import.meta.url), {
      type: "module",
      name: "gotrader-ict-advisor-packet"
    });
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      input.signal?.removeEventListener("abort", abort);
      worker.terminate();
      callback();
    };
    const abort = () => finish(() => reject(new Error("ICT advisor packet analysis canceled by user.")));
    const timeout = globalThis.setTimeout(
      () => finish(() => reject(new Error("ICT advisor packet analysis timed out safely."))),
      Math.max(30_000, input.timeoutMs ?? 120_000)
    );

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.ok) {
        const packet = response.packet;
        finish(() => resolve(persistPacketJournals(packet)));
      } else {
        const error = response.error;
        finish(() => reject(new Error(error)));
      }
    };
    worker.onerror = (event) => finish(() => reject(new Error(event.message || "ICT advisor packet worker failed.")));
    worker.onmessageerror = () => finish(() => reject(new Error("ICT advisor packet worker returned an unreadable result.")));
    if (input.signal?.aborted) {
      abort();
      return;
    }
    input.signal?.addEventListener("abort", abort, { once: true });
    worker.postMessage({ snapshot: input.snapshot, asOf: input.asOf });
  });
}
