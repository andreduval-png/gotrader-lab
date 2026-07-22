# GoTrader V2 Architecture Specification - Revision 1

## 1. Status and purpose

This is the standalone governing specification for the GoTrader V2 research migration.
It incorporates the repository audit, verification report, and approved Phase 0.5
amendments. The current repository remains the behavioral source of truth.

V2 is an incremental compatibility migration. It is not a rewrite, an execution
project, or permission to alter validated strategies. Existing detectors, replay
behavior, walk-forward evidence, readiness gates, source identity, and safety
contracts remain authoritative until a profile-specific parity review explicitly
promotes a V2 adapter.

### 1.1 Non-negotiable authority

```ts
type GoTraderAuthority = {
  executionAuthority: "none";
  brokerAuthority: "none";
  readinessOverrideAuthority: "none";
};
```

V2 does not add broker execution, account access, order access, position access,
readiness promotion, or calibration auto-apply. OpenClaw and other language-model
providers remain advisory and draft-proposal only.

### 1.2 Migration principles

1. Preserve behavior before extracting architecture.
2. Add facades and compatibility adapters before replacing implementations.
3. Run old and new paths in shadow mode before selecting a new authority.
4. Migrate one profile and one subsystem at a time.
5. Treat identity and lineage as part of every result.
6. Keep raw candles internal and bounded.
7. Fail closed when source, timing, geometry, evidence, or authority is ambiguous.
8. Require deterministic tests, negative controls, and rollback for every promotion.

## 2. Current boundary

GoTrader is a deterministic, MT5-first research terminal. It currently combines:

- canonical candle-source management;
- MT5 read-only latest and explicit historical reads;
- MT5 push-feed market-data transport;
- ICT context, setup detection, trade construction, replay, and walk-forward;
- evidence, maturity, readiness, decision log, committee, and paper-demo operations;
- autonomous research and self-improvement proposal flows;
- OpenClaw advisory contracts and compact research memory.

These existing systems remain in place throughout migration. V2 introduces
read-only contracts and shadow outputs first. No V2 output may create readiness,
evidence, paper-demo eligibility, or execution authority until its migration gate
for that exact profile and subsystem has passed.

## 3. Target architecture

### 3.1 Canonical Candle Repository facade

The repository is a read-only facade over existing candle sources. It does not own
broker connectivity or replace the current source manager during early phases.

Responsibilities:

- accept a source identity, requested symbol, broker symbol, timeframe, and window;
- return ascending, deduplicated, validated canonical candles;
- preserve provider time and receive time;
- expose explicit completeness and quality diagnostics;
- preserve the current source-fingerprint algorithm behind a compatibility adapter;
- reject silent mock or imported fallback;
- keep candle arrays out of UI, localStorage, journals, LLM packets, and artifacts.

```ts
interface CanonicalCandleQuery {
  sourceIdentity: SourceIdentity;
  requestedSymbol: string;
  brokerSymbol: string;
  timeframe: string;
  start?: string;
  end?: string;
  limit?: number;
  closedOnly: boolean;
}

interface CanonicalCandleWindow {
  identity: MarketDataIdentity;
  candles: readonly CanonicalCandle[];
  diagnostics: DataQualityDiagnostics;
  authority: GoTraderAuthority;
}
```

Historical 90-day requests remain explicit CLI/manual operations. Dashboard and
Advisor loads must not automatically request deep history.

### 3.2 Canonical Market Context Engine

The context engine consumes canonical candles and emits immutable typed facts. It
does not emit trade candidates. Initial shadow primitives are:

- session boundaries and session highs/lows;
- MT5-derived Sunday Open and 12AM Open;
- dealing ranges and premium/discount/equilibrium;
- liquidity pools and sweeps;
- displacement;
- FVG, IFVG, breaker, and order-block facts;
- higher-timeframe directional context.

All facts are causal. A fact may only use candles closed at or before its
`observedMarketTime`. The engine must expose missing timeframes and quality limits
instead of inventing context.

### 3.3 Canonical Market State

