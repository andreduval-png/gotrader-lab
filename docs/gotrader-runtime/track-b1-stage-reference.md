# GoTrader Track B1 - Stage Reference

Status: normative planning reference; no runtime implementation

Specification ID: `gotrader-b1-stage-reference-v1`

Parent specification:
`track-b1-autonomous-research-pipeline-specification.md`

## 1. Common Stage Envelope

Every stage artifact MUST contain:

| Field | Requirement |
|---|---|
| `schemaVersion` | Exact version of the stage artifact schema |
| `stageName` | Registered stage identifier |
| `stageVersion` | Immutable implementation/policy version |
| `logicalJobId` | Canonical B1 logical job ID |
| `attemptId` | Unique operational attempt identity |
| `attemptNumber` | Positive bounded integer |
| `inputArtifactIds` | Ordered immutable inputs |
| `previousStageArtifactId` | Prior stage or genesis marker |
| `startedAt` / `completedAt` | UTC operational timestamps |
| `status` | Completed, blocked, failed, cancelled, or expired |
| `outputSummary` | Compact allowlisted result |
| `blockers` / `warnings` | Stable codes, bounded and deduplicated |
| `payloadHash` | Canonical artifact-core hash |
| `policyVersions` | Retry, timeout, source, context, and safety policy versions |
| `authority` | Exactly `none / none / none` |
| `capabilities` | All B1 authority capabilities false |

The stage envelope MUST exclude raw candles, OHLCV arrays, snapshots, secrets,
credentials, account data, order data, position data, screenshots, and mutable
broker commands.

## 2. Common Failure Rules

All stages use:

- `blocked` for deterministic safety, identity, eligibility, or completeness
  failures;
- `failed` for an internal service failure after bounded transient policy;
- `cancelled` when cancellation is observed before seal;
- `expired` when the job, lease, source, or context loses validity;
- `completed` for valid positive, negative, no-setup, and rejected research
  results.

Deterministic blockers do not retry. Optional advisory service failures do not
fail deterministic stages.

## 3. Current-Market Stage Map

| Order | Stage | Required | Default policy |
|---:|---|---|---|
| 1 | `job_admission` | yes | `live_admission_v1` |
| 2 | `input_verification` | yes | `live_admission_v1` |
| 3 | `context_rebuild` | yes | `live_context_v1` |
| 4 | `context_identity_verification` | yes | `live_context_v1` |
| 5 | `adapter_detection` | strategy jobs only | `live_adapter_v1` |
| 6 | `result_validation` | yes | `live_adapter_v1` |
| 7 | `result_seal` | yes | `artifact_seal_v1` |
| 8 | `projection_update` | yes | `artifact_seal_v1` |

## 4. `job_admission`

### Identity

- logical job ID;
- request payload hash;
- job schema and version;
- admission policy version.

### Inputs

- compact `CanonicalResearchJobRequest`;
- referenced verified close-event identity;
- registered job descriptor;
- current cancellation state.

### Allowed reads

- runtime task allowlist;
- close-event compact ledger;
- schema and policy registry;
- existing request/result identity index.

### Allowed writes

- immutable accepted request;
- idempotent duplicate receipt;
- conflict quarantine record;
- initial checkpoint.

### Forbidden reads

- candle arrays;
- browser state;
- GBrain narrative;
- readiness, Paper-Demo, account, order, or position state.

### Forbidden writes

- scheduler registry changes;
- evidence, readiness, profile, calibration, Paper-Demo, or execution state.

### Retry and timeout

- timeout: 2 seconds;
- retry: once for repository lock or atomic write contention;
- no retry for unregistered job, invalid schema, authority drift, or conflict.

### Failure policy

- same ID and same payload: coalesce;
- same ID and different payload: quarantine and block;
- unregistered job type: block;
- cancellation: cancel.

### Provenance

Preserve close-event ID, candle identity, source fingerprint, time-contract ID,
context reference, job descriptor version, and request payload hash.

### Consumers

`input_verification`, checkpoint reader, operator projection.

## 5. `input_verification`

### Identity

Stage artifact ID derived from job ID, request ID, stage version, and compact
verification result.

### Inputs

- accepted request;
- close-event compact record;
- source/time-contract status;
- required schema and policy registries.

### Allowed reads

- exact source identity;
- requested/broker symbol mapping;
- current-live eligibility;
- required fact/timeframe declarations;
- strategy/profile registry metadata.

