#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const sidecarRoot = path.resolve(
  process.env.GOTRADER_GBRAIN_DATA_DIR || path.join(repoRoot, ".gotrader", "gbrain-sidecar")
);
const gbrainHome = path.resolve(process.env.GBRAIN_HOME || path.join(sidecarRoot, "gbrain-home"));
const gbrainConfigPath = path.join(gbrainHome, ".gbrain", "config.json");
const vendorRoot = path.join(sidecarRoot, "vendor", "gbrain");
const localBinRoot = path.join(sidecarRoot, "bin");
const localGbrainCommand = path.join(
  localBinRoot,
  process.platform === "win32" ? "gbrain.cmd" : "gbrain"
);
const gbrainRepository = "https://github.com/garrytan/gbrain.git";
const gbrainRevision =
  process.env.GOTRADER_GBRAIN_REVISION || "c44cdb52b1ced1a7726c3e2be099cbba6ed25ff4";
const installRequested = process.argv.includes("--install");
const bunBin = path.join(os.homedir(), ".bun", "bin");
const npmGlobalBin = path.join(
  process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
  "npm"
);
const npmBunBin = path.join(npmGlobalBin, "node_modules", "bun", "bin");
const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const isWindowsScript = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
    const executable = isWindowsScript ? process.env.ComSpec || "cmd.exe" : command;
    const executableArgs = isWindowsScript ? ["/d", "/s", "/c", command, ...args] : args;
    const child = spawn(executable, executableArgs, {
      cwd: options.cwd ?? repoRoot,
      env: {
        ...process.env,
        GBRAIN_HOME: gbrainHome,
        GBRAIN_NO_UPDATE_CHECK: "1",
        PATH: [bunBin, npmBunBin, npmGlobalBin, process.env.PATH].filter(Boolean).join(path.delimiter)
      },
      stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const stdout = [];
    const stderr = [];
    if (!options.inherit) {
      child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
      child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    }
    child.on("error", (error) =>
      resolve({ ok: false, exitCode: null, stdout: "", stderr: error.message })
    );
    child.on("exit", (exitCode) =>
      resolve({
        ok: exitCode === 0,
        exitCode,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      })
    );
  });
}

async function firstWorking(candidates, args = ["--version"]) {
  for (const candidate of candidates) {
    const result = await run(candidate, args);
    if (result.ok) return { command: candidate, result };
  }
  return null;
}

async function installVendoredGbrain(bunCommand) {
  await fs.mkdir(path.dirname(vendorRoot), { recursive: true });
  let checkoutPresent = true;
  let repositoryPresent = true;
  try {
    await fs.access(path.join(vendorRoot, "src", "cli.ts"));
  } catch {
    checkoutPresent = false;
  }
  try {
    await fs.access(path.join(vendorRoot, ".git"));
  } catch {
    repositoryPresent = false;
  }
  if (!repositoryPresent) {
    console.log("Cloning garrytan/gbrain into the isolated GoTrader runtime directory...");
    const clone = await run(
      "git",
      ["clone", "--no-checkout", gbrainRepository, vendorRoot],
      { inherit: true }
    );
    if (!clone.ok) throw new Error("Unable to clone garrytan/gbrain.");
  }
  const currentRevision = await run("git", ["-C", vendorRoot, "rev-parse", "HEAD"]);
  if (currentRevision.stdout.trim() !== gbrainRevision) {
    console.log(`Checking out audited gbrain revision ${gbrainRevision.slice(0, 12)}...`);
    const fetch = await run(
      "git",
      ["-C", vendorRoot, "fetch", "--depth", "1", "origin", gbrainRevision],
      { inherit: true }
    );
    if (!fetch.ok) throw new Error(`Unable to fetch audited gbrain revision ${gbrainRevision}.`);
  }
  if (!checkoutPresent || currentRevision.stdout.trim() !== gbrainRevision) {
    const checkout = await run(
      "git",
      ["-C", vendorRoot, "checkout", "--detach", gbrainRevision],
      { inherit: true }
    );
    if (!checkout.ok) throw new Error(`Unable to check out audited gbrain revision ${gbrainRevision}.`);
  }
  console.log("Installing gbrain runtime dependencies in the isolated checkout...");
  const install = await run(
    bunCommand,
    ["install", "--ignore-scripts"],
    { inherit: true, cwd: vendorRoot }
  );
  if (!install.ok) throw new Error("Unable to install vendored gbrain dependencies.");

  await fs.mkdir(localBinRoot, { recursive: true });
  if (process.platform === "win32") {
    const wrapper = [
      "@ECHO OFF",
      `"${bunCommand}" "${path.join(vendorRoot, "src", "cli.ts")}" %*`,
      ""
    ].join("\r\n");
    await fs.writeFile(localGbrainCommand, wrapper, "utf8");
  } else {
    const wrapper = [
      "#!/usr/bin/env sh",
      `exec "${bunCommand}" "${path.join(vendorRoot, "src", "cli.ts")}" "$@"`,
      ""
    ].join("\n");
    await fs.writeFile(localGbrainCommand, wrapper, { encoding: "utf8", mode: 0o755 });
  }
  return firstWorking([localGbrainCommand]);
}

