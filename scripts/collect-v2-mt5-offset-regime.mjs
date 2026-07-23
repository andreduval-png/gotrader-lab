#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadLocalEnvironment } from "./local-env.mjs";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";
import {
  acquireV2Mt5OffsetRegimeCollectorLock,
  runV2Mt5OffsetRegimeCollectorCycle
} from "./v2-mt5-offset-regime-collector-core.mjs";

await loadLocalEnvironment();

const workspace = process.cwd();
const bridgeUrl = process.env.MT5_READONLY_BRIDGE_URL || "http://127.0.0.1:7341";
const brokerSymbol = process.env.V2_MT5_OFFSET_REGIME_BROKER_SYMBOL || process.env.MT5_READONLY_BROKER_SYMBOL || "USTECH";
const safeSymbol = brokerSymbol.replace(/[^a-z0-9._-]/gi, "_");
const stateFile = path.resolve(process.env.V2_MT5_OFFSET_REGIME_STATE_FILE || path.join(workspace, ".gotrader", "v2", `mt5-offset-regime-${safeSymbol}.json`));
const intervalMs = Number(process.env.V2_MT5_OFFSET_REGIME_INTERVAL_MS || 60_000);
const timeoutMs = Number(process.env.V2_MT5_OFFSET_REGIME_TIMEOUT_MS || 5_000);
const once = process.argv.includes("--once") || /^(?:1|true|yes)$/i.test(process.env.V2_MT5_OFFSET_REGIME_ONCE || "");
if (!Number.isFinite(intervalMs) || intervalMs < 30_000 || intervalMs > 90_000) {
  throw new Error("V2_MT5_OFFSET_REGIME_INTERVAL_MS must be between 30000 and 90000.");
}
if (!Number.isFinite(timeoutMs) || timeoutMs < 250 || timeoutMs > 15_000) {
  throw new Error("V2_MT5_OFFSET_REGIME_TIMEOUT_MS must be between 250 and 15000.");
}

const lock = await acquireV2Mt5OffsetRegimeCollectorLock(stateFile);
let stopping = false;
const stop = () => { stopping = true; };
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

try {
  const outRoot = path.join(workspace, ".gotrader", "v2-offset-regime-collector-runtime");
  const sourceFiles = [
    "src/lib/v2/authority/v2Authority.ts",
    "src/lib/v2/serialization/canonicalSerialization.ts",
    "src/lib/v2/time/v2TimeNormalizationTypes.ts",
    "src/lib/v2/time/v2TimeNormalization.ts",
    "src/lib/v2/time/v2Mt5TerminalClockTypes.ts",
    "src/lib/v2/time/v2Mt5UpstreamTimeContractTypes.ts",
    "src/lib/v2/time/v2Mt5UpstreamTimeContract.ts",
    "src/lib/v2/time/v2Mt5OffsetRegimeTypes.ts",
    "src/lib/v2/time/v2Mt5OffsetRegimeLedger.ts",
    "src/lib/v2/time/v2Mt5OffsetRegimeValidation.ts"
  ].map((file) => path.join(workspace, file));
  compileTypescriptModules({ files: sourceFiles, outRoot });
  const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
  const ledger = await load("v2Mt5OffsetRegimeLedger");
  const validation = await load("v2Mt5OffsetRegimeValidation");
  const ledgerApi = Object.freeze({ ...ledger, ...validation });

  do {
    const result = await runV2Mt5OffsetRegimeCollectorCycle({
      bridgeUrl,
      brokerSymbol,
      stateFile,
      ledgerApi,
      timeoutMs
    });
    console.log(JSON.stringify(result));
    if (once || stopping) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (!stopping);
} finally {
  await lock.release();
}
