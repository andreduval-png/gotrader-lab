# GoTrader V2 Architecture Verification Report

**Verification date:** 2026-07-22  
**Current repository:** `C:/Users/andre/OneDrive/Documents/gotrader`  
**Current branch:** `local-restart-safety-check-2`  
**Current audited HEAD:** `f6dbe33`  
**Current-state baseline:** `docs/gotrader-v2-audit.md`  
**Proposed design reviewed:** `gotrader-v2-architecture-specification.md`  
**Scope:** Verification and recommendations only. No GoTrader V2 implementation was performed.

## 1. Verification Decision

The architecture specification is directionally sound and strongly aligned with the verified audit. It correctly chooses incremental migration, compatibility adapters, shadow comparison, immutable research identity, canonical market facts, and preservation of existing strategy and safety behavior.

The specification should be **approved with amendments**, not implemented verbatim.

The most important amendments are:

1. Split the proposed Strategy Flow lifecycle into a **current-market detection lifecycle** and a separate **long-term research lifecycle**.
2. Keep core risk contracts instrument-neutral. CFD sizing belongs in an adapter backed by verified MT5 symbol metadata.
3. Rename "hybrid authority" to **hybrid migration mode** or **hybrid canonicalization**. Migration state must never sound like execution permission.
4. Make compatibility mode profile-scoped or subsystem-scoped rather than one global application mode.
5. Refine the fact and identity contracts to avoid duplicated source metadata, unstable hashes, and untyped payloads.
6. Treat current Power of Three, Market Maker-style narrative, Strategy Library, Evidence, Narrative, and Trade Construction systems as adapter targets, not new greenfield engines.
7. Separate current-market confluence from historical strategy evidence. Historical maturity may constrain a candidate, but it is not another live-market confirmation.
8. Reconcile the roadmap with the "first implementation slice." The first slice should add a read-only repository facade over current sources, not physically migrate candle storage.

With these amendments, the proposed architecture is the correct direction for GoTrader V2.

## 2. Verification Method

The specification was checked against:

- Application entry points and routed workspaces.
- Candle Source Manager, MT5 read-only client, range/depth logic, and push-feed modules.
- Core ICT and ICT Strategy Suite implementations.
- Strategy Library registry and strategy lifecycle types.
- Current Opportunity, Universal Recognition, Current Read, and Approved Setup Profile logic.
- Trade construction, backtest, replay, validation, walk-forward, OOS, Monte Carlo, quality, evidence, maturity, and readiness.
- Internal agents, CIO synthesis, Research Committee, LLM/OpenClaw, Self-Improvement, Auto Research, and Autonomous Research.
- Operator Console, Results, Advisor, and advanced research surfaces.
- Broker, Paper-Demo, trade proposal MCP, and simulation account-risk experiments.
- Browser and CLI storage behavior.
- Current package scripts and known regression-harness status.

The worktree remains materially dirty. Uncommitted account-risk, gateway, quality-attribution, and UI changes are identified as worktree experiments rather than stable architecture.

## 3. Specification-to-Repository Verification Matrix

