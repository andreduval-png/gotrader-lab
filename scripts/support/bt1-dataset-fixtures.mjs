import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

export async function loadBt1Modules({ outRoot }) {
  const workspace = process.cwd();
  compileTypescriptModules({
    files: [
      "src/lib/historicalData/index.ts",
      "src/lib/v2/time/v2TimeNormalization.ts"
    ].map((file) => path.join(workspace, file)),
    outRoot
  });
  const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
  return Object.freeze({
    contracts: await load("historicalDatasetContracts"),
    identity: await load("historicalDatasetIdentity"),
    integrity: await load("historicalDatasetIntegrity"),
    lineage: await load("historicalDatasetLineage"),
    repository: await load("historicalDatasetRepository"),
    qualification: await load("historicalQualificationContracts"),
    timeframe: await load("historicalTimeframeBuilder"),
    timeNormalization: await load("historicalTimeNormalization"),
    v2TimeNormalization: await load("v2TimeNormalization"),
    mt5Provider: await load("mt5ReadOnlyHistoricalProvider"),
    canonical: await load("canonicalValueSerialization")
  });
}

export const authorityNone = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

export async function buildFixtureRequest(modules, overrides = {}) {
  const providerId = overrides.providerId ?? "fixture_historical_provider";
  const providerVersion = overrides.providerVersion ?? "fixture-v1";
  const sourceFingerprint = overrides.sourceFingerprint ??
    await modules.canonical.canonicalHash({ providerId, providerVersion, fixture: "bt1" });
  const terminalIdentityFingerprint = await modules.canonical.canonicalHash({
    providerId,
    providerVersion,
    terminal: "fixture-terminal"
  });
  const timeNormalizationPolicy = Object.freeze({
    policyId: "fixture-utc-policy",
    version: "1",
    provider: providerId,
    basis: "utc_iso",
    outputTimezone: "UTC",
    discoveryMethod: "explicit_utc_contract",
    dstPolicy: "not_applicable",
    maximumClockSkewMs: 1000,
    closureToleranceMs: 0
  });
  const periodTimes = Object.freeze({
    winter: "2024-01-15T14:30:00.000Z",
    summer: "2024-07-15T13:30:00.000Z",
    spring_transition: "2024-03-10T07:00:00.000Z",
    fall_transition: "2024-11-03T06:00:00.000Z",
    maintenance_boundary: "2024-01-16T22:00:00.000Z"
  });
  const evidenceRecords = [];
  for (const [period, normalizedTimeUtc] of Object.entries(periodTimes)) {
    evidenceRecords.push(await modules.qualification.buildHistoricalTimeEvidenceRecord({
      period,
      providerId,
      providerVersion,
      terminalIdentityFingerprint,
      requestedSymbol: "MNQ",
      brokerSymbol: "USTECH",
      timeframe: "1m",
      rawProviderTime: normalizedTimeUtc,
      normalizedTimeUtc,
      expectedSessionInterpretation: `${period} fixture session verified`,
      providerTimeBasis: "utc_iso",
      sourceFingerprint,
      normalizationPolicyId: timeNormalizationPolicy.policyId,
      normalizationPolicyVersion: timeNormalizationPolicy.version,
      timestampStatus: "verified",
      sessionStatus: "verified"
    }));
  }
  const evidencePackage = await modules.qualification.buildHistoricalTimeEvidencePackage({
    providerId,
    providerVersion,
    terminalIdentityFingerprint,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    providerTimeBasis: "utc_iso",
    timestampDstPolicy: "not_applicable",
    sessionTimezone: "America/New_York",
    sourceFingerprint,
    normalizationPolicyId: timeNormalizationPolicy.policyId,
    normalizationPolicyVersion: timeNormalizationPolicy.version,
    verificationVersion: "fixture-verification-v1",
    records: Object.freeze(evidenceRecords)
  });
  const maintenanceEvidence = evidencePackage.records.find(
    (record) => record.period === "maintenance_boundary"
  ).evidenceId;
  const calendar = await modules.qualification.buildHistoricalMarketCalendarSnapshot({
    version: "1",
    providerId,
    brokerSymbol: "USTECH",
    timezone: "America/New_York",
    dstPolicy: "iana_timezone_rules",
    evidencePackageId: evidencePackage.evidencePackageId,
    verificationVersion: "fixture-verification-v1",
    verificationEvidenceId: maintenanceEvidence,
    verificationStatus: "verified",
    closedIntervals: Object.freeze([]),
    sourceFingerprint
  });
  const timeframeAlignment = await modules.qualification.buildHistoricalTimeframeAlignmentPolicy({
    version: "1",
    anchorOffsetMinutes: 0,
    weekStartsOn: "monday",
    calendarId: calendar.calendarId,
    evidencePackageId: evidencePackage.evidencePackageId,
    verificationVersion: "fixture-verification-v1",
    supportedDerivedTimeframes: Object.freeze(["5m", "15m"]),
    verificationStatus: "verified"
  });
  const timeAuthority = await modules.contracts.buildHistoricalTimeAuthority({
    providerId,
    providerVersion,
    providerTimeBasis: "utc_iso",
    dstPolicy: "not_applicable",
    timeNormalizationPolicy,
    evidencePackage,
    calendar,
    verificationVersion: "fixture-verification-v1"
  });
  const symbolSpec = await modules.contracts.buildHistoricalSymbolSpecSnapshot({
    providerId,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    digits: 2,
    pointSize: 0.01,
    pipSize: 0.1,
    pipInPoints: 10,
    spreadUnit: "broker_points",
    tickSize: 0.01,
    tickValue: 0.1,
    tickValueCurrency: "USD",
    tradeContractSize: 1,
    volumeMinLots: 0.01,
    volumeMaxLots: 100,
    volumeStepLots: 0.01,
    accountCurrency: "USD",
    verificationStatus: "verified_provider_metadata",
    sourceFingerprint
  });
  const request = Object.freeze({
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    sourceTimeframes: Object.freeze(["1m"]),
    derivedTimeframes: Object.freeze(["5m", "15m"]),
    startUtc: "2024-01-02T00:00:00.000Z",
    endUtc: "2024-01-02T00:15:00.000Z",
    pageSize: 8,
    timeNormalizationPolicy,
    timeAuthority,
    symbolSpec,
    calendar,
    timeframeAlignment,
    creationPolicyId: "bt1-fixture-closed-bars",
    creationPolicyVersion: "1",
    ...overrides.request
  });
  const description = Object.freeze({
    providerId,
    providerVersion,
    sourceFingerprint,
    readOnly: true,
    marketDataOnly: true,
    supportedTimeframes: Object.freeze(["1m"]),
    maximumPageCandles: 8,
    authority: authorityNone
  });
  return Object.freeze({
    request,
    description,
    timeAuthority,
    symbolSpec,
    evidencePackage,
    calendar,
    timeframeAlignment,
    terminalIdentityFingerprint
  });
}

