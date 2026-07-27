# GoTrader Track B1-L1 - Lineage Node Reference

Status: normative planning reference; no repository implementation

Specification ID: `gotrader-b1-lineage-node-reference-v1`

Parent:
`track-b1-canonical-lineage-graph-specification.md`

## 1. Common Node Reference

The graph stores a compact reference, not the domain payload.

Every node reference must contain:

| Field | Requirement |
|---|---|
| `graphSchemaVersion` | Exact graph schema |
| `nodeReferenceSchemaVersion` | Exact reference schema |
| `lineageNodeKey` | Canonical graph lookup key |
| `nodeClass` | Owned, external, advisory, materialized, or control |
| `nodeType` | Registered type |
| `ownerNamespace` | Artifact owner |
| `ownerContractVersion` | Owner adapter/contract version |
| `canonicalArtifactId` | Original owner ID, unchanged |
| `ownerPayloadHash` | Original hash/checksum when available |
| `lifecycleStatus` | Registered lifecycle state |
| `retentionClass` | Versioned retention class |
| `integrityStatus` | Verified, unresolved, blocked, quarantined, archived, or tombstoned |
| `sealedAt` | Compact UTC timestamp when owned/available |
| `authority` | Exactly `none / none / none` |
| `capabilities` | All B1 authority capabilities false |

Optional compact identity fields include:

- logical job ID;
- control-request ID;
- requested and broker symbols;
- timeframe;
- source fingerprint;
- time-contract ID;
- context artifact ID;
- dataset ID/checksum;
- strategy/profile/version;
- parameter fingerprint;
- cost-model ID;
- evidence ID;
- memory document ID.

The reference must exclude raw candles, artifact bodies, snapshots, prompts,
secrets, account/order/position data, screenshots, and base64.

## 2. Node Class Rules

| Class | Owner | Authoritative | Required for deterministic lineage | Rebuildable |
|---|---|---:|---:|---:|
| `owned_immutable` | B1 | yes within B1 | yes when declared | no |
| `external_authoritative` | Existing subsystem | yes under owner | yes when declared | owner-defined |
| `derived_advisory` | Memory/advisory subsystem | no | no | usually |
| `operational_materialization` | B1 projection layer | no | no | yes |
| `control_retention` | B1 audit/retention | authoritative for control decision only | when applicable | no |

Node class cannot change in place.

## 3. External Authoritative Nodes

### 3.1 `verified_close`

- **Owner:** A2 durable close-event ledger.
- **Identity:** existing event ID and candle identity.
- **Required metadata:** requested/broker symbol, timeframe, close time, source
  fingerprint, time-contract reference, ledger identity.
- **Lifecycle:** accepted, rejected, quarantined, or archived by owner.
- **Retention:** owner-managed external.
- **Consumers:** B1 job admission and audit.
- **Required edges:** may participate in `triggered` edges to one or more
  research requests.
- **Restriction:** the graph cannot change close acceptance.

### 3.2 `canonical_candle_window`

- **Owner:** V2 candle repository/window builder.
- **Identity:** existing window identity/checksum.
- **Required metadata:** source, symbol, timeframe, first/last close, count,
  normalization policy, purpose.
- **Lifecycle:** owner-defined immutable window reference.
- **Retention:** owner-managed external.
- **Consumers:** context lineage and historical dataset audit.
- **Required edges:** `window_constituent_of` a canonical context or dataset.
- **Restriction:** no candle array is stored in the graph.

### 3.3 `canonical_context`

- **Owner:** Phase 2A/V2 context builder or accepted A3 shadow adapter.
- **Identity:** existing `contextArtifactId`.
- **Required metadata:** context schema/policy, source fingerprint, as-of time,
  required timeframes/fact families, window identities, authority.
- **Lifecycle:** completed, blocked, or archived under owner.
- **Retention:** owner-managed external.
- **Consumers:** research request/stage audit and strategy-result audit.
- **Required edges:** constituent windows; may `derive_into` a request or stage.
- **Restriction:** fact arrays/body remain with owner.

### 3.4 `historical_dataset_manifest`

- **Owner:** existing V2 historical-manifest contract.
- **Identity:** existing dataset ID and checksum.
- **Required metadata:** boundaries/count, source fingerprint, symbol,
  timeframes, normalization policy, time-contract/DST status.
- **Lifecycle:** verified, blocked, regression, or archived under owner.
- **Retention:** owner-managed external.
- **Consumers:** historical profile admission and audit.
- **Required edges:** window/manifest ancestry as defined by owner.
- **Restriction:** no raw historical candles.

### 3.5 `strategy_profile`

