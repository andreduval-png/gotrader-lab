import { buildExpandedEvaluationProtocol } from "./p4-expanded-evaluation-protocol.mjs";

const sizes = Object.freeze({
  "--qualify-two-processes": 12,
  "--qualify-four-processes": 24,
  "--qualify-full-session": 78,
  "--qualify-multi-date": 156
});

export const qualificationPlan = (option) => {
  const observationsPerOwner = typeof option === "string" ? sizes[option] : option;
  if (!Object.values(sizes).includes(observationsPerOwner)) throw new Error("UNADMITTED_QUALIFICATION_SIZE");
  const protocol = buildExpandedEvaluationProtocol();
  const schedule = protocol.evaluationTimes.slice(0, observationsPerOwner);
  const endUtc = new Date(Date.parse(`${schedule.at(-1).slice(0, 10)}T00:00:00.000Z`) + 86400000).toISOString();
  const batchSize = observationsPerOwner >= 78 ? 3 : protocol.observationsPerBatch;
  return { observationsPerOwner, batchSize, stages: observationsPerOwner / batchSize,
    startUtc: schedule[0], endUtc, schedule,
    dates: [...new Set(schedule.map((time) => time.slice(0, 10)))], fullEvaluationAllowed: false };
};
