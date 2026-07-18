import { OperatorConsoleView } from "@/components/operator/OperatorConsoleView";
import type { LabState } from "@/lib/types";

type ResearchCommandCenterProps = {
  state: LabState;
};

export function ResearchCommandCenter({ state }: ResearchCommandCenterProps) {
  return <OperatorConsoleView state={state} />;
}