- **Owner:** existing strategy library/profile registry.
- **Identity:** existing strategy/profile ID and immutable profile version.
- **Required metadata:** strategy family, profile version, detector version,
  research-only status, frozen/mutable status, and profile hash.
- **Lifecycle:** registered, frozen, deprecated, superseded, or blocked under
  owner.
- **Retention:** owner-managed external.
- **Consumers:** request admission, replay, OOS, and historical validation.
- **Restriction:** graph cannot edit thresholds, promote the profile, or
  unfreeze it.

### 3.6 `parameter_set`

- **Owner:** existing research parameter/proposal registry.
- **Identity:** existing parameter fingerprint or immutable proposal-version
  ID.
- **Required metadata:** profile ID/version, schema, allowlisted field names,
  parameter hash, and proposal/admission policy.
- **Lifecycle:** proposed, admitted, rejected, frozen, superseded, or blocked
  under owner.
- **Retention:** owner-managed external.
- **Consumers:** admitted research request, replay, OOS, and audit.
- **Restriction:** lineage registration cannot apply or mutate parameters.

### 3.7 `cost_model`

- **Owner:** existing replay/risk cost-model registry.
- **Identity:** existing cost-model ID/version and payload hash.
- **Required metadata:** symbol class, spread/slippage/commission policy,
  currency/R-unit basis, and applicability boundaries.
- **Lifecycle:** registered, frozen, deprecated, superseded, or blocked.
- **Retention:** owner-managed external.
- **Consumers:** replay, OOS, robustness, and historical validation.
- **Restriction:** mutable account state is forbidden.

### 3.8 `policy_contract`

- **Owner:** existing deterministic policy owner.
- **Identity:** policy namespace, policy ID/version, and payload hash.
- **Required metadata:** policy role, applicability, effective version, and
  authority.
- **Lifecycle:** registered, active, frozen, deprecated, or superseded under
  owner.
- **Retention:** owner-managed external.
- **Consumers:** admission, stages, validation, traversal, and audit.
- **Restriction:** policy references cannot grant authority or override owner
  decisions.

### 3.9 `evidence_gate_receipt`

- **Owner:** existing native evidence intake gate.
- **Identity:** existing intake request/receipt ID and payload hash.
- **Required metadata:** submitted candidate ID, gate policy/version,
  provenance-match status, accepted/rejected/blocked result, and native
  evidence ID when accepted.
- **Lifecycle:** submitted, accepted, rejected, blocked, or superseded under
  owner.
- **Retention:** owner-managed external.
- **Consumers:** audit and accepted-evidence relationship admission.
- **Restriction:** graph cannot create the receipt or change its decision.

### 3.10 `replay_result`

- **Owner:** existing deterministic replay subsystem.
- **Identity:** existing replay artifact/run ID and metrics hash.
- **Required metadata:** dataset, profile, parameters, cost, boundaries, engine
  version, classification.
- **Lifecycle:** completed, blocked, failed, or superseded under owner.
- **Retention:** owner-managed external or B1 historical result when B1 owns it.
- **Consumers:** OOS, audit, evidence intake candidate.
- **Required edges:** exact dataset/profile admission; may be parent of OOS.
- **Restriction:** positive replay is not evidence by itself.

### 3.11 `oos_result`

- **Owner:** existing walk-forward/OOS subsystem.
- **Identity:** existing OOS artifact/run ID and metrics hash.
- **Required metadata:** parent replay ID, ordered split boundaries, profile,
  cost, engine version, verdict.
- **Lifecycle:** completed, blocked, failed, or superseded.
- **Retention:** owner-managed external or B1-owned when applicable.
- **Consumers:** robustness analysis, audit, evidence intake candidate.
- **Required edges:** exactly one matching replay parent and one dataset.
- **Restriction:** identity mismatch blocks.

### 3.12 `robustness_result`

- **Owner:** existing Monte Carlo/robustness subsystem.
- **Identity:** existing artifact ID or canonical policy/outcome-set identity.
- **Required metadata:** parent outcome set, policy, deterministic seed policy,
  run count, cost model, sample sufficiency, result hash.
- **Lifecycle:** completed, blocked, failed, or superseded.
- **Retention:** owner-managed external or B1-owned when applicable.
- **Consumers:** historical validation, audit, evidence intake candidate.
- **Required edges:** exact replay/OOS outcome parent.
- **Restriction:** no account equity or mutable execution risk state.

### 3.13 `native_evidence`

- **Owner:** native research evidence ledger.
- **Identity:** existing `evidenceId`.
- **Required metadata:** native schema, cycle/validation identity, source,
  strategy/profile, result class, evidence/maturity summary, safety, authority.
