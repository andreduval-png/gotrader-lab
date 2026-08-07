import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

const FORBIDDEN_KEYS = new Set([
  "account",
  "accountid",
  "apikey",
  "login",
  "password",
  "privatekey",
  "secret",
  "token"
]);

export const authorityNone = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});

export const workspaceRoot = () => process.cwd();

export const bt15RuntimeRoot = () => path.resolve(workspaceRoot(), ".gotrader", "bt1-5");

export function resolveBt15Path(value, label = "path") {
  const root = bt15RuntimeRoot();
  const resolved = path.resolve(value);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`BT1.5 ${label} must remain below ${root}.`);
  }
  return resolved;
}

export function assertNoSensitiveKeys(value, location = "input") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoSensitiveKeys(entry, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      throw new Error(`BT1.5 ${location} contains forbidden sensitive field ${key}.`);
    }
    assertNoSensitiveKeys(nested, `${location}.${key}`);
  }
}

export function readJson(filePath) {
  const parsed = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
  assertNoSensitiveKeys(parsed);
  return parsed;
}

export function writeJsonAtomic(filePath, value) {
  const destination = resolveBt15Path(filePath, "output path");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  fs.renameSync(temporary, destination);
  return destination;
}

export async function loadBt15Modules(label = "runtime") {
  const outRoot = resolveBt15Path(
    path.join(bt15RuntimeRoot(), "compiled", `${label}-${process.pid}-${Date.now()}`),
    "compiled module path"
  );
  compileTypescriptModules({
    files: [path.join(workspaceRoot(), "src", "lib", "historicalData", "index.ts")],
    outRoot
  });
  const load = (name) => import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
  return Object.freeze({
    contracts: await load("historicalDatasetContracts"),
    certificate: await load("historicalDatasetCertificate"),
    qualification: await load("historicalQualificationContracts"),
    repository: await load("historicalDatasetRepository"),
    lineage: await load("historicalDatasetLineage"),
    mt5Provider: await load("mt5ReadOnlyHistoricalProvider"),
    canonical: await load("canonicalValueSerialization")
  });
}

export function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = true;
    }
  }
  return result;
}

export function directorySize(root) {
  let bytes = 0;
  let files = 0;
  if (!fs.existsSync(root)) return Object.freeze({ bytes, files });
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile()) {
        bytes += fs.statSync(entryPath).size;
        files += 1;
      }
    }
  };
  visit(root);
  return Object.freeze({ bytes, files });
}

export function compactJson(value) {
  const compact = JSON.parse(JSON.stringify(value));
  assertNoSensitiveKeys(compact, "compact artifact");
  return compact;
}

export const hashPattern = /^sha256:[0-9a-f]{64}$/;

export function requireHash(value, label) {
  if (!hashPattern.test(String(value ?? ""))) {
    throw new Error(`BT1.5 ${label} must be a canonical sha256 identity.`);
  }
  return value;
}

export function requireAuthorityNone(value, label = "authority") {
  if (
    value?.executionAuthority !== "none" ||
    value?.brokerAuthority !== "none" ||
    value?.readinessOverrideAuthority !== "none"
  ) throw new Error(`BT1.5 ${label} must remain none/none/none.`);
}

export function isMain(importMetaUrl) {
  return process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === importMetaUrl;
}