```ts
interface CanonicalMarketState {
  identity: MarketDataIdentity;
  facts: readonly MarketFact[];
  diagnostics: DataQualityDiagnostics;
  contextSchemaVersion: string;
  builtAt: string;
  authority: GoTraderAuthority;
}
```

Canonical Market State is an immutable research input. It contains references and
compact facts, not mutable detector state, replay outcomes, readiness, or broker
state.

### 3.4 Existing Strategy Library extension

V2 extends the current Strategy Library. It does not create a parallel registry.
Each definition gains migration metadata:

- adapter ID and version;
- detector version;
- parameter fingerprint;
- required facts and timeframes;
- trade-construction policy version;
- evidence-family ID;
- migration mode;
- positive/negative fixture references;
- current legacy implementation reference.

Placeholders remain non-executable. Diagnostics remain geometry-free and cannot
create validation-chain entries or evidence.

### 3.5 Strategy adapters

An adapter translates Canonical Market State into the exact input expected by an
existing detector, or translates a legacy result into V2 contracts. It must not
change thresholds, add inferred evidence, or repair missing geometry.

```ts
interface StrategyAdapter {
  adapterId: string;
  strategyId: string;
  detectorVersion: string;
  detect(input: CanonicalMarketState): DetectionFlowArtifact;
}
```

IFVG v3 is the positive canary. IFVG v2 is the negative control. A successful
migration must preserve both outcomes, not merely improve the positive case.

## 4. Separate state machines

Detection state and research maturity are independent. One must never be inferred
from the other.

### 4.1 Detection Flow

```text
DetectionFlowState
  insufficient_data
  observing
  forming
  triggered
  confirmed
  trade_plan_constructed
  rejected
  expired
```

- `insufficient_data`: required source/timeframe input is unavailable.
- `observing`: valid context exists but no setup is forming.
- `forming`: setup structure exists without complete confirmation.
- `triggered`: detector trigger occurred on closed-candle information.
- `confirmed`: all detector confirmations are present.
- `trade_plan_constructed`: valid entry, invalidation, target, and RR exist.
- `rejected`: a candidate failed a deterministic rule.
- `expired`: a previously forming/triggered state exceeded its validity window.

Only `trade_plan_constructed` may enter replay validation. Detection never grants
research maturity or execution authority.

### 4.2 Research Lifecycle

```text
ResearchLifecycleState
  registered
  replay_required
  walk_forward_required
  evidence_building
  research_validated
  paper_watchlist
  frozen
  retired
```

- `registered`: cataloged with versioned identity.
- `replay_required`: valid detection behavior needs replay outcomes.
- `walk_forward_required`: replay passed its profile-specific gate.
- `evidence_building`: independent/OOS evidence is accumulating.
- `research_validated`: deterministic research gates passed.
- `paper_watchlist`: eligible only for existing manual paper-only workflows.
- `frozen`: parameters are immutable; changes require a new version.
- `retired`: blocked from current candidate generation.

No lifecycle state implies broker access. Paper watchlist is not Paper-Demo
eligibility, and Paper-Demo eligibility is not execution readiness.

## 5. Detection and research flows

### 5.1 Detection Flow

```text
Canonical Candle Repository
  -> Canonical Market Context
  -> Strategy Adapter
  -> Detection Flow Artifact
  -> Trade Construction
  -> Geometry Validation
  -> Current Opportunity projection
```

The live flow is bounded, closed-candle causal, and current-state oriented.

### 5.2 Research Lifecycle

```text
Registered profile
  -> replay
  -> chronological walk-forward/OOS
  -> evidence quality
  -> maturity
  -> research committee
  -> Paper-Demo checklist
```

Research artifacts must reference the exact detector, parameters, source, context,
window, cost, and risk policy that produced them. Results from a different identity
may be displayed as comparison but cannot satisfy a gate.

## 6. Identity, lineage, and hashing

### 6.1 Market-data identity

