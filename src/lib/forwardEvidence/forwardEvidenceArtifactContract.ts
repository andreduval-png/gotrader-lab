import { canonicalHash, V2_CANONICAL_HASH_VERSION } from "../canonical/canonicalValueSerialization";
import { findForwardEvidenceBlockedFields } from "./buildForwardEvidenceEntry";
import { FORWARD_EVIDENCE_AUTHORITY, type ForwardEvidenceEntry } from "./forwardEvidenceTypes";
import { FORWARD_EVIDENCE_STORAGE_KEY } from "./forwardEvidenceStorage";

export const FORWARD_EVIDENCE_ARTIFACT_SCHEMA = "gotrader-v2-forward-evidence-artifact-v1" as const;
export const FORWARD_EVIDENCE_MANIFEST_SCHEMA = "gotrader-v2-forward-evidence-manifest-v1" as const;
export const FORWARD_EVIDENCE_ARTIFACT_MIGRATION_VERSION = "bt3-phase-7-forward-evidence-shadow-v1" as const;

export type LegacyForwardEvidenceProjection = Readonly<Record<string, unknown>>;

export interface ForwardEvidenceArtifactCore {
  readonly schemaVersion: typeof FORWARD_EVIDENCE_ARTIFACT_SCHEMA;
  readonly artifactVersion: "v1";
  readonly hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  readonly artifactType: "forward_evidence_entry";
  readonly migrationVersion: typeof FORWARD_EVIDENCE_ARTIFACT_MIGRATION_VERSION;
  readonly migrationMode: "shadow_compare";
  readonly legacyAuthoritative: true;
  readonly legacyOrigin: Readonly<{
    storageKey: typeof FORWARD_EVIDENCE_STORAGE_KEY;
    entryId: string;
  }>;
  readonly identity: Readonly<{
    profileId: string;
    profileVersion: string;
    detectorVersion: "legacy_ifvg_forward_detector_unspecified";
    tradeConstructionPolicyVersion: "legacy_ifvg_forward_policy_v1";
    costModelVersion: "legacy_cost_model_unspecified";
    riskPolicyVersion: "legacy_frozen_profile_policy";
    sessionCalendarVersion: "legacy_session_calendar_unspecified";
  }>;
  readonly sourceLineage: Readonly<{
    sourceProvider: string;
    requestedSymbol: string;
    brokerSymbol: string;
    timeframe: string;
    sourceFingerprint: string;
    setupTimestamp: string;
    independentDate: string;
    forwardWindowId: string;
  }>;
  readonly causalTags: readonly string[];
  readonly derivation: Readonly<{
    kind: "evidence_from_legacy_forward_ledger";
    legacyStorageKey: typeof FORWARD_EVIDENCE_STORAGE_KEY;
    legacyEntryId: string;
  }>;
  readonly legacyProjection: LegacyForwardEvidenceProjection;
  readonly authority: Readonly<typeof FORWARD_EVIDENCE_AUTHORITY>;
}

export interface ForwardEvidenceArtifact extends ForwardEvidenceArtifactCore {
  readonly artifactId: string;
}

export interface ForwardEvidenceArtifactManifestCore {
  readonly schemaVersion: typeof FORWARD_EVIDENCE_MANIFEST_SCHEMA;
  readonly manifestVersion: "v1";
  readonly hashVersion: typeof V2_CANONICAL_HASH_VERSION;
  readonly migrationVersion: typeof FORWARD_EVIDENCE_ARTIFACT_MIGRATION_VERSION;
  readonly migrationMode: "shadow_compare";
  readonly legacyStorageKey: typeof FORWARD_EVIDENCE_STORAGE_KEY;
  readonly legacyAuthoritative: true;
  readonly automaticMirroringAllowed: false;
  readonly orderedArtifactIds: readonly string[];
  readonly legacyLedgerHash: string;
  readonly authority: Readonly<typeof FORWARD_EVIDENCE_AUTHORITY>;
}

export interface ForwardEvidenceArtifactManifest extends ForwardEvidenceArtifactManifestCore {
  readonly manifestId: string;
}

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const compactClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const unique = (values: readonly string[]) => [...new Set(values)].sort();

export const projectForwardEvidenceArtifactToLegacy = (
  artifact: Readonly<ForwardEvidenceArtifact>
): ForwardEvidenceEntry => compactClone(artifact.legacyProjection) as unknown as ForwardEvidenceEntry;

