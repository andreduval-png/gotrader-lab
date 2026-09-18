// Conservative probe-admission limits, not certified workload requirements.
export const P4_PROBE_POLICY = Object.freeze({
  policyId: "gotrader.p4.capacity-preflight.v1",
  minimumFreeMemoryBytes: 4 * 1024 ** 3,
  minimumFreeDiskBytes: 4 * 1024 ** 3,
  maximumProbeWorkers: 1
});

export const evaluateCapacityPreflight = ({ freeMemoryBytes, freeDiskBytes }) => {
  const blockers = [];
  const valid = (value) => Number.isSafeInteger(value) && value >= 0;
  if (!valid(freeMemoryBytes)) blockers.push("MEMORY_MEASUREMENT_UNAVAILABLE");
  else if (freeMemoryBytes < P4_PROBE_POLICY.minimumFreeMemoryBytes) blockers.push("INSUFFICIENT_FREE_MEMORY_FOR_PROBE");
  if (!valid(freeDiskBytes)) blockers.push("DISK_MEASUREMENT_UNAVAILABLE");
  else if (freeDiskBytes < P4_PROBE_POLICY.minimumFreeDiskBytes) blockers.push("INSUFFICIENT_FREE_DISK_FOR_PROBE");
  return Object.freeze({
    policyId: P4_PROBE_POLICY.policyId,
    status: blockers.length ? "CAPACITY_BLOCKED" : "BOUNDED_PROBE_ELIGIBLE",
    blockers: Object.freeze(blockers),
    maximumProbeWorkers: blockers.length ? 0 : P4_PROBE_POLICY.maximumProbeWorkers,
    safeWorkerCount: 0,
    qualificationStatus: "NOT_QUALIFIED",
    fullDatasetRunAllowed: false,
    authority: "none/none/none"
  });
};