### Allowed writes

- immutable verification artifact;
- checkpoint progress.

### Forbidden reads

- raw provider response;
- mutable browser active-source preference;
- memory or LLM output.

### Forbidden writes

Any domain result, evidence, readiness, or profile mutation.

### Retry and timeout

- timeout: 2 seconds;
- transport reads may retry once;
- deterministic mismatch does not retry.

### Failure policy

Block for source, time, schema, symbol, context reference, capability, or
authority mismatch.

### Provenance

Preserve every verified field and the artifact or registry version that proved
it.

### Consumers

`context_rebuild`.

## 6. `context_rebuild`

### Identity

Stage identity includes job ID, constituent window identities, context builder
version, requested fact families, and fact-policy versions.

### Inputs

- verified close event;
- canonical repository window references;
- bounded in-memory windows;
- accepted time and source identity;
- required fact/timeframe sets.

### Allowed reads

- canonical candle repository;
- Phase 2A context builder and policy registry;
- current-live bounded hydration artifact when eligible.

### Allowed writes

- immutable compact context rebuild summary;
- in-memory typed context for the immediate stage chain;
- checkpoint progress.

### Forbidden reads

- GBrain memory;
- LLM output;
- readiness or account state;
- a source not named by the job.

### Forbidden writes

- candle arrays or full fact graph to B1 persistence;
- evidence, readiness, profile, calibration, or trade state.

### Retry and timeout

- timeout: 5 seconds;
- one retry for transient repository/transport failure;
- no retry for missing facts, stale source, or time ineligibility.

### Failure policy

Block for lookahead, future/partial candle, missing timeframe, mixed source,
unverified time, or context build ambiguity.

### Provenance

Preserve window IDs, first/last times, counts, source fingerprint, time
normalization, fact-policy versions, and generated context artifact ID.

### Consumers

`context_identity_verification`.

## 7. `context_identity_verification`

### Identity

Stage identity includes expected and rebuilt context artifact IDs plus the
comparison policy version.

### Inputs

- expected context ID from the job;
- rebuilt canonical context ID;
- compact context identity fields;
- required fact/timeframe coverage.

### Allowed reads

- context identity and compact diagnostics only.

### Allowed writes

- immutable exact-match or blocker artifact;
- checkpoint progress.

### Forbidden reads

- raw candles or narrative text.

### Forbidden writes

- corrected or substituted context;
- favorable fallback identity.

### Retry and timeout

- timeout: 5 seconds;
- no retry for mismatch;
- one retry only if the referenced immutable context read was transiently
  unavailable.

### Failure policy

Any mismatch in source, windows, time contract, policy, required facts, schema,
or authority blocks.

### Provenance

Preserve expected and observed IDs and exact mismatch codes.

### Consumers

`adapter_detection` for strategy jobs or `result_validation` for
context-lineage jobs.

## 8. `adapter_detection`

### Identity

Stage identity includes context ID, strategy/profile/version, parameter hash,
adapter version, and cost-model ID when relevant.

### Inputs

- verified typed canonical context in memory;
- frozen allowlisted strategy profile;
- bounded referenced windows only when required by the frozen adapter contract.

### Allowed reads

- registered strategy adapter;
- immutable profile and parameters;
- exact job context;
- strategy-local causal window references.

### Allowed writes

- immutable compact detected, rejected, blocked, expired, or no-setup result;
- detector diagnostics;
- checkpoint progress.

### Forbidden reads

- GBrain memory or AI output;
- readiness, Paper-Demo, broker, account, order, or position state;
- mutable calibration;
- a different source or context.

### Forbidden writes

- evidence;
- readiness;
- profile or parameter mutation;
- Paper-Demo or execution intent;
- raw candle persistence.

### Retry and timeout

- timeout: 5 seconds;
- one retry for transient module/repository failure;
- no retry for deterministic detector result.

### Failure policy

No setup and deterministic rejection complete successfully. Missing required
facts, unsupported profile, context drift, or authority drift block.

### Provenance

Preserve context ID, adapter/profile/version, parameter and cost identity,
causal timestamps, compact geometry, and detector blocker codes.

### Consumers

`result_validation`, future compatibility projections.

## 9. `result_validation`

### Identity

Stage identity includes candidate result ID and result-validation policy
version.

### Inputs

