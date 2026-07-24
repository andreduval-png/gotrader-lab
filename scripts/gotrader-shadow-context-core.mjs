import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { stableHash } from "./gotrader-continuous-feed-core.mjs";
import { readJsonFile, writeJsonAtomic } from "./gotrader-runtime-io.mjs";

export const SHADOW_CONTEXT_RUNTIME_VERSION =
  "gotrader-shadow-context-runtime-v1";
export const shadowContextAuthority = Object.freeze({
  executionAuthority: "none",
  brokerAuthority: "none",
  readinessOverrideAuthority: "none"
});
const requiredTimeframes = Object.freeze(["5m", "15m", "1h", "4h", "1d"]);

const compactContextArtifact = ({ cycleId, event, context, windows }) => {
  const factKinds = Object.fromEntries(
    [...new Set(context.facts.map((fact) => fact.kind))]
      .sort()
      .map((kind) => [
        kind,
        context.facts.filter((fact) => fact.kind === kind).length
      ])
  );
  const status =
    context.diagnostics.status === "blocked" ? "blocked" : "completed";
  return Object.freeze({
    artifactId: `shadow_context_${stableHash({
      cycleId,
      contextArtifactId: context.contextArtifactId
    })}`,
    artifactVersion: SHADOW_CONTEXT_RUNTIME_VERSION,
    cycleId,
    triggerEventId: event.eventId,
    triggerCloseId: event.candleIdentity,
    timeVerificationArtifactId: event.timeVerificationArtifactId,
    generatedAtUtc: new Date().toISOString(),
    requestedSymbol: event.requestedSymbol,
    brokerSymbol: event.brokerSymbol,
    triggerTimeframe: event.timeframe,
    sourceProvider: event.sourceProvider,
    sourceFingerprint: event.sourceFingerprint,
    sourceIdentity: {
      provider: event.sourceProvider,
      sourceFingerprint: event.sourceFingerprint,
      timeVerificationArtifactId: event.timeVerificationArtifactId,
      timeContractVersion: event.timeContractVersion,
      timeNormalizationPolicyId:
        windows[0]?.identity.timeNormalizationPolicyId
    },
    observedMarketTime: event.observedMarketTime,
    contextArtifactId: context.contextArtifactId,
    contextSchemaVersion: context.contextSchemaVersion,
    contextPolicyVersion: context.contextPolicyVersion,
    sessionCalendarVersion: context.sessionCalendarVersion,
    inputWindowIdentityHashes: windows.map(
      (window) => window.identity.identityHash
    ),
    windowIdentities: windows.map((window) => {
      const timeframe = Object.keys(
        window.identity.candleCountByTimeframe
      )[0];
      return {
        timeframe,
        firstCandleTimeUtc: window.candles[0]?.openTime,
        lastCandleTimeUtc: window.candles.at(-1)?.closeTime,
        candleCount: window.candles.length,
        windowFingerprint: window.identity.identityHash
      };
    }),
    candleCountByTimeframe: Object.fromEntries(
      windows.map((window) => [
        Object.keys(window.identity.candleCountByTimeframe)[0],
        window.candles.length
      ])
    ),
    factCount: context.facts.length,
    factKinds,
    status,
    blockers: context.diagnostics.blockers,
    warnings: context.diagnostics.warnings,
    comparisonEligible: context.diagnostics.comparisonEligible,
    shadowOnly: true,
    rawCandlesPersisted: false,
    rawFactsPersisted: false,
    canCreateEvidence: false,
    evidenceCreated: false,
    readinessChanged: false,
    productionAdoptionAllowed: false,
    ...shadowContextAuthority
  });
};