```ts
interface SourceIdentity {
  provider: string;
  requestedSymbol: string;
  brokerSymbol: string;
  sourceFingerprint: string;
  sourceKind: "mt5_read_only" | "imported_historical" | "replay_snapshot" | "mock_sample";
  marketDataAccess: "read_only";
}

interface MarketDataIdentity {
  source: SourceIdentity;
  timeframeFingerprints: Readonly<Record<string, string>>;
  dataWindowStart: string;
  dataWindowEnd: string;
  lastClosedCandle: string;
  candleCountByTimeframe: Readonly<Record<string, number>>;
  sessionCalendarVersion: string;
  timezoneVersion: string;
}
```

The timeframe map must be serialized in sorted timeframe order. Fingerprints must
be stable for equivalent inputs and must change when source, symbol, timeframe,
window, or candle content changes according to the current compatibility policy.

### 6.2 Research artifact identity

Every replay, walk-forward, evidence, maturity, proposal, and decision artifact
must include:

- context schema version;
- strategy ID and detector version;
- adapter version;
- trade-construction policy version;
- parameter fingerprint;
- cost-model version;
- risk-policy version;
- session-calendar/timezone version;
- source identity and sorted timeframe fingerprints;
- data-window boundaries;
- parent artifact IDs;
- declared derivation relationship;
- canonical serialization and hash version.

### 6.3 Derivation relationships

Allowed relationships are typed:

```ts
type ArtifactDerivation =
  | { kind: "detected_from_context"; contextArtifactId: string }
  | { kind: "constructed_from_detection"; detectionArtifactId: string }
  | { kind: "replayed_from_trade_plan"; tradePlanArtifactId: string }
  | { kind: "walk_forward_from_replay"; replayArtifactId: string }
  | { kind: "evidence_from_validation"; validationArtifactIds: string[] }
  | { kind: "projection_from_artifacts"; artifactIds: string[] };
```

Free-form lineage text may supplement but never replace typed lineage.

### 6.4 Canonical serialization

Canonical serialization must:

- sort object keys recursively;
- sort identity maps by normalized key;
- preserve ordered market series where order is semantic;
- remove run-local IDs and wall-clock processing timestamps from golden comparisons;
- retain observed market times, boundaries, prices, blockers, and authority;
- declare a schema/hash version;
- never include secrets, account/order/position data, screenshots/base64, or raw candle arrays.

## 7. Fact contracts

Facts use discriminated payloads rather than unrestricted strings or generic
payload objects.

```ts
type MarketFact =
  | SessionFact
  | OpeningPriceFact
  | DealingRangeFact
  | LiquidityFact
  | SweepFact
  | DisplacementFact
  | FairValueGapFact
  | OrderBlockFact
  | HigherTimeframeBiasFact;

interface FactEnvelope<TKind extends string, TPayload> {
  factId: string;
  kind: TKind;
  identityRef: string;
  payload: TPayload;
  observedMarketTime: string;
  providerTime?: string;
  receivedAt: string;
  validFrom: string;
  expiresAt?: string;
  supersedesFactId?: string;
  quality: FactQuality;
  causalClosedCandleTime: string;
}
```

Facts reference context/source identity rather than duplicating the entire source
object. Quality includes completeness, freshness, timeframe availability, derivation
method, and warnings. Provider time, receive time, observed market time, validity,
expiry, and supersession have separate meanings and must not be collapsed.

## 8. Conflict and confluence resolution

Three concerns remain separate:

1. **Current thesis resolution** combines independent live market facts and active
   detector outputs.
2. **Historical model-evidence constraints** cap or block a profile based on replay,
   OOS, false-positive, drawdown, and maturity evidence.
3. **Scenario/model risk constraints** reject fragile geometry or excessive
   structural risk.

Historical win rate, replay outcomes, or model maturity may not count as an extra
bullish or bearish market confirmation. Correlated signals from the same evidence
family count once unless an explicit independence policy proves otherwise.

```ts
interface ResolutionArtifact {
  currentThesis: "long" | "short" | "flat";
  contributingFactIds: string[];
  supportingDetectionIds: string[];
  contradictions: TypedContradiction[];
  evidenceConstraints: EvidenceConstraint[];
  riskConstraints: RiskConstraint[];
  result: "eligible_for_trade_construction" | "forming" | "rejected" | "no_trade";
  authority: GoTraderAuthority;
}
```

## 9. Trade construction and geometry