| Specification component | Repository status | Current implementation | Verification decision |
| --- | --- | --- | --- |
| Canonical Candle Repository | **Partially implemented** | `candleSources`, MT5 read-only storage, push-feed rolling store, replay snapshots, imported history | Build a facade over current systems; do not replace fingerprints or stores in the first slice. |
| Canonical Market Context Engine | **Partially implemented, fragmented** | `src/lib/ict`, `ictMarketAnalysisContext`, Advisor helpers, Grinch/runtime calculations | High-value V2 addition. Start in shadow mode. |
| Versioned Fact Graph | **Missing** | Facts exist as nested context objects without canonical fact IDs | Add only after contracts and parity fixtures are frozen. |
| Canonical Market State | **Partially implemented** | `ICTContext`, MTF context, Current Opportunity context, Current Read, runtime snapshot | Avoid creating another overlapping state object; define exact relationship to fact graph. |
| Strategy DNA Registry | **Substantially implemented** | `StrategyDefinition`, source requirements, conditions, rules, validation requirements, authority | Extend the current Strategy Library; do not replace it. |
| Strategy Flow Engine | **Partially implemented** | Current Opportunity classifications, detector statuses, Universal Recognition, Approved Setup Profile, Validation Chain | Standard adapter contract is needed; lifecycle must be split. |
| Power of Three classifier | **Implemented in multiple forms** | `modelOnePowerThree`, market-cycle and session-narrative logic, Grinch phases | Adapt and canonicalize; do not implement a second classifier. |
| Market Maker sequence | **Partially implemented** | Session narrative, market-cycle, liquidity/displacement/PD-array flows | Use as narrative/context orchestration, not a new trade strategy. |
| Conflict and Confluence Resolver | **Partially implemented** | ICT confluence, Approved Setup score, internal agents, CIO synthesis, committee dissent | Add evidence-family deduplication in shadow mode. |
| Trade Construction Engine | **Partially implemented** | `ictTradeConstruction` plus detector-local entry/stop/target logic | Preserve detector thesis construction; centralize geometry validation. |
| Structural risk | **Implemented for research** | Structure bounds, stop validity, target distance, RR gates | Preserve and adapt. |
| Expectancy/drawdown risk | **Implemented across diagnostics** | Replay metrics, Monte Carlo, Research Quality, readiness | Consolidate policy references, not calculations in one monolith. |
| CFD sizing adapter | **Experimental/partial** | Broker types and dirty simulation account-risk worktree modules | Keep outside core; require terminal symbol metadata. |
| Correlated exposure manager | **Missing** | No authoritative portfolio/account exposure in research app | Defer until simultaneous paper scenarios require it. |
| Evidence and Validation Engine | **Substantially implemented, fragmented** | Backtest, replay, walk-forward, Validation Chain, Quality, Evidence, Maturity, Readiness | Consolidate artifacts and queries; preserve behavior and gates. |
| Research identity | **Partially implemented** | Source/profile/parameter/validation/OOS provenance | Extend carefully with cost/detector/context versions and lineage. |
| Causal attribution | **Partially implemented in dirty worktree** | Research-quality attribution and `qualityContext` telemetry | Isolate and validate before making it a V2 dependency. |
| Parameter research | **Implemented** | Auto Research, Self-Improvement, versioned IFVG candidates, frozen-profile policy | Add multiple-comparison policy and a common experiment contract. |
| Market Narrative Engine | **Substantially implemented, fragmented** | Current Read, Advisor summaries, session narrative, committee, decision log | Add provenance projection; do not create new decision logic. |
| Operator projections | **Partially implemented** | Operator Console snapshot, Dashboard, Results, Advisor summaries | Move to materialized compact projections after artifact repository work. |
| Compatibility Layer | **Conceptually present, not formalized** | Legacy delegates, versioned profiles, current adapters | Add explicit per-profile migration status and parity reports. |
| Artifact repository | **Partially implemented** | Research Evidence IndexedDB plus many localStorage stores and file artifacts | Introduce a versioned repository without one-shot migration. |
| Materialized runtime snapshot | **Partially implemented** | `resolveResearchRuntimeSnapshot` aggregates and recomputes state | Replace recomputation gradually with stored projections. |
| Resumable stage orchestrator | **Partially implemented** | Research-cycle steps, autonomous heartbeat/cancellation/storage | Central cycle remains monolithic; stage artifacts/idempotency are missing. |
| Security and authority | **Implemented and strong** | none/none/none contracts, read-only MT5, advisory sanitizers, fail-closed gates | Preserve unchanged. |
| Experimental broker review | **Correctly deferred** | Trade Proposal MCP, Paper-Demo gateway, simulation risk experiments | Keep on a separate review track from V2 research architecture. |

### 3.1 Disposition of every specification section