const bunCandidates = [
  process.env.BUN_COMMAND,
  path.join(bunBin, process.platform === "win32" ? "bun.exe" : "bun"),
  path.join(npmGlobalBin, process.platform === "win32" ? "bun.cmd" : "bun"),
  "bun"
].filter(Boolean);
let bun = await firstWorking(bunCandidates);

if (!bun && installRequested) {
  console.log("Installing Bun through the official npm-distributed installer package...");
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const installation = await run(npmCommand, ["install", "-g", "bun"], { inherit: true });
  if (!installation.ok) {
    throw new Error("Bun installation failed.");
  }
  bun = await firstWorking(bunCandidates);
}

if (!bun) {
  console.log(JSON.stringify({
    status: "bun_missing",
    nextAction: "Run npm.cmd run gbrain:setup -- --install, then restart GoTrader.",
    gbrainHome,
    authority
  }, null, 2));
  process.exit(1);
}

const gbrainCandidates = [
  process.env.GBRAIN_COMMAND,
  localGbrainCommand,
  path.join(bunBin, process.platform === "win32" ? "gbrain.exe" : "gbrain"),
  path.join(bunBin, process.platform === "win32" ? "gbrain.cmd" : "gbrain"),
  path.join(npmGlobalBin, process.platform === "win32" ? "gbrain.cmd" : "gbrain"),
  "gbrain"
].filter(Boolean);
let gbrain = await firstWorking(gbrainCandidates);

if (!gbrain && installRequested) {
  gbrain = await installVendoredGbrain(bun.command);
}

if (!gbrain) {
  console.log(JSON.stringify({
    status: "gbrain_missing",
    bunVersion: bun.result.stdout.trim(),
    nextAction: "Run npm.cmd run gbrain:setup -- --install, then restart GoTrader.",
    gbrainHome,
    authority
  }, null, 2));
  process.exit(1);
}

await fs.mkdir(gbrainHome, { recursive: true });
let initialized = true;
try {
  await fs.access(gbrainConfigPath);
} catch {
  initialized = false;
}

if (!initialized) {
  console.log(`Initializing isolated GoTrader PGLite brain at ${gbrainHome}...`);
  const initialization = await run(
    gbrain.command,
    ["init", "--pglite", "--no-embedding", "--json"],
    { inherit: true }
  );
  if (!initialization.ok) {
    throw new Error("gbrain PGLite initialization failed.");
  }
}

const keywordOnly = await run(
  gbrain.command,
  ["config", "set", "search.mcp_keyword_only", "true"]
);
if (!keywordOnly.ok) {
  console.warn(`Unable to enforce keyword-only retrieval: ${keywordOnly.stderr.trim()}`);
}

const doctor = await run(gbrain.command, ["doctor", "--json", "--fast"]);
const installedRevision = await run("git", ["-C", vendorRoot, "rev-parse", "HEAD"]);
console.log(JSON.stringify({
  status: "ready",
  bunVersion: bun.result.stdout.trim(),
  gbrainVersion: gbrain.result.stdout.trim(),
  gbrainRevision: installedRevision.ok ? installedRevision.stdout.trim() : "external_cli",
  gbrainCommand: gbrain.command,
  gbrainHome,
  storage: "PGLite plus GoTrader atomic Markdown spool",
  retrievalMode: "keyword_only_no_api_spend",
  doctorStatus: doctor.ok ? "passed" : "completed_with_warnings",
  doctorSummary: (doctor.stdout || doctor.stderr).trim().slice(0, 1_500),
  authority
}, null, 2));
