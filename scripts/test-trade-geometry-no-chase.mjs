#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const sourcePath = path.join(root, "src", "lib", "tradeGeometry", "entryLifecycle.ts");
const out = path.join(root, ".gotrader", "trade-geometry-test", "entryLifecycle.mjs");
fs.mkdirSync(path.dirname(out), { recursive: true });
const transpiled = ts.transpileModule(fs.readFileSync(sourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 }
}).outputText;
fs.writeFileSync(out, transpiled, "utf8");

const { evaluateEntryLifecycle } = await import(`${pathToFileURL(out).href}?v=${Date.now()}`);
const asOf = "2026-08-20T12:00:00.000Z";

assert.equal(
  evaluateEntryLifecycle({ direction: "LONG", intendedPrice: 100, currentPrice: 107, asOf }),
  "ENTRY_MISSED"
);
assert.equal(
  evaluateEntryLifecycle({ direction: "SHORT", intendedPrice: 100, currentPrice: 93, asOf }),
  "ENTRY_MISSED"
);
assert.equal(
  evaluateEntryLifecycle({ direction: "LONG", intendedPrice: 100, currentPrice: 107, asOf, allowCausalRetrace: true }),
  "WAITING_FOR_ENTRY"
);
assert.equal(
  evaluateEntryLifecycle({ direction: "LONG", intendedPrice: 100, currentPrice: 100.2, asOf, availabilityTolerance: 0.25 }),
  "ENTRY_AVAILABLE"
);
assert.equal(
  evaluateEntryLifecycle({
    direction: "LONG",
    intendedPrice: 100,
    currentPrice: 100,
    asOf,
    expiresAt: "2026-08-20T11:59:59.000Z"
  }),
  "ENTRY_EXPIRED"
);

console.log("trade geometry no-chase tests passed");

