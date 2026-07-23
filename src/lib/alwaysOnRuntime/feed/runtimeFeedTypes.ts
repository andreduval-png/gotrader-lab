import type { AlwaysOnRuntimeAuthority } from "../alwaysOnRuntimeTypes";

export type RuntimeMarketEventType =
  | "quote_updated"
  | "forming_candle_updated"
  | "candle_closed"
  | "feed_stale"
  | "feed_recovered"
  | "source_blocked";

export interface RuntimeMarketDataCapability {
  marketDataCapability: "read_only";
}

export interface RuntimeMarketEventBase
  extends AlwaysOnRuntimeAuthority,
    RuntimeMarketDataCapability {
  eventId: string;
  eventVersion: "gotrader-runtime-market-event-v1";
  type: RuntimeMarketEventType;
  sequence?: number;
  sourceProvider: "mt5_read_only";
  sourceIdentity: string;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe?: string;
  observedMarketTime: string;
  receivedAt: string;
  sourceFingerprint: string;
  timeContractVersion: string;
}

export interface RuntimeQuoteUpdatedEvent extends RuntimeMarketEventBase {
  type: "quote_updated";
  bid?: number;
  ask?: number;
  mid?: number;
}

export interface RuntimeFormingCandleUpdatedEvent extends RuntimeMarketEventBase {
  type: "forming_candle_updated";
  timeframe: string;
  candleOpenTime: string;
  candleCloseTime: string;
  payloadHash: string;
}

export interface RuntimeCandleClosedEvent extends RuntimeMarketEventBase {
  type: "candle_closed";
  timeframe: string;
  candleOpenTime: string;
  candleCloseTime: string;
  candleIdentity: string;
  payloadHash: string;
}

export interface RuntimeFeedStateEvent extends RuntimeMarketEventBase {
  type: "feed_stale" | "feed_recovered" | "source_blocked";
  reason: string;
}

export type RuntimeMarketEvent =
  | RuntimeQuoteUpdatedEvent
  | RuntimeFormingCandleUpdatedEvent
  | RuntimeCandleClosedEvent
  | RuntimeFeedStateEvent;

export interface RuntimeFeedStatus
  extends AlwaysOnRuntimeAuthority,
    RuntimeMarketDataCapability {
  serviceVersion: "gotrader-continuous-feed-v1";
  state: "starting" | "healthy" | "degraded" | "stale" | "blocked" | "stopped";
  bridgeUrl: string;
  activeSymbols: readonly string[];
  activeTimeframes: readonly string[];
  lastQuoteTime?: string;
  lastFormingCandleUpdate?: string;
  lastClosedCandleEvent?: string;
  rollingStoreCounts: Readonly<Record<string, number>>;
  emittedCloseEventCount: number;
  duplicateCloseEventCount: number;
  conflictingCandleCount: number;
  recoveredEventCount: number;
  timeContractEligible: boolean;
  checkpointStatus: "missing" | "loaded" | "healthy" | "corrupt" | "stale";
  blockers: readonly string[];
  warnings: readonly string[];
}