| Spec section | Disposition | Repository verification |
| ---: | --- | --- |
| 1. Executive Decision | **Agree** | Incremental migration is justified by validated detectors and safety contracts. |
| 2. Non-Negotiable Invariants | **Agree with amendment** | Preserve all invariants; make the core risk contract instrument-neutral rather than CFD-specific. |
| 3. Target System Topology | **Agree** | Matches current flow, but Narrative should consume flow, risk, and evidence artifacts rather than sit only beside Strategy Flow. |
| 4. Canonical Candle Repository | **Agree, partially implemented** | Use a facade first; current Source Manager and push/history stores must not be physically merged immediately. |
| 5. Canonical Market Context | **Strongly agree, partially implemented** | Highest-value new layer; requires typed facts, stable identity, shadow parity, and causal timing. |
| 6. Canonical Market State | **Agree with scope clarification** | Define it as the materialized projection of the fact graph, not another parallel context model. Enforce exclusivity only in unified mode. |
| 7. Strategy DNA Registry | **Agree, mostly implemented** | Extend `StrategyDefinition`; add versioned facts/stages/cost/detector policy rather than create a second registry. |
| 8. Strategy Flow Engine | **Agree with major amendment** | Split current detection flow from long-term research lifecycle. Use typed states rather than `state: string`. |
| 9. PO3 and Market Maker Model | **Agree as adapters** | Current PO3, market cycle, Grinch, and session-narrative logic should be adapted, not reimplemented. |
| 10. Conflict and Confluence Resolver | **Agree with amendment** | Separate current thesis, historical model evidence, and risk constraints. Add evidence-family deduplication in shadow mode. |
| 11. Trade Construction | **Agree, partially implemented** | Keep strategy-owned thesis levels and strengthen the current shared geometry validator. |
| 12. Risk Management | **Agree with major amendment** | Keep core instrument-neutral, clarify expectancy sign, version correlations, and defer account/portfolio authority. |
| 13. Evidence and Validation | **Strongly agree, substantially implemented** | Consolidate current engines and extend lineage. Do not replace current replay/OOS/readiness behavior. |
| 14. Market Narrative | **Agree, substantially implemented** | Add sentence provenance and prevent any new decision logic in narrative. |
| 15. Operator Projections | **Agree, partially implemented** | Current Operator Console is the starting adapter; migration follows materialized artifacts. |
| 16. Compatibility and Preservation | **Strongly agree with amendment** | Use profile-scoped modes and distinguish positive canaries, negative controls, and parity fixtures. |
| 17. Storage and Runtime | **Strongly agree, partially implemented** | IndexedDB evidence exists; storage and stage orchestration remain fragmented. Migrate incrementally. |
| 18. Security, Safety, Authority | **Strongly agree, implemented** | Preserve none/none/none and separate any future gateway process. |
| 19. Roadmap | **Agree with reorder** | Add baseline stabilization and a repository facade before physical source unification; rename Phase 8. |
| 20. Acceptance Criteria | **Agree with amendments** | Update instrument criterion, add causal timing, schema/hash, browser smoke, and profile-scoped rollback criteria. |
| 21. First Codex Slice | **Agree after prerequisites** | Repair baseline tests first, then contracts, read facade, and context shadow diagnostics only. |
| 22. Final Design Rule | **Agree** | Coherence is valuable only with behavioral parity, safety, traceability, and reproducibility. |

## 4. Areas of Agreement

### 4.1 Incremental migration, not rewrite

This is the correct central decision. The repository has validated detector behavior, frozen profiles, OOS evidence, source provenance, readiness gates, and safety checks. Replacing those systems would create more validation risk than architectural benefit.

The compatibility-first direction agrees with the audit and should remain non-negotiable.

### 4.2 Canonical market facts

The proposal to compute base facts once is the highest-leverage V2 improvement. FVG, liquidity, bias, session, displacement, premium/discount, and structure are currently calculated or interpreted in multiple modules.

The specification correctly allows strategy-local windows and thresholds. A Silver Bullet sweep and a CMD manipulation can reference the same canonical liquidity event while applying different qualification rules.

### 4.3 Ordered strategy development

Current strategies already have implicit sequences. IFVG requires formation, inversion, retest, and confirmation. Silver Bullet requires a window, sweep, displacement FVG, and return. Session Raid has explicit ordered steps.

Making these stages visible and standard will improve:

- Current setup explanations.
- Near-miss diagnostics.
- Replay attribution.
- Forward observation.
- Strategy parity testing.

### 4.4 Evidence-family deduplication

The specification correctly identifies that three model scores derived from one sweep are not three independent confirmations. This is currently a real architectural weakness because detector scores, approved-profile scores, agent confidence, and CIO confidence can all reuse correlated inputs.

### 4.5 Strategy-owned thesis, canonical geometry validation

This matches the verified repository. A strategy should choose its thesis-specific entry, invalidation, and target. The shared engine should validate ordering, structure, RR, cost, and freshness. It should not invent a generic target that changes the strategy.

### 4.6 Immutable evidence lineage

The specification strengthens an existing successful pattern. Current Validation Chain and provenance logic already block evidence from another profile, parameter set, source fingerprint, or OOS run. V2 should formalize this lineage rather than relax it.

### 4.7 Narrative as projection

Current Read and Research Committee are valuable when they explain deterministic artifacts. The specification correctly prevents narrative and LLM output from becoming a second strategy engine.

### 4.8 Operator-focused UI

The current shell already prioritizes Overview, Decisions, Results, and Settings while retaining Advanced Research. Compact materialized projections are consistent with both the audit and the user's product direction.