Trade construction consumes a confirmed detection and structural facts. It emits
research geometry only.

```ts
interface ResearchTradePlan {
  side: "long" | "short";
  entry: number;
  invalidation: number;
  target: number;
  theoreticalRr: number;
  realizableRr?: number;
  entryModel: string;
  invalidationModel: string;
  targetModel: string;
  sourceFactIds: string[];
  warnings: string[];
  researchOnly: true;
  authority: GoTraderAuthority;
}
```

Geometry validation checks finite values, correct price ordering, nonzero risk,
target direction, minimum profile RR, source/time identity, and staleness. Missing
entry/stop/target/RR is valid only for forming or rejected trade candidates.
Diagnostic/context outputs bypass trade construction entirely.

## 10. Risk architecture

### 10.1 Instrument-neutral core

The V2 risk core receives normalized price geometry, strategy risk policy, and an
instrument specification. It does not fetch an account, place an order, or mutate
a broker.

```ts
interface InstrumentSpec {
  instrumentId: string;
  priceIncrement: number;
  valuePerPriceUnit: number;
  quantityMin: number;
  quantityMax: number;
  quantityStep: number;
  quoteCurrency: string;
  metadataObservedAt: string;
  metadataExpiresAt: string;
}
```

Outputs are informational research sizing and policy decisions with
`executionAuthority: none`.

### 10.2 MT5 CFD adapter

The MT5 adapter translates fresh read-only symbol metadata into InstrumentSpec:

- point size;
- pip size where applicable;
- contract size;
- value per point;
- volume minimum and maximum;
- volume step;
- quote currency;
- spread and cost assumptions.

Stale or missing metadata blocks realizable sizing. The adapter must not read
accounts, positions, or orders and must not call an execution endpoint.

### 10.3 Expectancy semantics

All expectancy fields declare sign and cost conventions:

- gross outcome in R before costs;
- estimated costs in positive R deducted from gross outcome;
- net outcome = gross outcome - estimated costs;
- losses are negative R;
- drawdown is reported as a positive magnitude;
- profit factor uses gross positive R divided by absolute gross negative R.

## 11. Evidence and artifact architecture

### 11.1 Artifact repository

The target repository stores compact immutable artifacts in IndexedDB or another
reviewed local repository. It replaces no existing store until adapter parity and
migration tests pass.

Artifact families include:

- context snapshots;
- detection artifacts;
- trade plans;
- replay summaries;
- walk-forward/OOS summaries;
- evidence and maturity summaries;
- committee/decision-log entries;
- self-improvement proposal intents;
- paper-only monitoring outcomes.

Raw candles remain in the candle repository, referenced by identity and bounded
window, not copied into artifacts.

### 11.2 Retention

- Compact validated evidence is retained by versioned identity.
- Superseded artifacts remain traceable until retention policy expires them.
- Large raw data and generated caches are not persisted in localStorage.
- LocalStorage stores only small operator settings and compatibility pointers.
- Schema migration is explicit, reversible, and fail-closed.

### 11.3 Evidence promotion

Evidence promotion requires identity equality, causal replay, independent/OOS
coverage, declared cost assumptions, sufficient samples/windows/dates, and
profile-specific gates. Recognition alone is never evidence.

## 12. Market narrative projection

Narrative is a projection over typed facts and artifacts. Every material sentence
must reference the IDs supporting it. Narrative may explain uncertainty but may
not invent a missing fact, candidate, probability, or readiness state.

```ts
interface NarrativeSentence {
  sentenceId: string;
  text: string;
  supportingFactIds: string[];
  supportingArtifactIds: string[];
  confidence: "low" | "medium" | "high";
  expiresAt?: string;
}
```

LLM-generated explanations consume compact narrative inputs only and remain
non-authoritative.

## 13. Materialized operator projections

Primary UI surfaces consume small read models:

- source and feed health;
- current market brief;
- current detection state;
- research trade-plan geometry when present;
- validation/evidence/readiness blockers;
- autonomous cycle status;
- paper-only outcomes;
- advisory and proposal-draft status.

Heavy detector, replay, walk-forward, and Monte Carlo computations do not run
during ordinary render. Advanced Research surfaces retain detailed diagnostics.
Projection builders are versioned and traceable to source artifacts.

