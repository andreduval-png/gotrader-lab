import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

export const readCleanPackageIdentity = (cwd) => {
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (git("status", "--porcelain", "--untracked-files=normal").trim()) {
    throw new Error("P4_CLEAN_PACKAGE_REQUIRED");
  }
  const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  const require = createRequire(path.join(cwd, "package.json"));
  const compilerPackage = require.resolve("typescript/package.json");
  const compilerVersion = JSON.parse(fs.readFileSync(compilerPackage, "utf8")).version;
  const locked = JSON.parse(fs.readFileSync(path.join(cwd, "package-lock.json"), "utf8"));
  if (compilerVersion !== locked.packages?.["node_modules/typescript"]?.version) {
    throw new Error("P4_COMPILER_LOCK_MISMATCH");
  }
  return {
    head: git("rev-parse", "HEAD").trim(),
    tree: git("rev-parse", "HEAD^{tree}").trim(),
    lockfileSha256: hash(path.join(cwd, "package-lock.json")),
    nodeVersion: process.version,
    nodeExecutableSha256: hash(process.execPath),
    compilerVersion,
    compilerSha256: hash(require.resolve("typescript"))
  };
};
