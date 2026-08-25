import { useCallback, useSyncExternalStore } from "react";

import {
  getOperatorConsoleSnapshot,
  refreshOperatorConsoleSnapshot,
  subscribeOperatorConsole
} from "@/lib/operatorConsole";
import { buildInt3a1ConflictAcceptanceFixture } from "@/lib/operatorConsole/operatorConsoleAcceptanceFixtures";

export const useOperatorConsole = () => {
  const liveSnapshot = useSyncExternalStore(
    subscribeOperatorConsole,
    getOperatorConsoleSnapshot,
    getOperatorConsoleSnapshot
  );
  const snapshot = import.meta.env.DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("int3a1Fixture") === "conflict"
    ? buildInt3a1ConflictAcceptanceFixture(liveSnapshot)
    : liveSnapshot;
  const refresh = useCallback(() => refreshOperatorConsoleSnapshot(), []);
  return { snapshot, refresh };
};