export function fixtureCandles({ count = 15, startUtc = "2024-01-02T00:00:00.000Z" } = {}) {
  const startMs = Date.parse(startUtc);
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const open = 16_500 + index;
    const openMs = startMs + index * 60_000;
    return Object.freeze({
      providerOpenTime: new Date(openMs).toISOString(),
      providerCloseTime: new Date(openMs + 60_000).toISOString(),
      open,
      high: open + 2,
      low: open - 1,
      close: open + 1,
      volume: 100 + index,
      spreadPoints: 12,
      isClosed: true
    });
  }));
}

export function createFixtureProvider(description, { candles = fixtureCandles(), overlap = true } = {}) {
  let fetchCount = 0;
  const secondCursor = "2024-01-02T00:08:00.000Z";
  return Object.freeze({
    provider: Object.freeze({
      async describe() {
        return description;
      },
      async fetchPage(request) {
        fetchCount += 1;
        const second = request.cursor === secondCursor;
        if (request.cursor !== undefined && !second) throw new Error("Unexpected fixture cursor.");
        const pageCandles = second
          ? (overlap ? [candles[7], ...candles.slice(8)] : candles.slice(8))
          : candles.slice(0, 8);
        return Object.freeze({
          providerId: description.providerId,
          providerVersion: description.providerVersion,
          requestedSymbol: request.requestedSymbol,
          brokerSymbol: request.brokerSymbol,
          timeframe: request.timeframe,
          ...(request.cursor ? { cursor: request.cursor } : {}),
          ...(!second ? { nextCursor: secondCursor } : {}),
          candles: Object.freeze(pageCandles),
          warnings: Object.freeze([]),
          authority: authorityNone
        });
      }
    }),
    get fetchCount() {
      return fetchCount;
    }
  });
}