- context-lineage or strategy result;
- job request;
- prior-stage hash chain;
- authority and capability policy.

### Allowed reads

- compact stage artifacts;
- result schema;
- lineage and safety policies.

### Allowed writes

- immutable validation artifact;
- checkpoint progress.

### Forbidden reads

- raw candles;
- LLM or memory narrative;
- external mutable status.

### Forbidden writes

- corrected strategy result;
- evidence, readiness, production, or execution state.

### Retry and timeout

- timeout: 5 seconds;
- no retry for schema, lineage, payload, or authority mismatch.

### Failure policy

Block for missing lineage, unsupported classification, invalid causal ordering,
raw-data leakage, authority drift, or capability drift.

### Provenance

Preserve all validated artifact IDs, policy version, blocker codes, and
validation payload hash.

### Consumers

`result_seal`.

## 10. `result_seal`

### Identity

Final result artifact ID and complete stage-chain root.

### Inputs

- validated result;
- current checkpoint;
- active lease;
- current cancellation and supersession state.

### Allowed reads

- immutable stage chain;
- lease record;
- cancellation/supersession record;
- integrity policy.

### Allowed writes

- one immutable terminal result;
- terminal checkpoint;
- relationship entries.

### Forbidden reads

- unrelated jobs or browser state.

### Forbidden writes

- overwrite of a sealed result;
- evidence, readiness, production, Paper-Demo, or execution state.

### Retry and timeout

- timeout: 2 seconds;
- one retry for atomic rename contention;
- stale lease and cancellation never retry to a seal.

### Failure policy

- cancelled: terminal cancelled;
- stale/foreign lease: expired or blocked;
- same result hash: idempotent success;
- different result for same terminal identity: quarantine and block.

### Provenance

Seal the full ordered stage chain, job ID, result ID, payload hash, and
relationship IDs.

### Consumers

`projection_update`, audit reader, future historical/compatibility adapters.

## 11. `projection_update`

### Identity

Projection version plus terminal result ID.

### Inputs

- sealed result;
- terminal checkpoint;
- compact runtime health.

### Allowed reads

- sealed B1 artifacts only.

### Allowed writes

- rebuildable compact operator projection.

### Forbidden reads

- raw candles;
- GBrain narrative;
- account/order/position state.

### Forbidden writes

- evidence, readiness, profile, calibration, Paper-Demo, or execution state.

### Retry and timeout

- timeout: 2 seconds;
- one retry for projection write contention;
- loss of a projection is recoverable from sealed artifacts.

### Failure policy

Projection failure warns or degrades display. It cannot invalidate a sealed
research result.

### Provenance

Reference the sealed result and terminal checkpoint IDs.

### Consumers

Dashboard, Advisor, Results, runtime status, compatibility readers.

## 12. Historical Stage Map

Historical stages are future B1.4 work and remain disabled.

| Stage | Purpose | Default policy |
|---|---|---|
| `dataset_manifest_verification` | Verify immutable data/source/time identity | `historical_manifest_v1` |
| `historical_profile_admission` | Freeze profile, parameters, costs, and windows | `historical_manifest_v1` |
| `replay_run` | Run existing replay semantics through an adapter | `historical_replay_v1` |
| `walk_forward_oos_run` | Run existing frozen chronological validation | `historical_walk_forward_v1` |
| `monte_carlo_run` | Run existing deterministic robustness analysis | `historical_monte_carlo_v1` |
| `historical_result_validation` | Verify exact identity and stage linkage | `artifact_seal_v1` |
| `historical_result_seal` | Seal compact validation artifacts | `artifact_seal_v1` |

### Historical restrictions

- explicit request only;
- no page-load trigger;
- no current-live proof substituted for historical verification;
- process-local candles only;
- no baseline metric rewrite;
- no evidence or readiness write;
- no strategy threshold tuning inside the job;
- no automatic retry of completed expensive stages;
- checkpoints resume from immutable stage outputs.

### `dataset_manifest_verification`

- **Identity:** dataset manifest ID, dataset checksum, source fingerprint,
  requested/broker symbols, timeframe set, time-normalization policy, and
  verifier version.
- **Inputs:** explicit historical request, compact immutable manifest, bounded
  process-local dataset handle, and historical provider-time contract.
