#!/usr/bin/env node

import path from "node:path";
import { compileTypescriptModules } from "../v2-baseline/compile-typescript-modules.mjs";

const outRoot = process.argv[2];
if (!outRoot) {
  throw new Error("Usage: compile-bt1-5-runtime-modules <output-directory>");
}

const workspaceRoot = process.cwd();
compileTypescriptModules({
  files: [path.join(workspaceRoot, "src", "lib", "historicalData", "index.ts")],
  outRoot: path.resolve(outRoot)
});
