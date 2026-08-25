import type { EntryLifecycleStatus, TradeDirection } from "@/lib/tradeGeometry/tradeGeometryTypes";

export interface EvaluateEntryLifecycleInput {
  direction: TradeDirection;
  intendedPrice: number;
  currentPrice: number;
  asOf: string;
  validFrom?: string;
  expiresAt?: string;
  availabilityTolerance?: number;
  allowCausalRetrace?: boolean;
  observedStatus?: Extract<EntryLifecycleStatus, "ENTRY_TOUCHED_NOT_FILLED" | "ENTRY_FILLED">;
}

const validTimestamp = (value: string | undefined) => value === undefined || Number.isFinite(Date.parse(value));

export const evaluateEntryLifecycle = ({
  direction,
  intendedPrice,
  currentPrice,
  asOf,
  validFrom,
  expiresAt,
  availabilityTolerance = 0,
  allowCausalRetrace = false,
  observedStatus
}: EvaluateEntryLifecycleInput): EntryLifecycleStatus => {
  if (
    !Number.isFinite(intendedPrice) ||
    !Number.isFinite(currentPrice) ||
    intendedPrice <= 0 ||
    currentPrice <= 0 ||
    !Number.isFinite(availabilityTolerance) ||
    availabilityTolerance < 0 ||
    !validTimestamp(asOf) ||
    !validTimestamp(validFrom) ||
    !validTimestamp(expiresAt)
  ) {
    throw new Error("Entry lifecycle requires finite positive prices, a non-negative tolerance, and valid timestamps.");
  }

  const asOfMs = Date.parse(asOf);
  if (expiresAt && asOfMs > Date.parse(expiresAt)) return "ENTRY_EXPIRED";
  if (validFrom && asOfMs < Date.parse(validFrom)) return "WAITING_FOR_ENTRY";
  if (observedStatus) return observedStatus;

  if (Math.abs(currentPrice - intendedPrice) <= availabilityTolerance) return "ENTRY_AVAILABLE";

  const pricePassedEntry =
    direction === "LONG"
      ? currentPrice > intendedPrice + availabilityTolerance
      : currentPrice < intendedPrice - availabilityTolerance;

  if (pricePassedEntry) return allowCausalRetrace ? "WAITING_FOR_ENTRY" : "ENTRY_MISSED";
  return "WAITING_FOR_ENTRY";
};