### 4.9 Safety and future gateway separation

The proposed authority boundary is correct. The research application must remain incapable of submitting orders. Any future demo gateway must be a separately reviewed process that revalidates every input.

## 5. Required Architecture Amendments

These amendments should be made to the design before implementation recommendations become work items.

### 5.1 Split Strategy Flow from Research Lifecycle

The proposed lifecycle currently combines two different clocks:

```text
Current market formation:
INSUFFICIENT_DATA -> OBSERVING -> FORMING -> TRIGGER -> CONFIRMATION -> TRADE_PLAN

Long-term model evidence:
REPLAY_REQUIRED -> EVIDENCE_BUILDING -> VALIDATED_RESEARCH -> FROZEN/RETIRED
```

These should be separate state machines.

Recommended contracts:

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

A live IFVG setup may be `trade_plan_constructed` while its profile is still `evidence_building`. Mixing those states would recreate current status confusion.

### 5.2 Make core risk instrument-neutral

The current source is MT5 USTECH CFD/proxy data used for MNQ-style research. The CFD sizing contract is useful, but it should be an adapter:

```text
Risk Policy
  -> Instrument Specification Adapter
      -> MT5 CFD adapter today
      -> Futures adapter later
```

Core research risk should remain expressed in price distance, R multiples, cost assumptions, and abstract monetary value per price unit. Lot sizing must use fresh terminal metadata and must never rely on static symbol assumptions.

Acceptance criterion 8 should therefore say:

> Risk uses an instrument-neutral contract with an MT5 CFD adapter today and an explicit future futures-adapter boundary.

### 5.3 Rename Phase 8

"Hybrid authority" is misleading because authority is a safety permission, not a migration state.

Use:

- `hybrid migration mode`, or
- `hybrid canonicalization`.

Authority remains none/none/none in every migration mode.

### 5.4 Make migration mode local, not global

A single application-wide `legacy/shadow/hybrid/unified` setting is risky. IFVG v3 may be ready for canonical context while Turtle Soup is still legacy.

Recommended key:

```text
migrationMode(strategyId, profileVersion, subsystemVersion)
```

This permits controlled rollout and rollback per profile.

### 5.5 Refine fact contracts

The proposed `MarketFact<T>` should be more explicit:

- Use a discriminated, versioned payload union instead of unrestricted `type: string` and `payload: T`.
- Store `sourceIdentityRef` or `contextId`, not a full `CandleSeriesIdentity` copy on every fact.
- Replace ambiguous `quality: number` with a documented `FactQuality` object or enum plus diagnostics.
- Add `supersededByFactId` or validity-range semantics for facts that change.
- Specify stable canonical serialization before hashing.
- State whether `observedAt` is candle-close time, provider time, or local receive time.

Without these changes, the fact graph will duplicate metadata and produce unstable or incomparable IDs.

### 5.6 Refine research identity and lineage

The proposed identity should include or reference:

- A sorted timeframe-to-fingerprint map, not only `timeframeSet`.
- Context schema/calculation version.
- Detector version.
- Trade construction policy version.
- Cost model version.
- Risk policy version where relevant.
- Session calendar/timezone version.
- Data window boundaries.

"No child artifact may attach to a parent with a different identity" is too absolute for derived windows. A frozen OOS child legitimately uses a different date window from training while sharing a parent experiment identity.

Use explicit lineage and compatibility rules:

```text
exact dimensions + declared derivation relationship + immutable parent artifact ID
```

### 5.7 Separate live confluence from historical model evidence

The resolver lists market facts, strategy completeness, replay quality, OOS stability, drawdown, and source quality together. They should not be one additive score.

Recommended outputs:

1. `CurrentThesisResolution`: alignment, contradictions, and fact independence.
2. `ModelEvidenceConstraint`: whether the strategy profile is permitted to progress.
3. `RiskConstraint`: whether scenario or model risk reduces/blocks it.

Historical evidence may cap or block a current setup, but it should not count as another bullish or bearish market confirmation.

### 5.8 Clarify expectancy math

The formula must define `averageLossR` as a positive loss magnitude. Current GoTrader trade records often represent losing R values as negative numbers. Otherwise the proposed subtraction can double-negate losses.

Use either:

```text
expectancyR = winRate * averageWinR + lossRate * averageLossR
```

where `averageLossR` is negative, or explicitly require a positive `averageLossMagnitudeR` and subtract it.

### 5.9 Version correlation policy

