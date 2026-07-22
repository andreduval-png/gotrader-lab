export const V2_IDENTITY_SCHEMA_VERSION = "gotrader-v2-market-data-identity-v1";
export const V2_SESSION_CALENDAR_VERSION = "gotrader-session-calendar-legacy-v1";
export const V2_TIMEZONE_VERSION = "iana-timezone-rules-v1";

export type V2SourceKind =
  | "mt5_read_only"
  | "imported_historical"
  | "replay_snapshot"
  | "mock_sample";

export interface V2SourceIdentity {
  sourceId: string;
  provider: string;
  requestedSymbol: string;
  brokerSymbol: string;
  sourceFingerprint: string;
  sourceKind: V2SourceKind;
  marketDataAccess: "read_only";
}

export interface V2MarketDataIdentity {
  source: Readonly<V2SourceIdentity>;
  timeframeFingerprints: Readonly<Record<string, string>>;
  dataWindowStart: string;
  dataWindowEnd: string;
  lastClosedCandle: string;
  candleCountByTimeframe: Readonly<Record<string, number>>;
  sessionCalendarVersion: string;
  timezoneVersion: string;
  identitySchemaVersion: string;
  canonicalHashVersion: string;
  identityHash: string;
}