- **Outputs:** immutable verified-manifest artifact or exact blocker artifact.
- **Allowed reads:** manifest metadata, dataset boundaries/count/checksum,
  provider-time and DST policy, source registry, and closed-candle geometry
  validator.
- **Allowed writes:** stage artifact and checkpoint progress only.
- **Forbidden reads:** GBrain/AI output, browser source preference, readiness,
  account, order, or position state.
- **Forbidden writes:** raw candles, evidence, readiness, profile, calibration,
  Paper-Demo, production, or execution state.
- **Retry/timeout:** 30 seconds, no automatic retry.
- **Failure policy:** identity, time-basis, DST, source, duplicate, candle-close,
  checksum, or authority ambiguity blocks; internal verifier failure fails.
- **Provenance:** preserve dataset ID/checksum, boundaries/counts, source/time
  identity, and verifier-policy version.
- **Consumers:** `historical_profile_admission` and audit readers.

### `historical_profile_admission`

- **Identity:** verified dataset ID, strategy/profile/version, parameter hash,
  cost model, split plan, required windows, and admission-policy version.
- **Inputs:** verified manifest artifact and one explicit frozen research
  request.
- **Outputs:** immutable admitted-profile artifact or exact blocker artifact.
- **Allowed reads:** static strategy registry, frozen profile, parameter
  registry, cost-model registry, and validation split policy.
- **Allowed writes:** stage artifact and checkpoint progress only.
- **Forbidden reads:** mutable calibration, GBrain/AI narrative, current
  readiness, or a dataset other than the verified manifest.
- **Forbidden writes:** strategy/profile mutation, evidence, readiness,
  Paper-Demo, production, or execution state.
- **Retry/timeout:** 30 seconds, no automatic retry.
- **Failure policy:** unsupported profile, drifted hash, incompatible cost
  model, invalid split, insufficient boundaries, or authority drift blocks.
- **Provenance:** preserve the exact dataset/profile/parameter/cost/split
  identities.
- **Consumers:** `replay_run`.

### `replay_run`

- **Identity:** admitted profile artifact, dataset ID, replay adapter/version,
  causal policy, and cost model.
- **Inputs:** process-local immutable dataset handle and admitted profile.
- **Outputs:** compact replay result with outcome counts, causal candidate
  identities, metrics, blockers, and result hash.
- **Allowed reads:** verified process-local candles and the existing
  deterministic replay engine through a compatibility adapter.
- **Allowed writes:** replay stage artifact and checkpoint progress only.
- **Forbidden reads:** live mutable context, memory/AI output, readiness, or a
  different profile/dataset/cost model.
- **Forbidden writes:** candle arrays, baseline rewrites, evidence, readiness,
  calibration, Paper-Demo, production, or execution state.
- **Retry/timeout:** 15 minutes, no automatic retry; restart resumes from the
  prior immutable stage, not partial replay output.
- **Failure policy:** lookahead, source/time/profile drift, invalid geometry, or
  causal ambiguity blocks; internal adapter failure fails.
- **Provenance:** preserve dataset, profile, parameter, cost, candidate,
  boundary, replay-version, and metrics identities.
- **Consumers:** `walk_forward_oos_run`, historical result validation,
  and read-only compatibility views.

### `walk_forward_oos_run`

- **Identity:** replay artifact ID, frozen split plan, walk-forward/OOS engine
  version, profile identity, and cost model.
- **Inputs:** verified replay artifact, immutable dataset handle, and admitted
  chronological split plan.
- **Outputs:** compact per-window results, OOS aggregate, confidence metrics,
  blockers, and result hash.
- **Allowed reads:** process-local dataset, replay candidate identities, and
  existing deterministic walk-forward/OOS engine.
- **Allowed writes:** walk-forward/OOS stage artifact and checkpoint progress.
- **Forbidden reads:** future-window data during a training/evaluation step,
  memory/AI narrative, mutable tuning, or readiness state.
- **Forbidden writes:** candle arrays, replay baseline changes, evidence,
  readiness, calibration, Paper-Demo, production, or execution state.
- **Retry/timeout:** 30 minutes, no automatic retry; completed immutable windows
  may be reused only when their exact identity matches.
- **Failure policy:** chronological leakage, split/profile/cost drift,
  insufficient samples, or identity mismatch blocks; an honest negative OOS
  outcome completes.
- **Provenance:** preserve parent replay, dataset, ordered windows, train/test
  boundaries, profile/cost, engine version, and metrics IDs.
