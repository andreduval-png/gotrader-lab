import assert from "node:assert/strict";
import { qualificationPlan } from "./lib/p4-qualification-plan.mjs";
import { buildExpandedEvaluationProtocol } from "./lib/p4-expanded-evaluation-protocol.mjs";

for (const [flag, size] of [["--qualify-two-processes", 12], ["--qualify-four-processes", 24],
  ["--qualify-full-session", 78], ["--qualify-multi-date", 156]]) {
  const plan = qualificationPlan(flag);
  assert.deepEqual(plan, qualificationPlan(size));
  assert.equal(plan.stages, size / 6);
  assert.equal(plan.fullEvaluationAllowed, false);
  assert.deepEqual(plan.schedule, buildExpandedEvaluationProtocol().evaluationTimes.slice(0, size));
  assert.equal(new Set(plan.schedule).size, size);
  assert.ok(Date.parse(plan.endUtc) > Date.parse(plan.schedule.at(-1)));
}
const full = qualificationPlan(78), multi = qualificationPlan(156);
assert.deepEqual(full.dates, ["2026-04-06"]);
assert.equal(full.schedule.at(-1), "2026-04-06T19:55:00.000Z");
assert.deepEqual(multi.dates, ["2026-04-06", "2026-04-13"]);
assert.equal(multi.endUtc, "2026-04-14T00:00:00.000Z");
assert.equal(multi.schedule[78], "2026-04-13T13:30:00.000Z");
for (const invalid of [undefined, null, 0, 79, 936, "156", "--full"]) {
  assert.throws(() => qualificationPlan(invalid), /UNADMITTED/);
}
console.log("PASS: fixed full-session and two-date qualification, no full-run admission");