- **Lifecycle:** owner-defined append-only evidence/correction lifecycle.
- **Retention:** owner-managed external; never deleted by lineage GC.
- **Consumers:** existing readiness/evidence systems and memory builder.
- **Required edges:** may have a verified `accepted_as_evidence` relationship
  from an accepted `evidence_gate_receipt`.
- **Restriction:** graph cannot create, modify, accept, reject, or supersede
  native evidence.

## 4. B1-Owned Immutable Nodes

### 4.1 `control_request`

- **Identity:** existing operator/system research-control request ID and
  payload hash.
- **Schema:** registered read-only research-control contract.
- **Lifecycle:** accepted, blocked, cancelled, expired, or consumed.
- **Retention:** retained with the triggered job.
- **Consumers:** research request admission and audit.
- **Required edges:** may participate in `triggered` for exactly the request
  admitted from it.
- **Restriction:** no execution, broker, readiness, evidence, or calibration
  authority.

### 4.2 `research_request`

- **Identity:** existing B1 logical job ID plus request payload hash.
- **Schema:** `CanonicalResearchJobRequest`.
- **Lifecycle:** accepted, blocked, cancelled, expired, completed.
- **Retention:** retained with terminal job lineage.
- **Consumers:** stage engine, audit, projection.
- **Required edges:** one trigger/control reference and declared context/source
  references.
- **Conflict:** same logical ID with changed payload quarantines.

### 4.3 `research_stage`

- **Identity:** stage artifact ID from job, stage/version, ordered inputs,
  previous stage, and output core.
- **Schema:** `CanonicalResearchStageArtifact`.
- **Lifecycle:** completed, blocked, failed, cancelled, or expired.
- **Retention:** required while referenced by retained result or recovery.
- **Consumers:** next stage, result validator, audit.
- **Required edges:** request, ordered inputs, previous stage/genesis.
- **Conflict:** stage identity/payload mismatch quarantines.

### 4.4 `research_result`

- **Identity:** terminal B1 result artifact ID and stage-chain root.
- **Schema:** `CanonicalResearchResultArtifact`.
- **Lifecycle:** completed, blocked, failed, cancelled, expired, or superseded.
- **Retention:** latest terminal result per retained job plus required ancestry.
- **Consumers:** projection, audit, historical request builder, compatibility.
- **Required edges:** validated and sealed stage-chain ancestry.
- **Restriction:** no result classification creates evidence/readiness.

### 4.5 `historical_validation_result`

- **Identity:** terminal historical validation artifact ID and complete
  manifest/profile/replay/OOS/robustness lineage.
- **Lifecycle:** completed, blocked, failed, cancelled, expired, superseded.
- **Retention:** retained when submitted to evidence intake or operator audit.
- **Consumers:** existing evidence intake as candidate, read-only UI, audit.
- **Required edges:** dataset, profile, replay, OOS, optional robustness,
  historical validation and seal.
- **Restriction:** candidate only; cannot write native evidence.

## 5. Derived Advisory Nodes

### 5.1 `memory_document`

- **Owner:** deterministic memory builder.
- **Identity:** document ID/content hash over ordered native evidence IDs,
  sanitizer, and schema.
- **Lifecycle:** built, queued, delivered, blocked, superseded, archived.
- **Retention:** derived/rebuildable; source evidence references retained.
- **Consumers:** GBrain delivery, audit, operator summary.
- **Required edges:** at least one native evidence source.
- **Restriction:** no raw candles or authoritative status.

### 5.2 `gbrain_receipt`

- **Owner:** optional GBrain sidecar adapter.
- **Identity:** existing receipt ID, memory document ID/hash, sidecar version,
  idempotency key.
- **Lifecycle:** delivered, duplicate, unavailable, blocked, superseded.
- **Retention:** derived/rebuildable.
- **Consumers:** memory search and audit.
- **Required edges:** exactly one memory document.
- **Restriction:** receipt does not prove evidence quality or readiness.

### 5.3 `advisory_review`

- **Owner:** advisory provider integration.
- **Identity:** review ID/hash plus cited result IDs and provider/prompt policy.
- **Lifecycle:** complete, unavailable, blocked, unsafe, superseded.
- **Retention:** bounded advisory.
- **Consumers:** operator and hypothesis builder.
- **Required edges:** cited memory/native/research references.
- **Restriction:** untrusted, advisory-only, no deterministic scoring.

### 5.4 `hypothesis`

- **Owner:** draft proposal subsystem.
- **Identity:** draft ID/content hash plus cited artifacts and schema.
- **Lifecycle:** draft, needs-human-review, admitted, dismissed, blocked,
  superseded.