const causalTagsFor = (entry: Readonly<ForwardEvidenceEntry>) => Object.freeze(unique([
  `origin:${entry.evidenceOrigin}`,
  `causal_at_issue:${entry.causalAtIssue}`,
  `forward_eligible:${entry.forwardEligible}`,
  `outcome:${entry.outcome}`
]));

export async function buildForwardEvidenceArtifact(
  entry: Readonly<ForwardEvidenceEntry>
): Promise<Readonly<ForwardEvidenceArtifact>> {
  const legacyProjection = Object.freeze(compactClone(entry) as LegacyForwardEvidenceProjection);
  const blocked = findForwardEvidenceBlockedFields(legacyProjection);
  if (blocked.length) throw new Error(`Forward-evidence artifact contains blocked fields: ${blocked.join(", ")}`);
  if (!entry.entryId || !entry.profileId || !entry.profileVersion || !entry.sourceFingerprint) {
    throw new Error("Forward-evidence artifact legacy identity is incomplete.");
  }
  if (JSON.stringify(entry.authority) !== JSON.stringify(FORWARD_EVIDENCE_AUTHORITY)) {
    throw new Error("Forward-evidence artifact authority is invalid.");
  }
  const core: Readonly<ForwardEvidenceArtifactCore> = Object.freeze({
    schemaVersion: FORWARD_EVIDENCE_ARTIFACT_SCHEMA,
    artifactVersion: "v1",
    hashVersion: V2_CANONICAL_HASH_VERSION,
    artifactType: "forward_evidence_entry",
    migrationVersion: FORWARD_EVIDENCE_ARTIFACT_MIGRATION_VERSION,
    migrationMode: "shadow_compare",
    legacyAuthoritative: true,
    legacyOrigin: Object.freeze({ storageKey: FORWARD_EVIDENCE_STORAGE_KEY, entryId: entry.entryId }),
    identity: Object.freeze({
      profileId: entry.profileId,
      profileVersion: entry.profileVersion,
      detectorVersion: "legacy_ifvg_forward_detector_unspecified",
      tradeConstructionPolicyVersion: "legacy_ifvg_forward_policy_v1",
      costModelVersion: "legacy_cost_model_unspecified",
      riskPolicyVersion: "legacy_frozen_profile_policy",
      sessionCalendarVersion: "legacy_session_calendar_unspecified"
    }),
    sourceLineage: Object.freeze({
      sourceProvider: entry.sourceProvider,
      requestedSymbol: entry.requestedSymbol,
      brokerSymbol: entry.brokerSymbol,
      timeframe: entry.timeframe,
      sourceFingerprint: entry.sourceFingerprint,
      setupTimestamp: entry.setupTimestamp,
      independentDate: entry.independentDate,
      forwardWindowId: entry.forwardWindowId
    }),
    causalTags: causalTagsFor(entry),
    derivation: Object.freeze({
      kind: "evidence_from_legacy_forward_ledger",
      legacyStorageKey: FORWARD_EVIDENCE_STORAGE_KEY,
      legacyEntryId: entry.entryId
    }),
    legacyProjection,
    authority: FORWARD_EVIDENCE_AUTHORITY
  });
  return Object.freeze({ ...core, artifactId: await canonicalHash(core) });
}

export async function validateForwardEvidenceArtifact(value: unknown) {
  const blockers: string[] = [];
  if (!value || typeof value !== "object") return Object.freeze(["forward_evidence_artifact_missing"]);
  const artifact = value as Partial<ForwardEvidenceArtifact>;
  if (artifact.schemaVersion !== FORWARD_EVIDENCE_ARTIFACT_SCHEMA || artifact.artifactVersion !== "v1") {
    blockers.push("forward_evidence_artifact_schema_unsupported");
  }
  if (artifact.hashVersion !== V2_CANONICAL_HASH_VERSION) blockers.push("forward_evidence_artifact_hash_version_unsupported");
  if (artifact.migrationMode !== "shadow_compare" || artifact.legacyAuthoritative !== true) {
    blockers.push("forward_evidence_artifact_migration_boundary_invalid");
  }
  const projection = artifact.legacyProjection;
  if (!projection || findForwardEvidenceBlockedFields(projection).length) blockers.push("forward_evidence_artifact_projection_unsafe");
  if (JSON.stringify(artifact.authority) !== JSON.stringify(FORWARD_EVIDENCE_AUTHORITY)) {
    blockers.push("forward_evidence_artifact_authority_invalid");
  }
  if (!HASH_PATTERN.test(String(artifact.artifactId ?? ""))) blockers.push("forward_evidence_artifact_id_invalid");
  if (!artifact.legacyOrigin || !artifact.derivation || !artifact.legacyProjection) {
    blockers.push("forward_evidence_artifact_legacy_identity_missing");
  }
  if (!blockers.length && artifact.legacyOrigin && artifact.derivation && artifact.legacyProjection) {
    const { artifactId, ...core } = artifact as ForwardEvidenceArtifact;
    if (await canonicalHash(core) !== artifactId) blockers.push("forward_evidence_artifact_id_invalid");
    if (artifact.legacyOrigin.entryId !== artifact.derivation.legacyEntryId ||
        artifact.legacyOrigin.entryId !== String(artifact.legacyProjection.entryId ?? "")) {
      blockers.push("forward_evidence_artifact_legacy_identity_mismatch");
    }
  }
  return Object.freeze(unique(blockers));
}

