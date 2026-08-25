import { useCallback, useSyncExternalStore } from "react";

import {
  getOperatorConsoleSnapshot,
  refreshOperatorConsoleSnapshot,
  subscribeOperatorConsole
} from "@/lib/operatorConsole";

export const useOperatorConsole = () => {
  const snapshot = useSyncExternalStore(
    subscribeOperatorConsole,
    getOperatorConsoleSnapshot,
    getOperatorConsoleSnapshot
  );
  const refresh = useCallback(() => refreshOperatorConsoleSnapshot(), []);
  return { snapshot, refresh };
};
