import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { inspectDiskBudget } from "./lib/p4-disk-budget.mjs";
import { readCleanPackageIdentity } from "./lib/p4-package-identity.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "gotrader-p4-package-"));
const git = (...args) => execFileSync("git", args, { cwd: root, windowsHide: true, stdio: "pipe" });
try {
  fs.writeFileSync(path.join(root, "package-lock.json"), "{}");
  assert.equal(inspectDiskBudget({ directory: root, maxOutputBytes: 2, minimumFreeDiskBytes: 0 }).reason, null);
  assert.equal(inspectDiskBudget({ directory: root, maxOutputBytes: 1, minimumFreeDiskBytes: 0 }).reason, "OUTPUT_LIMIT");
  assert.equal(inspectDiskBudget({ directory: root, maxOutputBytes: 2, minimumFreeDiskBytes: Number.MAX_SAFE_INTEGER }).reason, "FREE_DISK_LIMIT");
  git("init");
  fs.writeFileSync(path.join(root, "package-lock.json"), JSON.stringify({ packages: { "node_modules/typescript": { version: "0.0.0-fixture" } } }));
  fs.writeFileSync(path.join(root, ".gitignore"), "node_modules/");
  const compiler = path.join(root, "node_modules", "typescript");
  fs.mkdirSync(compiler, { recursive: true });
  fs.writeFileSync(path.join(compiler, "package.json"), JSON.stringify({ name: "typescript", version: "0.0.0-fixture", main: "index.js" }));
  fs.writeFileSync(path.join(compiler, "index.js"), "// fixture only");
  git("add", "package-lock.json", ".gitignore");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", "commit", "-m", "Synthetic test fixture");
  const original = readCleanPackageIdentity(root);
  assert.match(original.head, /^[a-f0-9]{40,64}$/);
  assert.match(original.lockfileSha256, /^[a-f0-9]{64}$/);
  fs.writeFileSync(path.join(root, "untracked.txt"), "dirty");
  assert.throws(() => readCleanPackageIdentity(root), /CLEAN_PACKAGE_REQUIRED/);
  fs.unlinkSync(path.join(root, "untracked.txt"));
  fs.writeFileSync(path.join(root, "package-lock.json"), "{ }");
  assert.throws(() => readCleanPackageIdentity(root), /CLEAN_PACKAGE_REQUIRED/);
  console.log("PASS: output/disk boundaries and clean-package identity (temporary fixture repository only)");
} finally {
  // Only this newly created fixture directory is removed.
  if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith("gotrader-p4-package-")) throw new Error("Unexpected fixture path");
  fs.rmSync(root, { recursive: true, force: true });
}
