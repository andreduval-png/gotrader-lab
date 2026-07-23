import { assertV2Authority, V2_AUTHORITY_NONE } from "../../authority/v2Authority";
import type {
  V2CanonicalMarketState,
  V2FactEnvelope,
  V2FairValueGapFactPayload,
  V2MarketFact
} from "../../context/v2ContextTypes";
import type { V2StrategyAdapter } from "../v2StrategyAdapter";
import {
  V2_IFVG_V3_ADAPTER_ID,
  V2_IFVG_V3_ADAPTER_VERSION,
  V2_IFVG_V3_ARTIFACT_SCHEMA_VERSION,
  V2_IFVG_V3_INPUT_CONTRACT_VERSION,
  V2_IFVG_V3_PROFILE_ID,
  V2_IFVG_V3_STRATEGY_ID,
  type V2IfvgV3AdapterResult,
  type V2IfvgV3DetectionArtifact
} from "./v2IfvgV3Types";
import {
  buildV2IfvgV3ArtifactIdentity,
  buildV2IfvgV3CandidateIdentity,
  buildV2IfvgV3FvgSemanticIdentity
} from "./v2IfvgV3Identity";

type FvgFact = Readonly<V2FactEnvelope<"fair_value_gap", V2FairValueGapFactPayload>>;

const uniqueSorted = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const factById = (facts: readonly Readonly<V2MarketFact>[], factId: string) =>
  facts.find((fact) => fact.factId === factId);

const supportingLineage = (context: Readonly<V2CanonicalMarketState>, fact: FvgFact) => {
  const displacement = fact.derivation.inputFactIds
    .map((factId) => factById(context.facts, factId))
    .find((candidate) => candidate?.kind === "displacement");
  const liquidityFactIds = displacement
    ? displacement.derivation.inputFactIds.filter((factId) => {
        const candidate = factById(context.facts, factId);
        return candidate?.kind === "liquidity_pool" || candidate?.kind === "liquidity_sweep";
      })
    : [];
  return {
    displacementFactId: displacement?.factId,
    liquidityFactIds: uniqueSorted(liquidityFactIds)
  };
};

const artifactFor = async (
  context: Readonly<V2CanonicalMarketState>,
  fact: FvgFact
): Promise<Readonly<V2IfvgV3DetectionArtifact>> => {
  const lifecycle = fact.payload.state;
  const inverted = lifecycle === "inverted" && Boolean(fact.payload.inversionTime);
  const expired = lifecycle === "invalidated" || (
    Boolean(fact.expiresAt) && Date.parse(fact.expiresAt as string) <= Date.parse(context.identity.asOfMarketTime)
  );
  const direction = fact.payload.direction === "bearish" ? "long" as const : "short" as const;
  const inversionTime = fact.payload.inversionTime ?? fact.causalClosedCandleTime;
  const semanticIdentityHash = await buildV2IfvgV3FvgSemanticIdentity({
    confirmationCandleTime: fact.payload.confirmationCandleTime,
    direction: fact.payload.direction,
    lowerBound: fact.payload.lowerBound,
    sourceFingerprint: context.identity.source.sourceFingerprint,
    timeframe: fact.timeframe,
    upperBound: fact.payload.upperBound
  });
  const normalizedCandidateId = await buildV2IfvgV3CandidateIdentity({
    direction,
    fvgSemanticIdentityHash: semanticIdentityHash,
    inversionTime,
    sourceFingerprint: context.identity.source.sourceFingerprint,
    timeframe: fact.timeframe
  });
  const artifactId = await buildV2IfvgV3ArtifactIdentity({
    adapterVersion: V2_IFVG_V3_ADAPTER_VERSION,
    contextArtifactId: context.contextArtifactId,
    normalizedCandidateId
  });
  const lineage = supportingLineage(context, fact);
  const factBlockers = [...fact.quality.blockers];
  const limitationIds = inverted
    ? ["pre_inversion_usage_history_unavailable", "fresh_retest_history_deferred_to_phase_3b"]
    : [];
  const blockerIds = expired
    ? uniqueSorted([...factBlockers, "ifvg_lifecycle_expired"])
    : inverted
      ? uniqueSorted(factBlockers)
      : uniqueSorted([...factBlockers, "full_inversion_not_confirmed"]);

  return Object.freeze({
    schemaVersion: V2_IFVG_V3_ARTIFACT_SCHEMA_VERSION,
    artifactId,
    normalizedCandidateId,
    strategyId: V2_IFVG_V3_STRATEGY_ID,
    profileId: V2_IFVG_V3_PROFILE_ID,
    adapterVersion: V2_IFVG_V3_ADAPTER_VERSION,
    artifactState: expired ? "expired" : inverted ? "detected" : blockerIds.length > 1 ? "blocked" : "rejected",
    detectionFlowState: expired
      ? lifecycle === "invalidated" ? "invalidated" : "expired"
      : inverted
        ? "inversion_confirmed"
        : "awaiting_inversion",
    direction,
    source: Object.freeze({
      provider: context.identity.source.provider,
      requestedSymbol: context.identity.source.requestedSymbol,
      brokerSymbol: context.identity.source.brokerSymbol,
      sourceFingerprint: context.identity.source.sourceFingerprint,
      timeframe: fact.timeframe
    }),
    contextArtifactId: context.contextArtifactId,
    contextIdentityHash: context.identity.identityHash,
    fvgReference: Object.freeze({
      factId: fact.factId,
      semanticIdentityHash,
      originalDirection: fact.payload.direction,
      confirmationCandleTime: fact.payload.confirmationCandleTime,
      lifecycleState: lifecycle
    }),
    ...(inverted ? {
      ifvgReference: Object.freeze({
        originalFvgFactId: fact.factId,
        inversionTime,
        derivedFromLifecycleState: "inverted" as const
      })
    } : {}),
    ...(lineage.displacementFactId ? { displacementFactId: lineage.displacementFactId } : {}),
    liquidityFactIds: lineage.liquidityFactIds,
    confirmationState: inverted ? "confirmed_closed_candle" : "not_confirmed",
    blockerIds,
    limitationIds: Object.freeze(limitationIds),
    observedMarketTime: fact.observedMarketTime,
    causalClosedCandleTime: fact.causalClosedCandleTime,
    policyVersion: fact.payload.policyVersion,
    shadowOnly: true,
    authority: V2_AUTHORITY_NONE
  });
};