- **Consumers:** `monte_carlo_run`, historical result validation, and
  read-only compatibility views.

### `monte_carlo_run`

- **Identity:** eligible outcome-set ID, simulation policy/version, deterministic
  seed policy, run count, and cost model.
- **Inputs:** identity-matched completed replay/OOS outcomes and one allowlisted
  Monte Carlo policy.
- **Outputs:** compact robustness, ending-R, drawdown, loss-streak, risk-of-ruin,
  sample-sufficiency, blocker, and result-hash summary.
- **Allowed reads:** compact validated outcome records; no market provider.
- **Allowed writes:** Monte Carlo stage artifact and checkpoint progress.
- **Forbidden reads:** raw candles, memory/AI output, account equity, readiness,
  or mutable risk/execution settings.
- **Forbidden writes:** evidence, readiness, risk-policy mutation, Paper-Demo,
  production, or execution state.
- **Retry/timeout:** 15 minutes, no automatic retry.
- **Failure policy:** insufficient or identity-mismatched outcomes block;
  negative robustness completes honestly; internal simulation failure fails.
- **Provenance:** preserve outcome-set, replay/OOS parents, policy, seed, run
  count, cost model, and metrics identities.
- **Consumers:** historical result validation and read-only compatibility views.

### `historical_result_validation`

- **Identity:** ordered historical stage IDs and historical validation-policy
  version.
- **Inputs:** manifest, admission, replay, walk-forward/OOS, optional Monte
  Carlo, and their complete hash chain.
- **Outputs:** immutable exact-match validation or blocker artifact.
- **Allowed reads:** compact historical artifacts, schemas, lineage, safety,
  and compatibility policies.
- **Allowed writes:** validation stage artifact and checkpoint progress.
- **Forbidden reads:** raw candles, memory/AI narrative, mutable external status,
  or favorable replacement artifacts.
- **Forbidden writes:** corrected metrics, evidence, readiness, calibration,
  profile, Paper-Demo, production, or execution state.
- **Retry/timeout:** 2 seconds under `artifact_seal_v1`; no deterministic retry.
- **Failure policy:** any source/time/profile/parameter/cost/split/lineage,
  schema, raw-data, capability, or authority conflict blocks.
- **Provenance:** preserve every validated parent and exact policy/result hashes.
- **Consumers:** `historical_result_seal`.

### `historical_result_seal`

- **Identity:** validated historical result core and complete stage-chain root.
- **Inputs:** validated historical artifact, active lease, checkpoint,
  cancellation state, and integrity policy.
- **Outputs:** one immutable terminal result, relationships, and terminal
  checkpoint.
- **Allowed reads:** immutable stage chain and lease/cancellation state.
- **Allowed writes:** terminal historical result, relationship entries, and
  terminal checkpoint.
- **Forbidden reads:** unrelated jobs, browser state, memory, or provider data.
- **Forbidden writes:** overwrite, evidence, readiness, calibration, profile,
  Paper-Demo, production, or execution state.
- **Retry/timeout:** 2 seconds; one atomic-rename retry only.
- **Failure policy:** stale lease/cancellation cannot seal; identical result is
  idempotent; conflicting terminal payload quarantines and blocks.
- **Provenance:** seal the ordered historical lineage and all identity hashes.
- **Consumers:** existing evidence intake gate as a candidate input, read-only
  views, memory builder only after native evidence exists, and audit readers.

## 13. Memory And Advisory Stages

Memory stages are downstream projections and cannot affect deterministic
current-market results.

| Stage | AI allowed | Required behavior |
|---|---|---|
| `native_evidence_read` | no | Read committed native evidence through its API |
| `memory_document_build` | no | Build sanitized deterministic document |
| `memory_sidecar_delivery` | no | Optional loopback, bounded, idempotent |
| `memory_search` | no | Bounded exact-filter/keyword retrieval |
| `memory_advisory_review` | yes | Treat retrieved content as untrusted |
| `hypothesis_draft` | yes | Produce draft-only proposal |
| `hypothesis_admission` | no | Reconstruct and validate allowlisted request |

Memory delivery uses an 8-second default timeout and no automatic stage retry.
The durable outbox may retry later under its own bounded policy. Sidecar
unavailability never changes deterministic research status.

### `native_evidence_read`