## 14. Stage orchestration

Long research operations become resumable idempotent stages:

```text
source_preflight
context_build
detection
trade_construction
replay
walk_forward
evidence
maturity
committee
projection_refresh
```

Each stage has an input identity, output artifact ID, heartbeat, cancellation
token, attempt count, timeout, exact failure, and safe retry policy. A stage may be
skipped only with an explicit reason. Cancellation and stale state cannot trigger
a delayed apply or readiness promotion.

## 15. Migration modes

```ts
type MigrationMode =
  | "legacy_authoritative"
  | "shadow_compare"
  | "v2_authoritative_with_legacy_fallback"
  | "v2_authoritative";
```

Mode is scoped by profile and subsystem, not globally. For example, IFVG v3 context
may be in shadow mode while its legacy detector remains authoritative. Promotion
requires reviewed parity and rollback. Hybrid Migration never means combining
different identities into one result.

## 16. Authority and transport terminology

Current compatibility code uses `brokerAuthority: "read_only"` on MT5 push-feed
objects to mean market-data transport access. It does not represent broker mutation
authority, and it is not the V2 target contract.

V2 target semantics are:

```ts
interface V2MarketDataCapability {
  marketDataAccess: "read_only";
  transportCapability: "market_data_read_only";
  authority: GoTraderAuthority;
}
```

During compatibility migration:

- existing push-feed consumers may continue reading the legacy label;
- adapters must map it to `marketDataAccess: "read_only"`;
- no adapter may map it to broker, account, order, position, or execution authority;
- strict research artifacts always remain `none/none/none`;
- the legacy field is deprecated only after every consumer and fixture migrates.

Known legacy consumers are the MT5 push-feed types/normalizer/store/tests and the
forward-evidence candle identity validator. Phase 0.5 documents and tests the
distinction but does not make a breaking production rename.

## 17. Governance

### 17.1 Data integrity

- Validate OHLC, timestamps, order, duplicates, and gaps.
- Reject out-of-order or future closed candles.
- Preserve requested and broker symbol mapping.
- No silent fallback to mock/sample/imported data.
- Make depth and missing timeframes explicit.

### 17.2 DST and sessions

All session logic declares IANA timezone and calendar version. Tests cover EST/EDT
boundaries, weekends, holidays when available, and broker-server timestamp
conversion. Session facts store UTC boundaries and display-zone metadata.

### 17.3 Schema migration

Every stored artifact declares schema version. Migrations are additive first,
idempotent, observable, and reversible. Unknown future schemas fail closed. Legacy
readers remain available until migration acceptance.

### 17.4 Observability

Record compact stage durations, retries, blockers, source identities, artifact IDs,
and projection freshness. Do not log candles, secrets, credentials, account data,
orders, positions, or advisory tokens.

### 17.5 Test governance

Every migrated profile requires:

- deterministic unit fixtures;
- positive canary and negative control;
- source/timing integrity tests;
- geometry tests;
- replay and chronological OOS parity;
- authority/sensitive-data assertions;
- browser smoke for affected projections;
- performance budget checks;
- rollback test.

Golden fixtures protect reviewed behavior. They do not certify profitability.

### 17.6 Experiment governance

Experiments declare hypothesis, candidate family, one-variable change, baseline,
sample/window/date requirements, cost model, OOS split, and stop criteria.
Multiple comparisons require correction or a held-out confirmation set. Failed
experiments remain recorded. No result auto-mutates a frozen profile.

### 17.7 Trust boundaries

- MT5 source adapters provide read-only market data.
- Deterministic GoTrader code owns detection, validation, evidence, readiness, and
  risk policy.
- LLM/OpenClaw providers explain and propose drafts only.
- Operator actions may start/stop processes and queue deterministic validation.
- Broker gateway review is a separate future track.

### 17.8 Performance budgets

- Primary UI projections render without deep-history fetches.
- Current-read calculations use bounded rolling windows.
- Replay/OOS/Monte Carlo run explicitly or as orchestrated background stages.
- Artifact and localStorage payloads have enforced size limits.
- Browser smoke rejects console errors and unresolved lazy imports.

