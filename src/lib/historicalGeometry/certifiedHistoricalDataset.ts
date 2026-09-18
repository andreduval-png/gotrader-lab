export const BT_G1_1_CERTIFIED_DATASET = Object.freeze({
  certificateId: "sha256:7ffa32b773a0f3d347997d20dc9796f8bd27a48fbbfd4315cafec23d28bcb193",
  registryId: "sha256:ec877c21a370699094ed856d2419712f561dc8f3ef23350559c6985a9df4c9eb",
  datasetId: "sha256:aee24dc3d7e95759c0a58039c9a97985a63dd8014dd3ab9d9e843badeb09640d",
  datasetChecksum: "sha256:4e51534035ca982a217ba64ec4438f7c2d7d7d19c7f0c1a0b6dff57b4539a0be",
  sourceFingerprint: "sha256:e164236affb51072322ce78bf297c03b3c403243e206a685b917792ac6db07bd",
  requestedSymbol: "MNQ",
  brokerSymbol: "USTECH",
  startUtc: "2024-08-01T00:00:00.000Z",
  endUtc: "2026-08-01T00:00:00.000Z",
  nativeTimeframes: Object.freeze(["M1", "D1", "W1"]),
  derivedTimeframes: Object.freeze(["M5", "M15", "H1", "H4"]),
  historicalTimeVerified: true,
  historicalDstVerified: true,
  integrityStatus: "accepted_with_warnings",
  proxyNotice: "USTECH CFD/proxy research; not CME MNQ futures truth.",
  authority: Object.freeze({
    executionAuthority: "none",
    brokerAuthority: "none",
    readinessOverrideAuthority: "none"
  })
} as const);

export const assertBtG11CertifiedDatasetBinding = (binding: {
  certificateId: string;
  datasetId: string;
  datasetChecksum: string;
}) => {
  if (
    binding.certificateId !== BT_G1_1_CERTIFIED_DATASET.certificateId ||
    binding.datasetId !== BT_G1_1_CERTIFIED_DATASET.datasetId ||
    binding.datasetChecksum !== BT_G1_1_CERTIFIED_DATASET.datasetChecksum
  ) {
    throw new Error("CERTIFIED_HISTORICAL_DATASET_IDENTITY_MISMATCH");
  }
  return BT_G1_1_CERTIFIED_DATASET;
};
