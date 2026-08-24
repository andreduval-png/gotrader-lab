import type { Candle } from "@/lib/types";
import type { IctIfvgSide } from "./ictIfvgTypes";

export const IFVG_PRODUCER_GEOMETRY_POLICY_ID = "ifvg_distal_edge_buffer_and_retracement_limit_v1" as const;

export type IctIfvgEntryLifecycleStatus =
  | "entry_unavailable"
  | "waiting_for_entry"
  | "entry_missed";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export const resolveIctIfvgEntryLifecycle = (input: {
  side: IctIfvgSide;
  entry?: number;
  currentPrice?: number;
}): IctIfvgEntryLifecycleStatus => {
  if ((input.side !== "long" && input.side !== "short") || !finite(input.entry) || !finite(input.currentPrice)) {
    return "entry_unavailable";
  }
  if (input.side === "long" && input.currentPrice < input.entry) return "entry_missed";
  if (input.side === "short" && input.currentPrice > input.entry) return "entry_missed";
  return "waiting_for_entry";
};

export const findIctIfvgRetracementFillOffset = (input: {
  side: Exclude<IctIfvgSide, "flat">;
  entry: number;
  candles: Pick<Candle, "high" | "low">[];
}) => input.candles.findIndex((candle) =>
  input.side === "long" ? candle.low <= input.entry : candle.high >= input.entry
);
