import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

export async function loadBt2Modules({ outRoot }) {
  compileTypescriptModules({
    files: [path.join(process.cwd(), "src/lib/backtestSimulation/index.ts")],
    outRoot
  });
  const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
  return Object.freeze({
    simulation: await load("index"),
    canonical: await load("canonicalValueSerialization")
  });
}

export const fixtureIds = Object.freeze({
  certificate: `sha256:${"1".repeat(64)}`,
  dataset: `sha256:${"2".repeat(64)}`,
  parameter: `sha256:${"3".repeat(64)}`,
  lineage: `sha256:${"4".repeat(64)}`,
  experiment: `sha256:${"5".repeat(64)}`
});

export async function buildOpportunity(modules, overrides = {}) {
  return modules.simulation.buildCanonicalOpportunity({
    adapterVersion: "bt2-fixture-adapter-v1",
    datasetCertificateId: fixtureIds.certificate,
    datasetId: fixtureIds.dataset,
    strategyId: "fixture_strategy",
    profileVersion: "1",
    parameterHash: fixtureIds.parameter,
    requestedSymbol: "MNQ",
    brokerSymbol: "USTECH",
    timeframe: "5m",
    decisionAtUtc: "2026-01-05T14:30:00.000Z",
    sourceCandleClosedAtUtc: "2026-01-05T14:30:00.000Z",
    contextLineageRoot: fixtureIds.lineage,
    direction: "long",
    orderPolicy: "limit_at_price",
    activatesAtUtc: "2026-01-05T14:30:00.000Z",
    expiresAtUtc: "2026-01-05T15:00:00.000Z",
    signalPrice: 100,
    entryPrice: 100,
    stopPrice: 99,
    targetPrices: Object.freeze([102]),
    eligible: true,
    blockers: Object.freeze([]),
    ...overrides
  });
}

export const candle = (openTimeUtc, open, high, low, close, spreadPoints = 2) => Object.freeze({
  openTimeUtc,
  closeTimeUtc: new Date(Date.parse(openTimeUtc) + 5 * 60_000).toISOString(),
  open,
  high,
  low,
  close,
  spreadPoints
});