export const V2IfvgV3Adapter: V2StrategyAdapter<V2CanonicalMarketState, V2IfvgV3DetectionArtifact> = Object.freeze({
  strategyId: V2_IFVG_V3_STRATEGY_ID,
  profileId: V2_IFVG_V3_PROFILE_ID,
  adapterId: V2_IFVG_V3_ADAPTER_ID,
  adapterVersion: V2_IFVG_V3_ADAPTER_VERSION,
  inputContractVersion: V2_IFVG_V3_INPUT_CONTRACT_VERSION,
  requiredFactFamilies: Object.freeze(["fair_value_gap"]),
  requiredTimeframes: Object.freeze(["5m"]),

  async detect(
    context: Readonly<V2CanonicalMarketState>
  ): Promise<Readonly<V2IfvgV3AdapterResult>> {
    assertV2Authority(context.authority);
    const contextBlockers = [
      context.shadowOnly === true ? undefined : "context_not_shadow_only",
      context.diagnostics.status === "blocked" ? "context_blocked" : undefined,
      context.identity.source.sourceKind === "mock_sample" ? "mock_sample_source_not_eligible" : undefined,
      context.identity.requiredTimeframes.includes("5m") ? undefined : "required_5m_context_missing"
    ].filter((item): item is string => Boolean(item));
    const fvgFacts = context.facts
      .filter((fact: Readonly<V2MarketFact>): fact is FvgFact =>
        fact.kind === "fair_value_gap" && fact.timeframe === "5m"
      )
      .sort((left: FvgFact, right: FvgFact) => {
        const timeOrder = Date.parse(left.payload.confirmationCandleTime) - Date.parse(right.payload.confirmationCandleTime);
        return timeOrder || left.factId.localeCompare(right.factId);
      });
    if (fvgFacts.length === 0) {
      const missingFactBlocker = contextBlockers.length === 0 ? [] : contextBlockers;
      return Object.freeze({
        strategyId: V2_IFVG_V3_STRATEGY_ID,
        profileId: V2_IFVG_V3_PROFILE_ID,
        adapterId: V2_IFVG_V3_ADAPTER_ID,
        adapterVersion: V2_IFVG_V3_ADAPTER_VERSION,
        inputContractVersion: V2_IFVG_V3_INPUT_CONTRACT_VERSION,
        contextArtifactId: context.contextArtifactId,
        sourceFingerprint: context.identity.source.sourceFingerprint,
        artifacts: Object.freeze([]),
        diagnostics: Object.freeze({
          status: contextBlockers.length ? "blocked" : "eligible",
          blockers: uniqueSorted(missingFactBlocker),
          warnings: Object.freeze([]),
          limitations: Object.freeze([])
        }),
        shadowOnly: true,
        authority: V2_AUTHORITY_NONE
      });
    }

    const artifacts = Object.freeze(await Promise.all(
      fvgFacts.map((fact: FvgFact) => artifactFor(context, fact))
    ));
    const invertedArtifacts = artifacts.filter((artifact) => artifact.detectionFlowState === "inversion_confirmed");
    const limitations = uniqueSorted(invertedArtifacts.flatMap((artifact) => artifact.limitationIds));
    const multipleSelectionLimitation = invertedArtifacts.length > 1
      ? ["multiple_inverted_fvg_selection_requires_legacy_geometry"]
      : [];
    const allLimitations = uniqueSorted([...limitations, ...multipleSelectionLimitation]);

    return Object.freeze({
      strategyId: V2_IFVG_V3_STRATEGY_ID,
      profileId: V2_IFVG_V3_PROFILE_ID,
      adapterId: V2_IFVG_V3_ADAPTER_ID,
      adapterVersion: V2_IFVG_V3_ADAPTER_VERSION,
      inputContractVersion: V2_IFVG_V3_INPUT_CONTRACT_VERSION,
      contextArtifactId: context.contextArtifactId,
      sourceFingerprint: context.identity.source.sourceFingerprint,
      artifacts,
      diagnostics: Object.freeze({
        status: contextBlockers.length
          ? "blocked"
          : allLimitations.length
            ? "insufficient_data"
            : "eligible",
        blockers: uniqueSorted(contextBlockers),
        warnings: Object.freeze([]),
        limitations: allLimitations
      }),
      shadowOnly: true,
      authority: V2_AUTHORITY_NONE
    });
  }
});

export const detectV2IfvgV3Shadow = (context: Readonly<V2CanonicalMarketState>) =>
  V2IfvgV3Adapter.detect(context);
