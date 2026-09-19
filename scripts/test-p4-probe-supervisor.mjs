import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { superviseProbe } from "./lib/p4-probe-supervisor.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "gotrader-p4-"));
const lockPath = path.join(root, "probe.lock");
const input = {
  lockPath, script: path.resolve("scripts/fixtures/p4-probe-child.mjs"),
  cwd: process.cwd(), timeoutMs: 3000, maxRssBytes: 1024, pollMs: 20,
  measureRss: async () => 512
};
try {
  const complete = await superviseProbe(input);
  assert.equal(complete.status, "COMPLETED");
  assert.equal(fs.existsSync(lockPath), false);
  assert.equal((await superviseProbe({ ...input, args: ["require-gc"] })).status, "COMPLETED");
  const failure = await superviseProbe({ ...input, args: ["fail"] });
  assert.equal(failure.status, "FAILED");
  const running = superviseProbe({ ...input, args: ["spin"], timeoutMs: 250 });
  await assert.rejects(superviseProbe(input), /EEXIST/);
  assert.equal((await running).reason, "TIME_LIMIT");
  assert.equal(fs.existsSync(lockPath), false);
  assert.equal((await superviseProbe({ ...input, args: ["spin"], measureRss: async () => 1025 })).reason, "RSS_LIMIT");
  assert.equal((await superviseProbe({ ...input, args: ["spin"], measureRss: async () => { throw new Error("unavailable"); } })).reason, "RSS_UNAVAILABLE");
  let diskChecks = 0;
  assert.equal((await superviseProbe({
    ...input, args: ["spin"],
    inspectDisk: () => ({ reason: ++diskChecks > 1 ? "OUTPUT_LIMIT" : null })
  })).reason, "OUTPUT_LIMIT");
  await assert.rejects(superviseProbe({
    ...input, inspectDisk: () => { throw new Error("disk unavailable"); }
  }), /DISK_TELEMETRY_UNAVAILABLE/);
  assert.equal(fs.existsSync(lockPath), false);
  fs.writeFileSync(lockPath, JSON.stringify({ token: "stale-manual-review-required" }));
  await assert.rejects(superviseProbe(input), /EEXIST/);
  assert.match(fs.readFileSync(lockPath, "utf8"), /stale-manual-review-required/);
  fs.unlinkSync(lockPath);
  console.log("PASS: child completion/failure, blocked event-loop timeout, RSS breach, unavailable telemetry, exclusive/stale lock");
} finally {
  fs.rmdirSync(root);
}
