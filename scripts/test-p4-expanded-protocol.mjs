import assert from "node:assert/strict";
import { buildExpandedEvaluationProtocol } from "./lib/p4-expanded-evaluation-protocol.mjs";
import { canonicalHash } from "./lib/bt-g1-3-certified-dataset.mjs";

const protocol = buildExpandedEvaluationProtocol();
const { protocolHash, ...body } = protocol;
assert.equal(protocolHash, canonicalHash(body));
assert.deepEqual(protocol, buildExpandedEvaluationProtocol());
assert.equal(protocol.evaluationTimes.length, 936);
assert.equal(new Set(protocol.evaluationTimes).size, 936);
assert.equal(protocol.windows.length, 3);
assert.equal(protocol.owners.length, 5);
const clock = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York",
  hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
for (const window of protocol.windows) {
  assert.equal(window.dates.length, 4);
  for (const date of window.dates) {
    const times = protocol.evaluationTimes.filter((time) => time.startsWith(date));
    assert.equal(new Date(times[0]).getUTCDay(), 1);
    assert.equal(clock.format(new Date(times[0])), "09:30");
    assert.equal(clock.format(new Date(times.at(-1))), "15:55");
    assert.ok(times.every((time) => time >= protocol.dataset.startUtc && time < protocol.dataset.endUtc));
  }
}
assert.equal(protocol.executionDisposition, "PLANNED_NOT_ADMITTED");
assert.equal(protocol.untouchedHoldout, false);
assert.equal(protocol.researchValidated, false);
assert.equal(protocol.authority, "none/none/none");
console.log(JSON.stringify({ status: "passed", protocolHash, observationsPerOwner: 936,
  batchesPerOwner: 156, owners: 5, admitted: false }, null, 2));
