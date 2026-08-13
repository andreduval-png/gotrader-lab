#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { compileTypescriptModules } from "./v2-baseline/compile-typescript-modules.mjs";

const root = process.cwd();
const outRoot = path.join(root, ".gotrader/bt3-shadow-lease/node");
compileTypescriptModules({ files: [path.join(root, "src/lib/shadowOrchestration/shadowOrchestrationLease.ts")], outRoot });
const leaseModule = await import(`${pathToFileURL(path.join(outRoot, "shadowOrchestrationLease.mjs")).href}?v=${Date.now()}`);
const logicalJobId = `sha256:${"a".repeat(64)}`;
const coordinator = new leaseModule.InMemoryShadowLeaseCoordinator();
const at = "2026-08-12T16:00:00.000Z";

const acquired = await coordinator.acquire({ logicalJobId, ownerId: "worker-a", acquiredAt: at, durationMs: 60_000 });
assert.equal(acquired.status, "acquired");
assert.equal(await leaseModule.validateShadowOrchestrationLease(acquired.lease), true);
const sameOwner = await coordinator.acquire({ logicalJobId, ownerId: "worker-a", acquiredAt: "2026-08-12T16:00:10.000Z", durationMs: 60_000 });
assert.equal(sameOwner.status, "coalesced");
assert.equal(sameOwner.lease.leaseId, acquired.lease.leaseId);
const foreign = await coordinator.acquire({ logicalJobId, ownerId: "worker-b", acquiredAt: "2026-08-12T16:00:20.000Z", durationMs: 60_000 });
assert.equal(foreign.status, "blocked");
assert.equal(foreign.blocker, "shadow_lease_held_by_foreign_owner");
const renewed = await coordinator.renew({ logicalJobId, ownerId: "worker-a", renewedAt: "2026-08-12T16:00:30.000Z", durationMs: 60_000 });
assert.equal(renewed.epoch, 2);
assert.equal(renewed.previousLeaseId, acquired.lease.leaseId);
await assert.rejects(coordinator.release(logicalJobId, "worker-b", "2026-08-12T16:00:31.000Z"), /foreign owner/);
const released = await coordinator.release(logicalJobId, "worker-a", "2026-08-12T16:00:32.000Z");
assert.equal(released.status, "released");
const takeover = await coordinator.acquire({ logicalJobId, ownerId: "worker-b", acquiredAt: "2026-08-12T16:00:33.000Z", durationMs: 60_000 });
assert.equal(takeover.status, "taken_over");
assert.equal(takeover.lease.epoch, 3);
assert.equal(takeover.lease.previousLeaseId, released.leaseId);
await assert.rejects(leaseModule.assertCurrentShadowLease({ proof: renewed, current: takeover.lease, ownerId: "worker-a", at: "2026-08-12T16:00:34.000Z" }), /stale, foreign, or released/);
assert.equal(await leaseModule.assertCurrentShadowLease({ proof: takeover.lease, current: takeover.lease, ownerId: "worker-b", at: "2026-08-12T16:00:34.000Z" }), true);

const report = Object.freeze({
  schemaVersion: "gotrader-bt3-shadow-lease-report-v1",
  status: "passed",
  singleOwnerExclusion: true,
  sameOwnerCoalescing: true,
  renewalEpochLinkage: true,
  ownerBoundRelease: true,
  staleTakeover: true,
  staleProofRejected: true,
  runtimeIntegrated: false,
  mt5Contacted: false,
  authority: takeover.lease.authority
});
fs.mkdirSync(path.join(root, ".gotrader/bt3-shadow-lease"), { recursive: true });
fs.writeFileSync(path.join(root, ".gotrader/bt3-shadow-lease/report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