Static clusters are a reasonable initial policy, but they should be configured and versioned. USTECH, US500, and US30 are often correlated, but correlation changes by regime.

Before account exposure exists, this component should operate as a **research scenario concentration warning**, not a portfolio authority.

### 5.10 Reclassify golden profiles

The list mixes three categories:

- **Positive migration canary:** IFVG fresh retest v3.
- **Negative control:** IFVG filtered v2 and rejected/weak baselines.
- **Behavioral parity fixtures:** Silver Bullet, Turtle Soup, CISD, CMD, session raid, Bread & Butter, One Shot One Kill, and Grinch profiles.

Calling every profile "golden" may imply validated edge. The harness should preserve behavior without implying profitability.

### 5.11 Resolve roadmap/first-slice inconsistency

The roadmap puts the Canonical Candle Repository before the context builder, while the first implementation slice begins with contracts and context parity.

The safer order is:

1. Add a read-only `CandleRepository` interface.
2. Implement adapters over the current Candle Source Manager and current history/push stores.
3. Do not migrate physical storage or alter fingerprints.
4. Build the shadow context engine against that interface.
5. Consider repository consolidation only after fact parity is stable.

This resolves the inconsistency while reducing source-migration risk.

### 5.12 Limit the "no alternate state" rule to unified mode

During shadow and hybrid migration, legacy modules must continue building current contexts for parity comparison. The rule forbidding alternate market-state construction should apply only after a profile reaches unified mode.

## 6. Already Implemented Capabilities

The following specification ideas already exist strongly enough that V2 should adapt rather than recreate them:

### Source and candles

- Canonical provider/source types.
- Source eligibility and data-quality checks.
- Stable source fingerprints.
- Active chart/research/walk-forward source roles.
- MT5 latest/range/chunked history.
- Imported history and frozen replay snapshots.
- Push-feed event types, normalization, deduplication, status, and candle-close triggers.
- Explicit mock/sample restrictions.

### Strategy and current market decisions

- A 22-entry Strategy Library.
- Executable versus placeholder versus diagnostic status.
- Source requirements, supported symbols/timeframes, conditions, validation requirements, and forbidden promotion reasons.
- Diagnostic, forming, trade-candidate, rejected-candidate, and no-trade classifications.
- Universal Recognition tiers.
- Approved Setup Profile and model-aware HTF alignment.
- Detector-specific IFVG, Silver Bullet, Turtle Soup, CISD, CMD, and session-raid paths.
- Versioned IFVG profiles and frozen-profile protection.

### Trade and research risk

- Entry/stop/target/RR geometry validation.
- Structure-bound stop checks.
- Strategy-specific minimum/max RR and stop constraints.
- Replay metrics, drawdown analysis, false-positive attribution, session comparison, conservative scenarios, and Monte Carlo.
- Readiness risk requirements and Paper-Demo checklist.

### Evidence and learning

- Validation Chain lifecycle.
- Source/profile/parameter/validation/OOS provenance checks.
- Detector-profile frozen chronological walk-forward.
- IndexedDB research evidence ledger.
- Decision log, reflection memory, Research Committee, forward evidence, prediction ledger, and gbrain outbox.
- Auto Research and Self-Improvement draft hypotheses.
- Explicit calibration opt-in and frozen-profile versioning.

### Narrative and operator surfaces

- Current Read and compact Advisor packet.
- Session narratives and deterministic blocker explanations.
- Operator Console snapshot.
- Results, Decisions, Overview, and Settings primary hubs.
- LLM/OpenClaw provider-state and response safety models.

### Safety

- Authority none/none/none on research artifacts.
- Read-only MT5 market-data path.
- No routed `/execute` page.
- No research-cycle broker order call.
- No LLM readiness or execution authority.

## 7. Partially Implemented Capabilities