export async function loadShadowContextDependencies({ repoRoot, outRoot }) {
  const { compileTypescriptModules } = await import(
    "./v2-baseline/compile-typescript-modules.mjs"
  );
  const sourceFiles = [
    "src/lib/v2/authority/v2Authority.ts",
    "src/lib/v2/serialization/canonicalSerialization.ts",
    "src/lib/v2/identity/v2IdentityTypes.ts",
    "src/lib/v2/identity/v2Identity.ts",
    "src/lib/v2/candles/v2CandleTypes.ts",
    "src/lib/v2/candles/v2Timeframe.ts",
    "src/lib/v2/candles/v2CandleValidation.ts",
    "src/lib/v2/candles/v2CandleWindowBuilder.ts",
    "src/lib/v2/context/v2ContextTypes.ts",
    "src/lib/v2/context/v2ContextIdentity.ts",
    "src/lib/v2/context/v2ContextEligibility.ts",
    "src/lib/v2/context/v2SessionOpeningFactEngine.ts",
    "src/lib/v2/context/v2DealingRangeLiquidityFactEngine.ts",
    "src/lib/v2/context/v2DisplacementFvgFactEngine.ts",
    "src/lib/v2/context/v2HigherTimeframeBiasFactEngine.ts",
    "src/lib/v2/context/v2ContextBuilder.ts"
  ].map((file) => path.join(repoRoot, file));
  compileTypescriptModules({ files: sourceFiles, outRoot });
  const load = (name) =>
    import(pathToFileURL(path.join(outRoot, `${name}.mjs`)).href);
  const [identity, candleWindow, context] = await Promise.all([
    load("v2Identity"),
    load("v2CandleWindowBuilder"),
    load("v2ContextBuilder")
  ]);
  return Object.freeze({
    createSourceIdentity: identity.createV2SourceIdentity,
    buildCanonicalWindow: candleWindow.buildV2CanonicalCandleWindow,
    buildCanonicalContext: context.buildV2CanonicalMarketContext
  });
}

