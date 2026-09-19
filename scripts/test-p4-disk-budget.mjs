import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { inspectDiskBudget } from "./lib/p4-disk-budget.mjs";
const directory = path.resolve("scripts/fixtures");
const input = { directory, maxOutputBytes: 128 * 1024 ** 2, minimumFreeDiskBytes: 0 };
const expected = inspectDiskBudget(input);
let calls = 0;
const raced = inspectDiskBudget({ ...input, fileSystem: { ...fs, lstatSync(file) {
  if (++calls === 2) throw Object.assign(new Error("atomic rename"), { code: "ENOENT" });
  return fs.lstatSync(file);
} } });
assert.equal(raced.outputBytes, expected.outputBytes);
assert.equal(raced.reason, expected.reason);
for (const code of ["ENOENT", "EACCES"]) {
  let attempts = 0;
  assert.throws(() => inspectDiskBudget({ ...input, fileSystem: { ...fs, lstatSync() {
    attempts += 1;
    throw Object.assign(new Error(code), { code });
  } } }), new RegExp(code));
  assert.equal(attempts, code === "ENOENT" ? 3 : 1);
}
assert.equal(inspectDiskBudget({ ...input, maxOutputBytes: 0 }).reason, "OUTPUT_LIMIT");
console.log("PASS: atomic-rename rescan, persistent telemetry failure, and unchanged output limit");
