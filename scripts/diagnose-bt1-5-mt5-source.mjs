#!/usr/bin/env node

import path from "node:path";
import {
  authorityNone,
  bt15RuntimeRoot,
  loadBt15Modules,
  parseArguments,
  readJson,
  writeJsonAtomic
} from "./support/bt1-5-qualification-runtime.mjs";
import { collectBt15Diagnostics } from "./support/bt1-5-diagnostics-core.mjs";

const args = parseArguments(process.argv.slice(2));
if (!args.input) throw new Error("Usage: diagnose-bt1-5-mt5-source --input <diagnostic-input.json> [--output <diagnostic.json>]");
const input = readJson(args.input);
const modules = await loadBt15Modules("diagnostics");
const observed = await collectBt15Diagnostics(input);
const core = Object.freeze({
  schemaVersion: "gotrader-bt1-5-mt5-diagnostic-v1",
  capturedAtUtc: new Date().toISOString(),
  sourceIdentityInputs: observed,
  reviewStatus: "candidate_requires_human_session_review",
  blockers: Object.freeze([
    ...(observed.timeContract.providerTimeBasis === "unknown" ? ["historical_provider_time_basis_unknown"] : []),
    ...(!observed.symbol.found ? ["historical_broker_symbol_not_found"] : []),
    ...observed.evidence.flatMap((item) => [
      ...(item.candleCount ? [] : [`historical_${item.period}_evidence_missing`]),
      ...(item.outOfRangeCandleCount ? [`historical_${item.period}_evidence_out_of_range`] : [])
    ])
  ].sort()),
  authority: authorityNone
});
const diagnostic = Object.freeze({
  ...core,
  diagnosticId: await modules.canonical.canonicalHash(core),
  sourceIdentityFingerprint: await modules.canonical.canonicalHash(observed)
});
const output = args.output
  ? path.resolve(args.output)
  : path.join(bt15RuntimeRoot(), "diagnostics", `${diagnostic.diagnosticId.replace(":", "_")}.json`);
const written = writeJsonAtomic(output, diagnostic);
console.log(JSON.stringify({
  status: diagnostic.blockers.length ? "blocked" : diagnostic.reviewStatus,
  diagnosticId: diagnostic.diagnosticId,
  sourceIdentityFingerprint: diagnostic.sourceIdentityFingerprint,
  providerTimeBasis: observed.timeContract.providerTimeBasis,
  evidenceCounts: Object.fromEntries(observed.evidence.map((item) => [item.period, item.candleCount])),
  blockers: diagnostic.blockers,
  output: written,
  authority: diagnostic.authority
}, null, 2));