export async function createShadowContextController({
  contextRoot,
  fetchWindows,
  dependencies,
  maximumArtifacts = 1_000
}) {
  const stateFile = path.join(contextRoot, "state.json");
  const artifactsFile = path.join(contextRoot, "artifacts.json");
  const controlFile = path.join(contextRoot, "control.json");
  await fs.mkdir(contextRoot, { recursive: true });
  const stateExists = await fs
    .access(stateFile)
    .then(() => true)
    .catch(() => false);
  const loadedState = await readJsonFile(stateFile);
  let state = loadedState ?? {
    version: 1,
    paused: false,
    completedCycleIds: [],
    completedCount: 0,
    blockedCount: 0
  };
  const stateCorrupt = stateExists && !loadedState;
  let artifactLedger = (await readJsonFile(artifactsFile))?.artifacts;
  if (!Array.isArray(artifactLedger)) artifactLedger = [];
  let appliedControlRevision;

  const persistState = async () => {
    await writeJsonAtomic(stateFile, {
      ...state,
      completedCycleIds: [...new Set(state.completedCycleIds)].slice(-10_000),
      checkpointedAt: new Date().toISOString(),
      ...shadowContextAuthority
    });
  };

  const status = () => ({
    serviceVersion: SHADOW_CONTEXT_RUNTIME_VERSION,
    state: stateCorrupt
      ? "blocked"
      : state.paused
        ? "paused"
        : "running",
    artifactCount: artifactLedger.length,
    completedCount: Number(state.completedCount ?? 0),
    blockedCount: Number(state.blockedCount ?? 0),
    lastOutcome: state.lastOutcome,
    blockers: stateCorrupt ? ["shadow_context_state_corrupt"] : [],
    enabled: true,
    triggerScope: "MNQ/USTECH/5m candle_closed",
    inputTimeframes: requiredTimeframes,
    shadowOnly: true,
    rawCandlesPersisted: false,
    evidenceCreated: false,
    productionAdoptionAllowed: false,
    ...shadowContextAuthority
  });

  const applyControl = async () => {
    const control = await readJsonFile(controlFile);
    if (!control?.revision || control.revision === appliedControlRevision) return;
    if (control.desiredState === "paused") state.paused = true;
    if (control.desiredState === "running") state.paused = false;
    appliedControlRevision = control.revision;
    await persistState();
  };

  const handler = async ({ event, task }) => {
    await applyControl();
    const cycleId = `shadow_context_cycle_${stableHash({
      taskType: task.taskType,
      taskVersion: task.taskVersion,
      eventId: event.eventId,
      contextVersion: SHADOW_CONTEXT_RUNTIME_VERSION
    })}`;
    if (stateCorrupt) {
      return {
        status: "blocked",
        blockers: ["shadow_context_state_corrupt"],
        outputArtifactIds: []
      };
    }
    if (state.paused) {
      return {
        status: "blocked",
        blockers: ["shadow_context_paused"],
        outputArtifactIds: []
      };
    }
    if (state.completedCycleIds.includes(cycleId)) {
      return {
        status: state.lastOutcome?.status ?? "completed",
        blockers: state.lastOutcome?.blockers ?? [],
        outputArtifactIds: state.lastOutcome?.artifactId
          ? [state.lastOutcome.artifactId]
          : []
      };
    }
    const eventBlockers = [];
    if (
      event.type !== "candle_closed" ||
      event.requestedSymbol !== "MNQ" ||
      event.brokerSymbol !== "USTECH" ||
      event.timeframe !== "5m"
    ) {
      eventBlockers.push("shadow_context_trigger_scope_invalid");
    }
    if (!event.timeVerificationArtifactId) {
      eventBlockers.push("time_verification_artifact_missing");
    }
    let payload;
    if (!eventBlockers.length) {
      payload = await fetchWindows({
        requestedSymbol: event.requestedSymbol,
        brokerSymbol: event.brokerSymbol,
        timeframes: requiredTimeframes,
        asOf: event.observedMarketTime
      });
      if (payload.timeContract?.eligible !== true) {
        eventBlockers.push("current_live_time_verification_not_eligible");
      }
      if (payload.timeContract?.verificationProofState !== "fresh") {
        eventBlockers.push("current_live_time_verification_not_fresh");
      }
      if (
        payload.timeContract?.verificationArtifactId !==
        event.timeVerificationArtifactId
      ) {
        eventBlockers.push("time_verification_artifact_mismatch");
      }
    }

    let artifact;
    if (!eventBlockers.length) {
      const source = dependencies.createSourceIdentity({
        sourceId: `mt5:${event.brokerSymbol}:runtime-a3`,
        provider: "mt5_read_only",
        requestedSymbol: event.requestedSymbol,
        brokerSymbol: event.brokerSymbol,
        sourceFingerprint: event.sourceFingerprint,
        sourceKind: "mt5_read_only"
      });
      const timeEligibility = Object.freeze({
        currentLiveEligible: true,
        historicalEligible: false,
        boundedHistoricalContextEligible:
          payload.hydration?.status === "ready" &&
          payload.hydration?.boundedHistoricalContextEligible === true,
        boundedHistoricalContextArtifactId:
          payload.hydration?.hydrationFingerprint,
        verificationScope: "current_live",
        verifiedAtUtc: payload.timeContract.verificationGeneratedAtUtc,
        currentLiveValidUntilUtc:
          payload.timeContract.verificationExpiresAtUtc,
        offsetRegimeStartUtc:
          payload.timeContract.offsetRegimeStartUtc ??
          payload.timeContract.verificationGeneratedAtUtc,
        blockers: Object.freeze([]),
        warnings: Object.freeze([
          "current_live_time_verified_historical_time_unverified"
        ])
      });
      const windows = [];
      for (const timeframe of requiredTimeframes) {
        const candles = payload.windows?.[timeframe] ?? [];
        if (!candles.length) {
          eventBlockers.push(`insufficient_context_window:${timeframe}`);
          continue;
        }
        windows.push(
          await dependencies.buildCanonicalWindow({
            adapterId: "gotrader-runtime-a3-rolling-store",
            adapterVersion: SHADOW_CONTEXT_RUNTIME_VERSION,
            asOf: event.observedMarketTime,
            closurePolicy: "explicit_closed",
            legacyCandles: candles.map((candle) => ({
              openTime: candle.candleOpenTime,
              closeTime: candle.candleCloseTime,
              open: candle.open,
              high: candle.high,
              low: candle.low,
              close: candle.close,
              volume: candle.volume ?? candle.tickVolume,
              isClosed: true
            })),
            query: {
              source,
              timeframe,
              limit: Math.max(1, candles.length),
              closedOnly: true,
              purpose: "context_shadow"
            },
            source,
            sourceStale: false,
            sourceWarnings: [],
            timeContractId: payload.timeContract.verificationArtifactId,
            timeContractVersion: payload.timeContract.version,
            timeContractVerificationStatus: "verified",
            terminalClockClassificationVersion:
              payload.timeContract.terminalClockClassificationVersion,
            timeVerificationScope: "current_live",
            sourceTimeEligibility: timeEligibility
          })
        );
      }
      if (eventBlockers.length) {
        artifact = Object.freeze({
          artifactId: `shadow_context_${stableHash({
            cycleId,
            eventBlockers
          })}`,
          artifactVersion: SHADOW_CONTEXT_RUNTIME_VERSION,
          cycleId,
          triggerEventId: event.eventId,
          triggerCloseId: event.candleIdentity,
          requestedSymbol: event.requestedSymbol,
          brokerSymbol: event.brokerSymbol,
          triggerTimeframe: event.timeframe,
          timeVerificationArtifactId: event.timeVerificationArtifactId,
          status: "blocked",
          blockers: [...new Set(eventBlockers)],
          warnings: [],
          shadowOnly: true,
          rawCandlesPersisted: false,
          rawFactsPersisted: false,
          canCreateEvidence: false,
          evidenceCreated: false,
          readinessChanged: false,
          productionAdoptionAllowed: false,
          ...shadowContextAuthority
        });
      } else {
        const context = await dependencies.buildCanonicalContext({
        source,
        requestedSymbol: event.requestedSymbol,
        brokerSymbol: event.brokerSymbol,
        asOfMarketTime: event.observedMarketTime,
        requiredTimeframes,
        windows,
        purpose: "current_live_shadow",
        requestedFactFamilies: [
          "session",
          "opening_price",
          "dealing_range",
          "liquidity",
          "displacement",
          "fair_value_gap",
          "higher_timeframe_bias"
        ],
        builtAt: event.receivedAt
        });
        artifact = compactContextArtifact({
          cycleId,
          event,
          context,
          windows
        });
      }
    } else {
      artifact = Object.freeze({
        artifactId: `shadow_context_${stableHash({ cycleId, eventBlockers })}`,
        artifactVersion: SHADOW_CONTEXT_RUNTIME_VERSION,
        cycleId,
        triggerEventId: event.eventId,
        triggerCloseId: event.candleIdentity,
        requestedSymbol: event.requestedSymbol,
        brokerSymbol: event.brokerSymbol,
        triggerTimeframe: event.timeframe,
        timeVerificationArtifactId: event.timeVerificationArtifactId,
        status: "blocked",
        blockers: eventBlockers,
        warnings: [],
        shadowOnly: true,
        rawCandlesPersisted: false,
        rawFactsPersisted: false,
        canCreateEvidence: false,
        evidenceCreated: false,
        readinessChanged: false,
        productionAdoptionAllowed: false,
        ...shadowContextAuthority
      });
    }
    artifactLedger.push(artifact);
    if (artifactLedger.length > maximumArtifacts) {
      artifactLedger = artifactLedger.slice(-maximumArtifacts);
    }
    await writeJsonAtomic(artifactsFile, {
      version: 1,
      artifacts: artifactLedger,
      updatedAt: new Date().toISOString(),
      rawCandlesPersisted: false,
      ...shadowContextAuthority
    });
    state.completedCycleIds.push(cycleId);
    if (artifact.status === "completed") state.completedCount += 1;
    else state.blockedCount += 1;
    state.lastOutcome = {
      artifactId: artifact.artifactId,
      cycleId,
      status: artifact.status,
      blockers: artifact.blockers,
      completedAt: new Date().toISOString()
    };
    await persistState();
    return {
      status: artifact.status,
      blockers: artifact.blockers,
      warnings: artifact.warnings,
      outputArtifactIds: [artifact.artifactId],
      resultArtifact: artifact
    };
  };

  return Object.freeze({
    handler,
    status,
    applyControl,
    artifacts: () => artifactLedger.map((artifact) => ({ ...artifact }))
  });
}