- **Identity:** native evidence record IDs, read-contract version, exact
  allowlisted filters, and query hash.
- **Inputs:** explicit memory-build request or bounded backfill cursor.
- **Outputs:** compact ordered evidence references and sanitized fields.
- **Allowed reads:** committed native evidence through its owned read API.
- **Allowed writes:** read receipt or memory-builder input artifact only.
- **Forbidden reads:** native storage internals, raw candles, browser state,
  account/order/position data, or rejected/uncommitted candidate artifacts.
- **Forbidden writes:** native evidence, readiness, calibration, or any source
  record.
- **Retry/timeout:** bounded local-read policy; exact values require a versioned
  B1.6 descriptor.
- **Failure policy:** unknown schema, missing authoritative record, cursor drift,
  or integrity failure blocks; no synthetic replacement.
- **Provenance:** preserve evidence IDs, native ledger version, filter hash, and
  read receipt.
- **Consumers:** `memory_document_build`.

### `memory_document_build`

- **Identity:** ordered native evidence IDs, document schema/version, sanitizer
  version, and content hash.
- **Inputs:** compact authoritative evidence references and allowlisted fields.
- **Outputs:** sanitized bounded Markdown/document artifact and outbox entry.
- **Allowed reads:** exact evidence records named by the read artifact.
- **Allowed writes:** derived memory document, delivery outbox, and receipt
  metadata.
- **Forbidden reads:** raw candles, screenshots/base64, secrets, account/order/
  position data, or unrelated evidence.
- **Forbidden writes:** native evidence, readiness, calibration, profile,
  Paper-Demo, production, or execution state.
- **Retry/timeout:** deterministic build has no retry; atomic outbox write may
  retry once.
- **Failure policy:** sanitizer, size, schema, or identity failure blocks the
  memory copy without changing native evidence.
- **Provenance:** preserve every source evidence ID and sanitizer/document
  version.
- **Consumers:** `memory_sidecar_delivery`, audit, and bounded operator summary.

### `memory_sidecar_delivery`

- **Identity:** memory document ID/content hash, sidecar contract version, and
  idempotency key.
- **Inputs:** one sanitized outbox document and loopback sidecar configuration.
- **Outputs:** delivery receipt, duplicate receipt, or compact unavailable/
  blocked status.
- **Allowed reads:** sanitized outbox document and non-secret loopback status.
- **Allowed writes:** derived sidecar index plus GoTrader delivery receipt.
- **Forbidden reads:** native evidence storage, raw market data, browser state,
  secrets, or broker state.
- **Forbidden writes:** GoTrader evidence/readiness/calibration/profile state or
  arbitrary filesystem/database locations.
- **Retry/timeout:** 8 seconds, no inline retry; durable outbox may schedule a
  bounded later attempt.
- **Failure policy:** unavailable sidecar degrades memory only; identity/content
  conflict quarantines; deterministic research remains unchanged.
- **Provenance:** preserve document ID/hash, receipt ID, sidecar version, and
  attempt telemetry.
- **Consumers:** `memory_search`, sidecar status, and audit.

### `memory_search`

- **Identity:** normalized bounded query, exact filters, query-policy version,
  result limit, and query hash.
- **Inputs:** explicit operator/advisory query through the read-only MCP facade.
- **Outputs:** bounded cited summaries marked untrusted and advisory.
- **Allowed reads:** derived memory index and delivery receipts.
- **Allowed writes:** bounded query audit only.
- **Forbidden reads:** native evidence internals, raw candles, secrets, account/
  order/position data, or arbitrary SQL/filesystem/command surfaces.
- **Forbidden writes:** sidecar content, native evidence, readiness,
  calibration, profile, Paper-Demo, production, or execution state.
- **Retry/timeout:** one bounded MCP read under a versioned descriptor; no hidden
  broad retry.
- **Failure policy:** unavailable sidecar returns memory unavailable; malformed
  or unsafe query blocks; no deterministic stage is affected.
- **Provenance:** preserve query hash, exact filters, cited document/evidence
  references, and sidecar contract version.
- **Consumers:** `memory_advisory_review` and operator read-only views.

### `memory_advisory_review`

- **Identity:** cited memory-result IDs, advisory provider/model/prompt policy,
  compact deterministic context IDs, and review-request hash.
- **Inputs:** bounded untrusted memory summaries plus compact deterministic
  research projections.