| Capability | What exists | What remains |
| --- | --- | --- |
| Candle repository | Source Manager, MT5 stores, push store, replay/import | One read facade and equivalence tests across paths. |
| Market context | Core ICT and MTF context | Canonical IDs, fact graph, cache, parity harness. |
| Market state | Several overlapping context/read models | One defined immutable projection and compatibility boundary. |
| Strategy DNA | Rich StrategyDefinition | Profile/detector/cost versions, ordered stages, fact requirements. |
| Strategy Flow | Detector statuses and current opportunity stages | Standard result contract and adapters. |
| Conflict resolution | Confluence, approved scores, agents/CIO | Evidence families, contradiction severity, dissent artifact. |
| Trade construction | Shared validator plus detector-local logic | Theoretical vs realizable RR and one geometry authority. |
| Risk engine | Research risk plus simulation experiments | Instrument adapter contract and isolated account-risk review. |
| Research identity | Strong provenance | Context/cost/detector/calendar versions and lineage. |
| Causal learning | Quality context and attribution work | Stable committed contract, coverage across strategies, controlled experiments. |
| Artifact repository | Evidence IndexedDB and compact ledgers | Unified schema, migration, retention, projection queries. |
| Runtime projection | Large runtime resolver | Stored identity-keyed materialized snapshots. |
| Stage orchestration | Named steps and autonomous heartbeat | Immutable stage artifacts, retries, idempotency, resume. |
| Narrative provenance | Deterministic summaries | Sentence-to-artifact references. |
| Compatibility | Legacy delegates and versioned profiles | Formal per-profile migration state and parity reports. |

## 8. Unnecessary or Overlapping Work

The following should not become separate greenfield projects:

1. **A replacement Strategy Registry.** Extend the current Strategy Library.
2. **A second PO3 engine.** Adapt `modelOnePowerThree`, market-cycle, session, and Grinch outputs.
3. **A second Evidence Engine beside current ledgers.** Consolidate through repository adapters.
4. **A new Narrative decision engine.** Narrative must project Current Read, flow, risk, and evidence artifacts.
5. **A complete Trade Construction rewrite.** Keep detector-owned thesis logic and strengthen the shared validator.
6. **A CFD-specific core risk model.** Keep CFD behavior in an adapter.
7. **An early portfolio correlation authority.** Use research warnings until multiple account-backed positions exist.
8. **Immediate UI migration.** UI should move after artifacts and runtime projections stabilize.
9. **Immediate physical candle-store migration.** Start with a facade and equivalence tests.
10. **Global cutover mode.** Migrate one subsystem/profile at a time.

## 9. Missing Requirements

The specification should add the following before implementation begins.

### 9.1 Data integrity and time semantics

- Gap, duplicate, out-of-order, weekend, holiday, DST, and session-boundary checks.
- Provider/server/local receive timestamp semantics.
- Partial versus closed candle policy.
- Deep-history versus browser-window lineage.
- Explicit stale-feed recovery behavior.

### 9.2 Schema governance

- Stable canonical serialization for hashes.
- Artifact and fact schema migration rules.
- Retention/compaction policy.
- Garbage collection for superseded facts and projections.
- Export/import and recovery procedure.

### 9.3 Test and release gates

- One `test:core` manifest or orchestrated suite.
- Repaired partial-compilation harnesses.
- Frozen regime-classifier semantics.
- Installed Playwright browser and required browser smoke.
- Fact parity tolerances and lookahead-leakage tests.
- Performance budgets for dual-run context and UI projections.

### 9.4 Experiment governance

- Multiple-comparison correction policy.
- Minimum sample and independent-date/window policy by profile.
- Negative-control requirements.
- Explicit train/validation/OOS boundary artifacts.
- Experiment registry and retirement rules.

### 9.5 Observability

- Context build duration and cache-hit metrics.
- Detector duration and candidate counts by profile.
- Stage heartbeat, retry, cancellation, and failure reason.
- Artifact write failures and browser quota status.
- Source freshness and active fingerprint diagnostics.

### 9.6 Trust boundaries

- Authentication/origin policy for local push/WebSocket and gateway services.
- Local secret/token handling.
- Process isolation for future broker gateways.
- Explicit prohibition on account/order/position data in the browser research repository.

## 10. Implementation Risks

