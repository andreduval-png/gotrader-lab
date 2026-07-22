#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const workspace = process.cwd();
const fixtureRoot = path.join(workspace, "tests", "fixtures", "v2-baseline");
const authority = {
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
};
const forbiddenKeys = /^(rawCandles|candles|candleArray|rawSnapshot|accountData|orders?|positions?|apiKey|password|token|secret)$/i;

const inspect = (value, pointer = "$", violations = []) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspect(item, `${pointer}[${index}]`, violations));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.test(key)) violations.push(`${pointer}.${key}`);
      inspect(child, `${pointer}.${key}`, violations);
    }
  }
  return violations;
};

const collectAuthorities = (value, authorities = []) => {
  if (Array.isArray(value)) {
    value.forEach((item) => collectAuthorities(item, authorities));
  } else if (value && typeof value === "object") {
    if (value.authority && typeof value.authority === "object") authorities.push(value.authority);
    Object.values(value).forEach((child) => collectAuthorities(child, authorities));
  }
  return authorities;
};

const fixtureFiles = fs.readdirSync(fixtureRoot).filter((file) => file.endsWith(".snapshot.json"));
assert.ok(fixtureFiles.length >= 3, "Expected the Phase 0 golden fixtures.");
for (const file of fixtureFiles) {
  const value = JSON.parse(fs.readFileSync(path.join(fixtureRoot, file), "utf8"));
  const authorities = collectAuthorities(value);
  assert.ok(authorities.length > 0, `${file} must contain an explicit authority contract.`);
  authorities.forEach((candidate) => assert.deepEqual(candidate, authority, `${file} authority changed.`));
  assert.deepEqual(inspect(value), [], `${file} contains forbidden data.`);
}

const routeSource = fs.readFileSync(path.join(workspace, "src", "App.tsx"), "utf8");
assert.equal(/path\s*=\s*["']\/execute["']/.test(routeSource), false, "The /execute route must not exist.");
const manifestText = fs.readFileSync(path.join(workspace, "src", "lib", "v2Baseline", "strategyBaselineManifest.ts"), "utf8");
assert.equal(/executionAuthority:\s*["'](?!none)/.test(manifestText), false);
assert.equal(/brokerAuthority:\s*["'](?!none)/.test(manifestText), false);
assert.equal(/readinessOverrideAuthority:\s*["'](?!none)/.test(manifestText), false);

const pushFeedTypes = fs.readFileSync(
  path.join(workspace, "src", "lib", "mt5PushFeed", "mt5PushFeedTypes.ts"),
  "utf8"
);
const pushFeedGateway = fs.readFileSync(
  path.join(workspace, "src", "lib", "mt5PushFeed", "mt5PushFeedGateway.ts"),
  "utf8"
);
assert.match(
  pushFeedTypes,
  /interface Mt5PushFeedAuthority[\s\S]*executionAuthority:\s*"none"[\s\S]*brokerAuthority:\s*"read_only"[\s\S]*readinessOverrideAuthority:\s*"none"/,
  "Legacy MT5 push-feed transport must remain read-only and non-executable during compatibility migration."
);
assert.equal(
  /export\s+(?:async\s+)?function\s+(?:placeOrder|buyMarket|sellMarket|closePosition|modifyOrder|cancelOrder)\b/i.test(pushFeedGateway),
  false,
  "MT5 push-feed gateway must not export broker mutation functions."
);
assert.match(
  pushFeedGateway,
  /Unsafe MT5 push-feed payload fields/,
  "MT5 push-feed gateway must continue blocking account/order/position payloads."
);
const architectureSpecification = fs.readFileSync(
  path.join(workspace, "docs", "architecture", "gotrader-v2-architecture-specification-rev1.md"),
  "utf8"
);
assert.match(architectureSpecification, /marketDataAccess:\s*"read_only"/);
assert.match(architectureSpecification, /brokerAuthority:\s*"none"/);
assert.match(architectureSpecification, /legacy field is deprecated only after every consumer and fixture migrates/i);

console.log(JSON.stringify({
  status: "passed",
  fixtureFiles,
  authority,
  executeRouteAvailable: false,
  legacyPushFeedCapability: "market_data_read_only",
  legacyPushFeedCanGrantBrokerAuthority: false
}, null, 2));
