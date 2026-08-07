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
  const verified = (checkId) => Object.freeze({
    checkId,
    status: "verified",
    evidenceId: `fixture:${checkId}`,
    blockers: Object.freeze([])
  });
  const notApplicable = (checkId) => Object.freeze({
    checkId,
    status: "not_applicable",
    evidenceId: `fixture:${checkId}`,
    blockers: Object.freeze([])
  });
  const timeAuthority = await modules.contracts.buildHistoricalTimeAuthority({
    providerId,
    providerVersion,
    providerTimeBasis: "utc_iso",
    dstPolicy: "not_applicable",
    checks: {
      winter: verified("winter"),
      summer: verified("summer"),
      springTransition: notApplicable("spring"),
      fallTransition: notApplicable("fall"),
      maintenanceBoundary: verified("maintenance")
    }
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
    timeNormalizationPolicy: Object.freeze({
      policyId: "fixture-utc-policy",
      version: "1",
      provider: providerId,
      basis: "utc_iso",
      outputTimezone: "UTC",
      discoveryMethod: "explicit_utc_contract",
      dstPolicy: "not_applicable",
      maximumClockSkewMs: 1000,
      closureToleranceMs: 0
    }),
    timeAuthority,
    symbolSpec,
    calendar: Object.freeze({
      calendarId: "fixture-24x7-calendar",
      version: "1",
      providerId,
      brokerSymbol: "USTECH",
      timezone: "UTC",
      verificationStatus: "verified",
      closedIntervals: Object.freeze([]),
      sourceFingerprint
    }),
    timeframeAlignment: Object.freeze({
      policyId: "fixture-utc-alignment",
      version: "1",
      anchorOffsetMinutes: 0,
      weekStartsOn: "monday",
      verificationStatus: "verified"
    }),
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
  return Object.freeze({ request, description, timeAuthority, symbolSpec });
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