| Risk | Severity | Why it matters | Mitigation |
| --- | --- | --- | --- |
| Lookahead leakage during fact canonicalization | Critical | A small timing difference can invalidate IFVG/OOS evidence. | Causal timestamp fixtures and frozen parity tests. |
| Source fingerprint drift | Critical | Existing evidence may no longer match active research identity. | Preserve legacy fingerprint; version any new identity separately. |
| Detector behavior drift | Critical | Central facts may alter candidate counts or blockers. | Shadow dual-run and profile-level non-inferiority reports. |
| Dirty worktree contamination | High | Experimental risk/gateway changes can be mistaken for stable dependencies. | Isolate commits/branches before V2 baseline capture. |
| Fact graph over-modeling | High | Large generic contracts can become slower and less clear than current code. | Start with seven parity primitives and typed payloads. |
| Hash instability | High | Object order or optional fields can change artifact identity. | Canonical serialization and hash-version fixtures. |
| Dual-run performance | High | Current runtime already recomputes many contexts. | Worker/job boundary, cache, and performance budget. |
| LocalStorage migration failure | High | Previous quota failure already occurred. | IndexedDB append-first, bounded projections, recoverable migration. |
| Confidence recombination | High | Resolver could double-count current facts and historical evidence. | Separate thesis, model evidence, and risk outputs. |
| Global migration flag | High | One incomplete strategy could force or block the whole application. | Per-profile/subsystem modes. |
| Adapter proliferation | Medium | Compatibility code can become permanent duplication. | Exit criteria and adapter retirement tracker. |
| Test harness blind spots | High | Known harness/module drift means parity may appear greener than it is. | Repair baseline tests before Phase 1. |
| Browser UI regression | Medium | HTTP route success does not validate lazy imports or interactive charts. | Mandatory Playwright smoke and console checks. |
| Experimental broker reachability | Critical | Research architecture must not accidentally expose execution. | Separate process/repository boundary and authority tests. |

## 11. Migration and Compatibility Risks

### 11.1 Existing storage keys

Many features use independent localStorage keys. V2 must read legacy state during migration but should not rewrite all records in place. A failed migration must leave existing records recoverable.

### 11.2 Frozen evidence identity

IFVG v3 and other audits reference exact source, detector, parameters, and time windows. A canonical-context migration must not relabel old evidence as V2 evidence without an explicit parity artifact.

### 11.3 Strategy-local semantics

Canonical swings, sweeps, and ranges cannot erase local strategy definitions. The context engine should provide objective observations and allow a strategy to produce a versioned local interpretation.

### 11.4 Current UI contracts

The runtime snapshot has many consumers. Removing fields early would cause broad UI drift. V2 projections should initially backfill current snapshot fields through adapters.

### 11.5 CLI versus browser research

Deep 90/180-day jobs and browser-safe current reads are intentionally different workloads. V2 must share artifact schemas without forcing deep history into page-load runtime.

### 11.6 Current tests as compatibility contracts

The large script suite is fragmented but valuable. Tests should be organized, not discarded. Frozen detector and provenance tests are part of the migration contract.

## 12. Revised Implementation Order

### Prerequisite A: Stabilize the baseline

- Isolate or stash unrelated dirty worktree groups.
- Repair the two partial-compilation harnesses.
- Resolve the regime-classifier expectation.
- Install Playwright and run browser smoke.
- Add a core test manifest without deleting existing scripts.

### Phase 0: Strategy manifest and golden behavior

- Map every profile to detector, profile version, validation profile, cost model, and tests.
- Label positive canary, negative control, or behavioral fixture.
- Capture compact golden outputs and performance budgets.

### Phase 1: Contracts and read-only candle facade

- Define authority-preserving identity and fact contracts.
- Define canonical serialization/hash version.
- Add a read-only `CandleRepository` interface.
- Adapt the existing Source Manager, MT5 history, push store, imported source, and replay source.
- Do not migrate physical storage.

### Phase 2: Canonical Market Context shadow builder

- Start with session/time, HTF bias, swings/structure, liquidity/sweeps, FVG, displacement, and premium/discount.
- Dual-run against legacy outputs.
- Add causal timing and performance diagnostics.

### Phase 3: Strategy Flow adapter canary

- Adapt IFVG v3 without changing its detector thresholds.
- Use IFVG v2 as negative control.
- Split detection state from research lifecycle state.
- Compare candidates, blockers, geometry, replay, and OOS.

### Phase 4: Remaining detector adapters

- IFVG v1/v4, CMD, Silver Bullet, Turtle Soup, CISD, session raid.
- Bread & Butter, One Shot One Kill, and Grinch through compatibility delegates.
- Preserve placeholders as catalog-only entries.

### Phase 5: Conflict/confluence shadow resolver

- Add evidence-family IDs and contradiction artifacts.
- Keep current candidate authoritative.
- Separate current thesis, historical evidence, and risk constraints.

### Phase 6: Trade geometry and structural risk

- Make shared geometry validation authoritative after parity.
- Add theoretical and realizable RR.
- Introduce instrument-neutral specs plus MT5 CFD adapter.
- Keep account risk and execution out of scope.

### Phase 7: Evidence artifact repository and causal learning

- Introduce versioned IndexedDB artifacts.
- Add identity lineage, cost/detector versions, and causal tags.
- Migrate one ledger at a time with legacy readers.
- Add controlled experiment and multiple-comparison policy.