export async function migrateForwardEvidenceLedgerToArtifacts(entries: readonly Readonly<ForwardEvidenceEntry>[]) {
  const ids = entries.map((entry) => entry.entryId);
  if (new Set(ids).size !== ids.length) throw new Error("Forward-evidence migration rejects duplicate legacy entry IDs.");
  const artifacts = Object.freeze(await Promise.all(entries.map(buildForwardEvidenceArtifact)));
  const legacyProjections = Object.freeze(artifacts.map(projectForwardEvidenceArtifactToLegacy));
  const core: Readonly<ForwardEvidenceArtifactManifestCore> = Object.freeze({
    schemaVersion: FORWARD_EVIDENCE_MANIFEST_SCHEMA,
    manifestVersion: "v1",
    hashVersion: V2_CANONICAL_HASH_VERSION,
    migrationVersion: FORWARD_EVIDENCE_ARTIFACT_MIGRATION_VERSION,
    migrationMode: "shadow_compare",
    legacyStorageKey: FORWARD_EVIDENCE_STORAGE_KEY,
    legacyAuthoritative: true,
    automaticMirroringAllowed: false,
    orderedArtifactIds: Object.freeze(artifacts.map((artifact) => artifact.artifactId)),
    legacyLedgerHash: await canonicalHash(legacyProjections),
    authority: FORWARD_EVIDENCE_AUTHORITY
  });
  const manifest = Object.freeze({ ...core, manifestId: await canonicalHash(core) });
  return Object.freeze({ artifacts, manifest });
}

export async function validateForwardEvidenceArtifactManifest(
  value: unknown,
  artifacts: readonly Readonly<ForwardEvidenceArtifact>[]
) {
  const blockers: string[] = [];
  if (!value || typeof value !== "object") return Object.freeze(["forward_evidence_manifest_missing"]);
  const manifest = value as Partial<ForwardEvidenceArtifactManifest>;
  if (manifest.schemaVersion !== FORWARD_EVIDENCE_MANIFEST_SCHEMA || manifest.manifestVersion !== "v1") {
    blockers.push("forward_evidence_manifest_schema_unsupported");
  }
  if (manifest.hashVersion !== V2_CANONICAL_HASH_VERSION) blockers.push("forward_evidence_manifest_hash_version_unsupported");
  if (manifest.migrationMode !== "shadow_compare" || manifest.legacyAuthoritative !== true ||
      manifest.automaticMirroringAllowed !== false) blockers.push("forward_evidence_manifest_migration_boundary_invalid");
  if (!Array.isArray(manifest.orderedArtifactIds) || new Set(manifest.orderedArtifactIds).size !== manifest.orderedArtifactIds.length) {
    blockers.push("forward_evidence_manifest_order_invalid");
  }
  if (!HASH_PATTERN.test(String(manifest.manifestId ?? "")) || !HASH_PATTERN.test(String(manifest.legacyLedgerHash ?? ""))) {
    blockers.push("forward_evidence_manifest_id_invalid");
  }
  if (!blockers.length) {
    const { manifestId, ...core } = manifest as ForwardEvidenceArtifactManifest;
    if (await canonicalHash(core) !== manifestId) blockers.push("forward_evidence_manifest_id_invalid");
    if (JSON.stringify(manifest.orderedArtifactIds) !== JSON.stringify(artifacts.map((artifact) => artifact.artifactId))) {
      blockers.push("forward_evidence_manifest_artifact_order_mismatch");
    }
    if (await canonicalHash(artifacts.map(projectForwardEvidenceArtifactToLegacy)) !== manifest.legacyLedgerHash) {
      blockers.push("forward_evidence_manifest_legacy_hash_mismatch");
    }
  }
  return Object.freeze(unique(blockers));
}