- **Outputs:** advisory explanation, questions, gaps, or hypothesis suggestions.
- **Allowed reads:** only the sanitized inputs named by the request.
- **Allowed writes:** advisory review artifact; no authoritative artifact.
- **Forbidden reads:** raw candles, direct MT5/broker tools, secrets, account/
  order/position state, or uncited storage.
- **Forbidden writes:** canonical facts, detector results, evidence, readiness,
  calibration, profiles, Paper-Demo, production, or execution state.
- **Retry/timeout:** provider timeout is versioned and bounded; retry must not
  duplicate a proposal or block deterministic research.
- **Failure policy:** unavailable, malformed, uncited, or unsafe response is
  unavailable/blocked advisory output only.
- **Provenance:** preserve cited source IDs, provider/prompt policy, response
  hash, and safety-validation result.
- **Consumers:** operator and `hypothesis_draft`.

### `hypothesis_draft`

- **Identity:** advisory review ID, cited artifact IDs, draft schema/version, and
  draft content hash.
- **Inputs:** one safe advisory review and allowlisted proposal-intent schema.
- **Outputs:** draft-only hypothesis with `autoApplyAllowed: false` and authority
  `none / none / none`.
- **Allowed reads:** cited advisory and compact deterministic summaries.
- **Allowed writes:** draft proposal storage only.
- **Forbidden reads:** raw market/provider data, broker/account/order/position
  state, mutable profile internals, or secrets.
- **Forbidden writes:** accepted job, evidence, readiness, calibration, profile,
  Paper-Demo, production, trade intent, or execution state.
- **Retry/timeout:** no automatic retry; duplicate content coalesces by identity.
- **Failure policy:** forbidden field, unsupported family, missing citation,
  authority drift, or unsafe language blocks the draft.
- **Provenance:** preserve review, citation, proposal-family, schema, and safety
  audit IDs.
- **Consumers:** operator review and `hypothesis_admission`.

### `hypothesis_admission`

- **Identity:** draft ID, reconstructed deterministic request core, admission
  policy, and resulting logical job ID.
- **Inputs:** safe draft plus explicit operator or allowlisted scheduler request.
- **Outputs:** accepted explicit research request, exact blocker, or needs-human-
  review status.
- **Allowed reads:** draft, static job/strategy registries, and current
  GoTrader-owned source/profile policy.
- **Allowed writes:** a new B1 research request through `job_admission` only.
- **Forbidden reads:** AI-supplied source fingerprints as authority, raw candles,
  readiness, account/order/position state, or memory as detector input.
- **Forbidden writes:** evidence, readiness, calibration, profile, Paper-Demo,
  production, trade intent, or execution state.
- **Retry/timeout:** admission uses `live_admission_v1` or the explicit
  historical admission policy; deterministic blockers do not retry.
- **Failure policy:** GoTrader reconstructs authoritative identity fields;
  mismatch, missing explicit authorization, unsupported family, stale context,
  or authority drift blocks.
- **Provenance:** preserve draft ID, citations, reconstructed fields, operator/
  scheduler request ID, admission policy, and accepted request ID when present.
- **Consumers:** `job_admission` only.

## 14. Stage Registration Rules

A future stage registry MUST:

- be a static versioned allowlist;
- bind each stage to input/output schemas and policy versions;
- define resource and timeout limits;
- define whether the stage is available in fixture, current-live, or historical
  lanes;
- reject runtime registration from AI, settings, stored proposals, or memory;
- preserve authority `none / none / none`;
- require focused tests before a descriptor can be enabled.

The registry MUST NOT include execution, account, order, position, readiness
promotion, evidence creation, calibration apply, or profile mutation stages.

## 15. Consumer Reference

| Artifact | Permitted consumers |
|---|---|
| Accepted request | B1 stage engine and audit reader |
| Verification artifact | Next deterministic stage and audit reader |
| Context rebuild summary | Context identity verifier and audit reader |
| Typed context in memory | Immediate allowlisted adapter only |
| Strategy result | Result validator and compatibility readers |
| Sealed result | Projection builder, historical request builder, audit |
| Historical validation result | Existing evidence intake gate, read-only UI |
| Native evidence | Existing evidence/readiness systems and memory builder |
| GBrain summary | Advisory agents and operator only |
| AI hypothesis | Deterministic admission validator only |

No consumer can broaden the authority of its input.
