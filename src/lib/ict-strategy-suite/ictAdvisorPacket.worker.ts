import type { ResearchRuntimeSnapshot } from "../runtime";
import { buildIctAdvisorPacketFromRuntime } from "./ictAdvisorEngine";
import type { IctAdvisorPacket } from "./ictAdvisorTypes";
import { buildIctMarketAnalysisContextBundle } from "./ictMarketAnalysisContext";

interface AdvisorPacketWorkerRequest {
  snapshot: ResearchRuntimeSnapshot;
  asOf?: string;
}

type AdvisorPacketWorkerResponse =
  | { ok: true; packet: IctAdvisorPacket }
  | { ok: false; error: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<AdvisorPacketWorkerRequest>) => void) | null;
  postMessage: (message: AdvisorPacketWorkerResponse) => void;
};

scope.onmessage = async (event) => {
  try {
    const marketAnalysisContextBundle = await buildIctMarketAnalysisContextBundle({
      snapshot: event.data.snapshot,
      asOf: event.data.asOf
    });
    const packet = await buildIctAdvisorPacketFromRuntime(event.data.snapshot, {
      marketAnalysisContextBundle
    });
    scope.postMessage({ ok: true, packet });
  } catch (error) {
    scope.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "ICT advisor packet worker failed."
    });
  }
};

export {};