## 18. Compatibility and non-inferiority gates

A profile/subsystem can move beyond shadow mode only when:

1. all required baseline suites pass;
2. normalized outputs match or differences are reviewed;
3. positive and negative controls preserve classification;
4. no threshold or geometry drift is hidden in an adapter;
5. source identity and timing remain equivalent;
6. runtime and storage budgets do not regress materially;
7. authority and sensitive-data checks pass;
8. rollback to the legacy path is tested.

A seemingly better win rate is not sufficient. Negative-control promotion,
identity mismatch, reduced blocker transparency, or increased data leakage is a
regression.

## 19. Roadmap

```text
Prerequisite A - baseline stabilization
Phase 0 - strategy manifest and golden behavior
Phase 1 - contracts and read-only candle facade
Phase 2 - canonical context shadow builder
Phase 3 - IFVG v3 adapter canary
Phase 4 - remaining strategy adapters
Phase 5 - conflict/confluence shadow resolver
Phase 6 - trade geometry and structural risk
Phase 7 - evidence artifact repository
Phase 8 - stage orchestration and materialized runtime
Phase 9 - narrative provenance and operator migration
Phase 10 - profile-scoped Hybrid Migration
Separate future track - broker gateway review
```

### Prerequisite A

Isolate the dirty worktree, repair neutral harnesses, capture manifests/fixtures,
clarify authority terminology, and record a clean migration baseline.

### Phase 0

Preserve all registered profiles, positive/negative controls, source/timing
behavior, provenance, and safety. No production behavior changes.

### Phase 1

Add V2 contracts and a read-only facade over the current candle-source manager.
No detector consumes it authoritatively.

### Phase 2

Build the seven primitive context facts in shadow mode and compare with current
context outputs.

### Phase 3

Adapt IFVG v3 as positive canary and verify IFVG v2 remains a negative control.

### Phase 4

Migrate remaining executable profiles one at a time. Placeholders and diagnostics
remain non-executable.

### Phase 5

Add an evidence-family-aware shadow resolver, keeping current live resolution
authoritative.

### Phase 6

Consolidate geometry and instrument-neutral structural risk after parity.

### Phase 7

Introduce versioned compact artifacts and migrate one ledger at a time.

### Phase 8

Add resumable stage orchestration and materialized runtime projections.

### Phase 9

Make narrative traceable to facts/artifacts and migrate primary operator surfaces.

### Phase 10

Promote profile/subsystem slices only after non-inferiority and rollback review.

### Separate future broker track

Any broker gateway, account-risk governor, demo adapter, or order execution requires
a separate security, operational, and authority specification. It is not part of
this migration.

## 20. Phase acceptance

Every phase report records:

- source branch and base commit;
- exact changed paths;
- manifest and snapshot versions;
- fixture hashes;
- commands and results;
- reviewed deviations;
- authority result;
- preserved-work and rollback location;
- explicit statement of the next unauthorized phase.

## 21. Current baseline

Phase 0 uses:

- architecture revision: `gotrader-v2-architecture-rev1`;
- snapshot schema: `gotrader-v2-normalized-snapshot-v1`;
- strategy manifest: `gotrader-v2-strategy-manifest-v1`;
- test manifest: `gotrader-v2-test-manifest-v1`;
- source base: `f6dbe33489a122d36995c5eb260d763917d186b3`.

The baseline contains 27 strategy/legacy entries. IFVG v3 is the positive canary,
IFVG v2 is the negative control, placeholders remain non-executable, diagnostics
remain geometry-free, and all research artifacts retain `none/none/none`.

## 22. Explicit exclusions

This specification does not authorize:

- Phase 1 implementation as part of Phase 0.5;
- live or demo broker execution;
- account, order, or position access;
- readiness override;
- automatic calibration apply;
- in-place mutation of frozen profiles;
- raw candle persistence in artifacts or UI;
- direct MT5 access by OpenClaw or another LLM;
- a parallel backend or database migration.

Phase 1 requires a separate instruction after the clean Phase 0.5 migration
baseline is accepted.
