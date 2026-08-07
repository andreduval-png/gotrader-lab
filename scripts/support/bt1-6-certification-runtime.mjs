import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  assertNoSensitiveKeys,
  hashPattern,
  requireAuthorityNone
} from "./bt1-5-qualification-runtime.mjs";

export const bt16RuntimeRoot = () => path.resolve(process.cwd(), ".gotrader", "bt1-6");

export function resolveBt16Path(value, label = "path") {
  const root = bt16RuntimeRoot();
  const resolved = path.resolve(value);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`BT1.6 ${label} must remain below ${root}.`);
  }
  return resolved;
}

export function readBt16Json(filePath) {
  const value = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
  assertNoSensitiveKeys(value, "BT1.6 input");
  return value;
}

export function writeBt16JsonAtomic(filePath, value) {
  const destination = resolveBt16Path(filePath, "output path");
  assertNoSensitiveKeys(value, "BT1.6 output");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(destination)) {
    if (fs.readFileSync(destination, "utf8") === serialized) return destination;
    throw new Error(`BT1.6 immutable artifact conflict at ${destination}.`);
  }
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, serialized, { encoding: "utf8", flag: "wx" });
  fs.renameSync(temporary, destination);
  return destination;
}

export async function verifyHashedArtifact(value, idKey, canonical, label) {
  requireAuthorityNone(value.authority, `${label} authority`);
  if (!hashPattern.test(String(value[idKey] ?? ""))) {
    throw new Error(`BT1.6 ${label} ${idKey} is invalid.`);
  }
  const core = { ...value };
  delete core[idKey];
  if (await canonical.canonicalHash(core) !== value[idKey]) {
    throw new Error(`BT1.6 ${label} integrity mismatch.`);
  }
  return value;
}