- **Retention:** bounded audit when admitted or blocked for safety.
- **Consumers:** deterministic hypothesis admission.
- **Required edges:** cited advisory/native/research references.
- **Restriction:** `autoApplyAllowed: false`; cannot provide authoritative
  source, profile, threshold, evidence, readiness, or trade intent.

## 6. Operational Materialization Nodes

### 6.1 `checkpoint`

- **Owner:** B1 job engine.
- **Identity:** checkpoint projection version, logical job ID, and revision.
- **Authority:** non-authoritative rebuildable projection.
- **Lifecycle:** active, terminal, stale, discarded, rebuilt.
- **Retention:** operational/rebuildable.
- **Consumers:** recovery and operator status.
- **Source edges:** immutable request/stage/result artifacts.
- **Restriction:** checkpoint loss cannot alter immutable job history.

### 6.2 `operator_projection`

- **Owner:** B1 projection layer.
- **Identity:** projection version, terminal/current source artifact, revision.
- **Authority:** non-authoritative rebuildable read model.
- **Lifecycle:** current, stale, unavailable, rebuilt.
- **Retention:** operational/rebuildable.
- **Consumers:** Dashboard, Advisor, Results, diagnostics.
- **Source edges:** sealed B1 artifacts and compact runtime health.
- **Restriction:** cannot infer evidence/readiness or expose mutation controls.

Operational materializations are excluded from required deterministic ancestry
unless an audit explicitly asks which projection was shown at a historical
time.

## 7. Control And Retention Nodes

### 7.1 `quarantine_record`

- records offending node/edge key, observed/expected hashes, blocker, policy,
  timestamps, and resolution status;
- cannot alter the quarantined artifact;
- retained for the configured audit hold.

### 7.2 `tombstone`

- preserves compact identity, original hash/checksum, authority, retention
  decision, archive reference, and edge summaries;
- states explicitly that the hot payload is unavailable;
- cannot claim owner integrity without archive/owner verification.

### 7.3 `archive_manifest`

- lists archived node and edge keys;
- includes archive checksum, format/version, location class, and retention
  policy;
- contains no raw candles, secrets, or advisory bodies.

### 7.4 `compatibility_mapping`

- maps one legacy/external artifact to a B1 node reference;
- preserves both IDs and the compatibility-test/policy version;
- is one-way and cannot rewrite the legacy ID;
- may report exact, documented variance, incomplete, or blocked;
- cannot claim identity equality without exact owner-level proof.

## 8. Lifecycle Vocabulary

Node types use owner-specific statuses, but graph resolution normalizes to:

- `active`;
- `terminal`;
- `superseded`;
- `unresolved`;
- `blocked`;
- `quarantined`;
- `archived`;
- `tombstoned`;
- `rebuildable`;
- `unavailable`.

Normalization is a display/query classification. It never changes the owner
status.

## 9. Retention Roots

Potential retained roots:

- latest terminal B1 result for a retained logical job;
- historical validation submitted to evidence intake;
- native evidence reference selected by owner policy;
- quarantine record inside hold;
- admitted hypothesis and resulting request;
- archive manifest.

Advisory reviews, failed delivery attempts, checkpoints, and projections are
not permanent roots by default.

## 10. Node Admission

Admission must verify:

1. registered node type/class/owner;
2. owner adapter and schema compatibility;
3. canonical artifact ID;
4. owner payload hash/checksum when required;
5. source/time/profile identity where applicable;
6. authority and forbidden fields;
7. lifecycle and retention validity;
8. absence of raw/secret/account/order/position data;
9. required relationship cardinality before validation eligibility.

Unknown or ambiguous required fields block.

## 11. Node Consumer Matrix

| Node | Deterministic engine | Evidence intake | Memory | AI | Operator |
|---|---:|---:|---:|---:|---:|
| Verified close/window/context/configuration | yes | identity only | no | compact projection only | compact |
| B1 request/stage/result | yes | candidate result only | after native evidence | compact projection only | compact |
| Replay/OOS/robustness | historical validation | candidate only | after native evidence | compact projection only | compact |
| Native evidence | no detector input | owner-controlled | yes | sanitized summary | compact |
| Memory/GBrain | no | no | yes | yes, untrusted | compact |
| Advisory/hypothesis | admission only | no | optional | yes | yes |
| Checkpoint/projection | recovery/display | no | no | no authority | yes |
| Quarantine/tombstone/archive | integrity only | no | no | no | audit |

No consumer can increase node authority.

## 12. Final Rule

A node reference proves only that the graph recognizes an owner identity under
a specific adapter and integrity status. It does not prove strategy edge,
evidence acceptance, readiness, production suitability, or execution
permission.
