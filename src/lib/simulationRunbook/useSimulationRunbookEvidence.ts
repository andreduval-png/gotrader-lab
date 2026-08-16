import { useEffect, useState } from "react";

import {
  hydrateSimulationRunbookState,
  loadSimulationRunbookState,
  SIMULATION_RUNBOOK_UPDATED_EVENT
} from "@/lib/simulationRunbook/storage";

export function useSimulationRunbookEvidence(cycleId?: string) {
  const [state, setState] = useState(() => loadSimulationRunbookState());

  useEffect(() => {
    const receive = () => setState(loadSimulationRunbookState());
    window.addEventListener(SIMULATION_RUNBOOK_UPDATED_EVENT, receive);
    void hydrateSimulationRunbookState(cycleId).then(setState);
    return () => window.removeEventListener(SIMULATION_RUNBOOK_UPDATED_EVENT, receive);
  }, [cycleId]);

  return state;
}
