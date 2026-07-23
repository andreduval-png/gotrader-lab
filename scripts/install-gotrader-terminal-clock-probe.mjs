#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { currentLiveVerificationAuthority } from "./gotrader-current-live-time-verification-core.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFile = path.join(repoRoot, "mt5", "GoTraderClockProbeEA.mq5");
const python = process.env.PYTHON || "python";
const terminalPath =
  process.env.MT5_PATH || "C:/Program Files/MetaTrader 5/terminal64.exe";
const metaEditorPath =
  process.env.MT5_METAEDITOR_PATH ||
  path.join(path.dirname(terminalPath), "MetaEditor64.exe");

const discovery = spawnSync(
  python,
  [
    "-c",
    [
      "import json, MetaTrader5 as mt5",
      `ok=mt5.initialize(path=${JSON.stringify(terminalPath)}, timeout=15000)`,
      "terminal=mt5.terminal_info() if ok else None",
      "print(json.dumps({'ok':bool(ok and terminal),'dataPath':str(getattr(terminal,'data_path','')),'connected':bool(getattr(terminal,'connected',False))}))",
      "mt5.shutdown() if ok else None"
    ].join(";")
  ],
  {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
    timeout: 25_000
  }
);
let terminal;
try {
  terminal = JSON.parse(discovery.stdout || "{}");
} catch {
  terminal = {};
}
if (!terminal?.ok || !terminal?.dataPath) {
  console.error(
    JSON.stringify(
      {
        status: "blocked",
        blocker: "mt5_terminal_data_path_unavailable",
        nextAction: "Open the configured MT5 terminal and rerun this command.",
        ...currentLiveVerificationAuthority
      },
      null,
      2
    )
  );
  process.exit(2);
}

const expertDirectory = path.join(
  terminal.dataPath,
  "MQL5",
  "Experts",
  "GoTrader"
);
const installedSource = path.join(expertDirectory, "GoTraderClockProbeEA.mq5");
const compiledFile = path.join(expertDirectory, "GoTraderClockProbeEA.ex5");
const compileLog = path.join(
  terminal.dataPath,
  "MQL5",
  "Logs",
  "gotrader-clock-probe-compile.log"
);
await fs.mkdir(expertDirectory, { recursive: true });
await fs.copyFile(sourceFile, installedSource);
await fs.rm(compiledFile, { force: true });
await fs.rm(compileLog, { force: true });
const compilation = spawnSync(
  metaEditorPath,
  [`/compile:${installedSource}`, `/log:${compileLog}`],
  {
    cwd: repoRoot,
    encoding: "utf8",
    windowsHide: true,
    timeout: 60_000
  }
);
const log = await fs.readFile(compileLog, "utf16le").catch(async () =>
  fs.readFile(compileLog, "utf8").catch(() => "")
);
const compiled = await fs
  .stat(compiledFile)
  .then((value) => value.size > 0)
  .catch(() => false);
const cleanCompile = /0 errors?, 0 warnings?/i.test(log);
if (compilation.error || !compiled || !cleanCompile) {
  console.error(
    JSON.stringify(
      {
        status: "blocked",
        blocker: compilation.error
          ? `metaeditor_launch_failed:${compilation.error.message}`
          : "clock_probe_compile_failed",
        installedSource,
        compiledFile,
        compileLog,
        compilerSummary: String(log).trim().split(/\r?\n/).slice(-5),
        ...currentLiveVerificationAuthority
      },
      null,
      2
    )
  );
  process.exit(2);
}

console.log(
  JSON.stringify(
    {
      status: "installed",
      terminalConnected: terminal.connected === true,
      installedSource,
      compiledFile,
      compileLog,
      defaultHeartbeatSeconds: 30,
      nextAction:
        "In MT5 Navigator, refresh Expert Advisors and attach GoTrader/GoTraderClockProbeEA to the connected USTECH chart once.",
      rawCandlesPersisted: false,
      ...currentLiveVerificationAuthority
    },
    null,
    2
  )
);