### Phase 8: Stage orchestration and materialized runtime

- Convert research-cycle stages into resumable jobs.
- Add heartbeat, cancellation, idempotency, retry, and exact failures.
- Materialize runtime and operator projections.
- Remove strategy computation from primary UI only after parity.

### Phase 9: Narrative provenance and operator migration

- Attach sentences to fact/flow/risk/evidence IDs.
- Move Overview, Decisions, and Results to compact projections.
- Preserve Advanced Research tools.

### Phase 10: Profile-scoped hybrid migration

- Promote one profile/subsystem at a time from shadow to unified.
- Require non-inferiority and tested rollback.
- Authority remains none/none/none.

### Separate future track: broker gateway review

Paper-demo gateway, account-risk governor, MT5 demo adapter, and any future broker execution remain outside the V2 research migration. They require a separate safety and security specification.

## 13. Estimated Phase Size

These are engineering effort ranges for one senior engineer familiar with the repository. They are not delivery commitments and exclude future broker execution.

| Work | Estimated effort | Main uncertainty |
| --- | ---: | --- |
| Baseline stabilization | 1-2 engineer-weeks | Dirty worktree and broken harnesses. |
| Phase 0 manifest/golden fixtures | 1-2 weeks | Fixture quality and historical artifact capture. |
| Phase 1 contracts/candle facade | 2-3 weeks | Fingerprint compatibility and source adapters. |
| Phase 2 context shadow builder | 3-5 weeks | Fact parity and causal timing. |
| Phase 3 IFVG canary adapters | 2-4 weeks | Exact v3/v2 replay parity. |
| Phase 4 remaining strategy adapters | 6-10 weeks | Number and diversity of detectors. |
| Phase 5 resolver | 3-5 weeks | Independence-family policy and score semantics. |
| Phase 6 geometry/structural risk | 3-5 weeks | Detector-local construction and instrument metadata. |
| Phase 7 evidence repository | 4-7 weeks | Schema migration and causal attribution. |
| Phase 8 orchestration/runtime | 5-8 weeks | Resume semantics and broad UI consumers. |
| Phase 9 narrative/operator projections | 3-5 weeks | Provenance coverage and UI compatibility. |
| Phase 10 profile migration | 4-8 weeks | Non-inferiority failures and rollback. |

Estimated total: **37-64 engineer-weeks** for a careful full migration by one engineer. The first useful, non-authoritative V2 shadow slice should be achievable in approximately **7-12 engineer-weeks** after baseline stabilization.

Parallel work can shorten elapsed time, but only if one owner controls contracts, identity, and parity policy.

## 14. Recommended First Implementation Slice

The specification's first slice is fundamentally correct after these adjustments:

1. Stabilize baseline tests and browser smoke first.
2. Add a strategy manifest that references the current Strategy Library rather than duplicating it.
3. Define contracts in a new isolated V2 namespace.
4. Add a read-only candle-repository adapter over current sources.
5. Build a shadow context builder for seven primitives.
6. Use IFVG v3 as positive canary and IFVG v2 as negative control.
7. Store parity diagnostics only.
8. Do not route V2 output to Current Opportunity, Research Cycle, evidence, readiness, UI, or broker code.

No production threshold, strategy result, or authority field should change in this slice.

## 15. Final Verification Result

### Approved direction

- Incremental compatibility migration.
- Canonical candle read facade.
- Canonical fact/context shadow engine.
- Standard strategy adapters.
- Evidence-family-aware conflict resolution.
- Shared geometry validation.
- Unified compact evidence artifacts.
- Materialized operator projections.
- Preserved safety and advisory boundaries.

### Changes required before implementation

- Split detection and research lifecycles.
- Make risk core instrument-neutral.
- Rename hybrid authority.
- Scope migration modes by profile/subsystem.
- Refine fact quality, payload, identity, and lineage contracts.
- Separate live confluence from historical evidence.
- Clarify expectancy sign semantics.
- Reclassify golden profiles.
- Add data-integrity, schema, observability, experiment, and test-governance requirements.
- Reconcile the roadmap with the first implementation slice.

### Final recommendation

Adopt the architecture specification as a **revised design baseline** after the amendments in this report are incorporated. Do not begin broad implementation from the original document unchanged.

The safest next engineering action, after explicit approval, is baseline stabilization followed by an isolated read-only V2 contract and shadow-context package. Existing strategies, replay results, evidence, readiness, storage, UI decisions, and broker boundaries should remain authoritative throughout that work.
