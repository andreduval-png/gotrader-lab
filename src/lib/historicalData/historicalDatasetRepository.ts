import { canonicalHash, canonicalSerialize } from "../canonical/canonicalValueSerialization";
import {
  HISTORICAL_DATASET_AUTHORITY_NONE,
  assertHistoricalDatasetAuthority
} from "./historicalDatasetAuthority";
import {
  deriveHistoricalDatasetRequestIdentity,
  historicalTimeframeMilliseconds
} from "./historicalDatasetContracts";
import {
  buildHistoricalDatasetManifest,
  validateHistoricalDatasetManifest,
  type HistoricalTimeframeSealInput
} from "./historicalDatasetIdentity";
import {
  buildHistoricalIntegrityLedger,
  normalizeHistoricalSourceCandles
} from "./historicalDatasetIntegrity";
import {
  buildHistoricalDatasetLineageNode,
  buildHistoricalDatasetParentEdges
} from "./historicalDatasetLineage";
import {
  deriveHistoricalTimeframe,
  selectHistoricalParentTimeframe
} from "./historicalTimeframeBuilder";
import {
  HISTORICAL_CHECKPOINT_SCHEMA_ID,
  HISTORICAL_CHECKPOINT_SCHEMA_VERSION,
  HISTORICAL_PARTITION_SCHEMA_ID,
  HISTORICAL_PARTITION_SCHEMA_VERSION,
  HISTORICAL_STORAGE_ENVELOPE_SCHEMA_VERSION,
  type HistoricalCheckpointTimeframeState,
  type HistoricalDatasetCreationResult,
  type HistoricalDatasetProgressEvent,
  type HistoricalDatasetManifest,
  type HistoricalDatasetProvider,
  type HistoricalDatasetRepositoryOptions,
  type HistoricalDatasetRequest,
  type HistoricalDatasetVerification,
  type HistoricalIngestionCheckpoint,
  type HistoricalIntegrityLedger,
  type HistoricalNormalizedCandle,
  type HistoricalPartitionPayload,
  type HistoricalProviderDescription,
  type HistoricalStorageArtifactKind,
  type HistoricalStorageEnvelope,
  type HistoricalTimeframe
} from "./historicalDatasetTypes";

const hashPattern = /^sha256:[0-9a-f]{64}$/;
const retryableCodes = new Set(["EAGAIN", "EACCES", "EBUSY", "EPERM"]);

const key = (identity: string) => {
  if (!hashPattern.test(identity)) throw new HistoricalDatasetRepositoryError(["historical_storage_identity_invalid"]);
  return identity.replace(":", "_");
};

const unique = (values: readonly string[]) =>
  Object.freeze([...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right)));

const pathFor = (kind: HistoricalStorageArtifactKind, identity: string) => {
  const directories: Record<HistoricalStorageArtifactKind, string> = {
    request: "requests",
    checkpoint: "checkpoints",
    partition: "partitions",
    integrity: "integrity",
    manifest: "manifests",
    lineage: "lineage"
  };
  return `${directories[kind]}/${key(identity)}.json`;
};

const partitionCore = (value: Readonly<HistoricalPartitionPayload>) => {
  const { partitionId, ...core } = value;
  return core;
};

const compactSourceCandle = (value: {
  readonly providerOpenTime: string | number;
  readonly providerCloseTime?: string | number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume?: number;
  readonly spreadPoints?: number;
  readonly isClosed?: boolean;
}) => ({
  providerOpenTime: value.providerOpenTime,
  ...(value.providerCloseTime === undefined ? {} : { providerCloseTime: value.providerCloseTime }),
  open: value.open,
  high: value.high,
  low: value.low,
  close: value.close,
  ...(value.volume === undefined ? {} : { volume: value.volume }),
  ...(value.spreadPoints === undefined ? {} : { spreadPoints: value.spreadPoints }),
  ...(value.isClosed === undefined ? {} : { isClosed: value.isClosed })
});

const replaceState = (
  states: readonly Readonly<HistoricalCheckpointTimeframeState>[],
  next: Readonly<HistoricalCheckpointTimeframeState>
) => Object.freeze(states.map((state) => state.timeframe === next.timeframe ? next : state));

export class HistoricalDatasetRepositoryError extends Error {
  readonly blockers: readonly string[];

  constructor(blockers: readonly string[]) {
    const normalized = unique(blockers);
    super(`Historical dataset repository blocked: ${normalized.join(", ")}`);
    this.name = "HistoricalDatasetRepositoryError";
    this.blockers = normalized;
  }
}

export class HistoricalDatasetRepository {
  readonly #options: Required<Pick<HistoricalDatasetRepositoryOptions,
    "maximumPagesPerTimeframe" | "maximumPartitions" |
    "maximumAcceptedCandles" | "atomicWriteRetries" | "now"
  >> & Pick<HistoricalDatasetRepositoryOptions, "storage" | "onProgress">;

  constructor(options: Readonly<HistoricalDatasetRepositoryOptions>) {
    if (!options?.storage) throw new HistoricalDatasetRepositoryError(["historical_storage_missing"]);
    this.#options = Object.freeze({
      storage: options.storage,
      now: options.now ?? (() => new Date().toISOString()),
      maximumPagesPerTimeframe: options.maximumPagesPerTimeframe ?? 20_000,
      maximumPartitions: options.maximumPartitions ?? 20_000,
      maximumAcceptedCandles: options.maximumAcceptedCandles ?? 2_000_000,
      atomicWriteRetries: options.atomicWriteRetries ?? 4,
      onProgress: options.onProgress
    });
    if (!Number.isInteger(this.#options.maximumPagesPerTimeframe) || this.#options.maximumPagesPerTimeframe <= 0) {
      throw new HistoricalDatasetRepositoryError(["historical_page_bound_invalid"]);
    }
    if (
      !Number.isInteger(this.#options.maximumPartitions) ||
      this.#options.maximumPartitions <= 0
    ) throw new HistoricalDatasetRepositoryError(["historical_partition_bound_invalid"]);
    if (
      !Number.isInteger(this.#options.maximumAcceptedCandles) ||
      this.#options.maximumAcceptedCandles <= 0
    ) throw new HistoricalDatasetRepositoryError(["historical_candle_bound_invalid"]);
  }

  async createDataset(
    requestInput: Readonly<HistoricalDatasetRequest>,
    provider: Readonly<HistoricalDatasetProvider>
  ): Promise<Readonly<HistoricalDatasetCreationResult>> {
    const providerDescription = await provider.describe();
    this.#validateProvider(providerDescription);
    const identity = await deriveHistoricalDatasetRequestIdentity(requestInput, providerDescription);
    const request = identity.normalizedRequest;
    const nowUtc = new Date(Date.parse(this.#options.now())).toISOString();
    if (Date.parse(request.endUtc) > Date.parse(nowUtc)) {
      throw new HistoricalDatasetRepositoryError(["historical_request_end_is_in_future"]);
    }
    await this.#writeImmutable("request", identity.requestId, Object.freeze({
      requestId: identity.requestId,
      requestHash: identity.requestHash,
      requestCore: identity.requestCore,
      provider: providerDescription,
      authority: HISTORICAL_DATASET_AUTHORITY_NONE
    }));
    const existing = await this.#readEnvelope<HistoricalIngestionCheckpoint>(
      pathFor("checkpoint", identity.requestId),
      "checkpoint"
    );
    const existingCheckpoint = existing ? await this.#upgradeCheckpoint(existing.payload) : undefined;
    if (existingCheckpoint?.requestHash !== undefined && existingCheckpoint.requestHash !== identity.requestHash) {
      throw new HistoricalDatasetRepositoryError(["historical_checkpoint_request_mismatch"]);
    }
    if (existingCheckpoint?.phase === "complete" && existingCheckpoint.completedDatasetId) {
      const manifest = await this.readManifest(existingCheckpoint.completedDatasetId);
      await this.#emitProgress({
        eventType: "dataset_coalesced",
        requestId: identity.requestId,
        pagesCompleted: existingCheckpoint.timeframes.reduce((sum, state) => sum + state.pageCount, 0),
        partitionCount: manifest.timeframes.reduce((sum, state) => sum + state.partitionIds.length, 0),
        barsAccepted: existingCheckpoint.timeframes.reduce((sum, state) => sum + state.acceptedCandleCount, 0),
        barsRejected: existingCheckpoint.timeframes.reduce((sum, state) => sum + state.rejectedEventCount, 0),
        datasetId: manifest.datasetId
      });
      return Object.freeze({
        action: "coalesced",
        manifest,
        verification: await this.verifyDataset(manifest.datasetId)
      });
    }
    const action = existingCheckpoint ? "resumed" as const : "created" as const;
    let checkpoint = existingCheckpoint ?? Object.freeze({
      schemaId: HISTORICAL_CHECKPOINT_SCHEMA_ID as typeof HISTORICAL_CHECKPOINT_SCHEMA_ID,
      version: HISTORICAL_CHECKPOINT_SCHEMA_VERSION as typeof HISTORICAL_CHECKPOINT_SCHEMA_VERSION,
      requestId: identity.requestId,
      requestHash: identity.requestHash,
      phase: "fetching" as const,
      timeframes: Object.freeze(request.sourceTimeframes.map((timeframe) => Object.freeze({
        timeframe,
        phase: "pending" as const,
        pageCount: 0,
        acceptedCandleCount: 0,
        rejectedEventCount: 0,
        partitionIds: Object.freeze([])
      }))),
      blockers: Object.freeze([]),
      authority: HISTORICAL_DATASET_AUTHORITY_NONE
    });
    await this.#writeCheckpoint(checkpoint);

    for (const timeframe of request.sourceTimeframes) {
      let state: Readonly<HistoricalCheckpointTimeframeState> | undefined =
        checkpoint.timeframes.find((value) => value.timeframe === timeframe);
      if (!state) throw new HistoricalDatasetRepositoryError(["historical_checkpoint_timeframe_missing"]);
      while (state.phase !== "complete") {
        if (state.pageCount >= this.#options.maximumPagesPerTimeframe) {
          throw new HistoricalDatasetRepositoryError(["historical_page_bound_exceeded"]);
        }
        if (
          checkpoint.timeframes.reduce((sum, item) => sum + item.partitionIds.length, 0) >=
          this.#options.maximumPartitions
        ) {
          throw new HistoricalDatasetRepositoryError(["historical_partition_bound_exceeded"]);
        }
        const cursor = state.pageCount ? state.nextCursor : undefined;
        const page = await provider.fetchPage(Object.freeze({
          requestedSymbol: request.requestedSymbol,
          brokerSymbol: request.brokerSymbol,
          timeframe,
          startUtc: request.startUtc,
          endUtc: request.endUtc,
          ...(cursor ? { cursor } : {}),
          limit: request.pageSize
        }));
        this.#validatePage(page, providerDescription, request, timeframe, cursor);
        if (page.nextCursor && page.nextCursor === cursor) {
          throw new HistoricalDatasetRepositoryError(["historical_provider_cursor_did_not_advance"]);
        }
        const sourcePageCore = {
          providerId: page.providerId,
          providerVersion: page.providerVersion,
          requestedSymbol: page.requestedSymbol,
          brokerSymbol: page.brokerSymbol,
          timeframe: page.timeframe,
          ...(page.cursor ? { cursor: page.cursor } : {}),
          ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
          candles: page.candles.map(compactSourceCandle),
          warnings: unique(page.warnings),
          authority: HISTORICAL_DATASET_AUTHORITY_NONE
        };
        const sourcePageFingerprint = await canonicalHash(sourcePageCore);
        if (page.sourcePageFingerprint && page.sourcePageFingerprint !== sourcePageFingerprint) {
          throw new HistoricalDatasetRepositoryError(["historical_source_page_fingerprint_mismatch"]);
        }
        const normalized = await normalizeHistoricalSourceCandles({
          candles: page.candles,
          timeframe,
          timePolicy: request.timeNormalizationPolicy,
          startUtc: request.startUtc,
          endUtc: request.endUtc,
          nowUtc
        });
        const partitionWithoutId: Omit<HistoricalPartitionPayload, "partitionId"> = {
          schemaId: HISTORICAL_PARTITION_SCHEMA_ID as typeof HISTORICAL_PARTITION_SCHEMA_ID,
          version: HISTORICAL_PARTITION_SCHEMA_VERSION as typeof HISTORICAL_PARTITION_SCHEMA_VERSION,
          requestId: identity.requestId,
          providerId: providerDescription.providerId,
          providerVersion: providerDescription.providerVersion,
          sourceFingerprint: providerDescription.sourceFingerprint,
          requestedSymbol: request.requestedSymbol,
          brokerSymbol: request.brokerSymbol,
          timeframe,
          pageOrdinal: state.pageCount,
          ...(cursor ? { sourceCursor: cursor } : {}),
          ...(page.nextCursor ? { sourceNextCursor: page.nextCursor } : {}),
          sourcePageFingerprint,
          candles: normalized.candles,
          rejectedEvents: normalized.events,
          warnings: unique(page.warnings),
          authority: HISTORICAL_DATASET_AUTHORITY_NONE
        };
        if (
          checkpoint.timeframes.reduce((sum, item) => sum + item.acceptedCandleCount, 0) +
          normalized.candles.length > this.#options.maximumAcceptedCandles
        ) throw new HistoricalDatasetRepositoryError(["historical_candle_bound_exceeded"]);
        const partition: Readonly<HistoricalPartitionPayload> = Object.freeze({
          ...partitionWithoutId,
          partitionId: await canonicalHash(partitionWithoutId)
        });
        await this.#writeImmutable("partition", partition.partitionId, partition);
        state = Object.freeze({
          timeframe,
          phase: page.nextCursor ? "fetching" as const : "complete" as const,
          ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
          pageCount: state.pageCount + 1,
          acceptedCandleCount: state.acceptedCandleCount + normalized.candles.length,
          rejectedEventCount: state.rejectedEventCount + normalized.events.length,
          partitionIds: Object.freeze([...state.partitionIds, partition.partitionId])
        });
        checkpoint = Object.freeze({
          ...checkpoint,
          phase: "fetching" as const,
          timeframes: replaceState(checkpoint.timeframes, state)
        });
        await this.#writeCheckpoint(checkpoint);
        await this.#emitProgress({
          eventType: "page_committed",
          requestId: identity.requestId,
          timeframe,
          pagesCompleted: checkpoint.timeframes.reduce((sum, item) => sum + item.pageCount, 0),
          partitionCount: checkpoint.timeframes.reduce((sum, item) => sum + item.partitionIds.length, 0),
          barsAccepted: checkpoint.timeframes.reduce((sum, item) => sum + item.acceptedCandleCount, 0),
          barsRejected: checkpoint.timeframes.reduce((sum, item) => sum + item.rejectedEventCount, 0)
        });
      }
    }

    checkpoint = Object.freeze({ ...checkpoint, phase: "sealing" as const });
    await this.#writeCheckpoint(checkpoint);
    await this.#emitProgress({
      eventType: "sealing_started",
      requestId: identity.requestId,
      pagesCompleted: checkpoint.timeframes.reduce((sum, state) => sum + state.pageCount, 0),
      partitionCount: checkpoint.timeframes.reduce((sum, state) => sum + state.partitionIds.length, 0),
      barsAccepted: checkpoint.timeframes.reduce((sum, state) => sum + state.acceptedCandleCount, 0),
      barsRejected: checkpoint.timeframes.reduce((sum, state) => sum + state.rejectedEventCount, 0)
    });
    const seals: HistoricalTimeframeSealInput[] = [];
    const available = new Map<HistoricalTimeframe, HistoricalTimeframeSealInput>();
    for (const timeframe of request.sourceTimeframes) {
      const state = checkpoint.timeframes.find((value) => value.timeframe === timeframe)!;
      const partitions = await Promise.all(state.partitionIds.map((partitionId) => this.#readPartition(partitionId)));
      const integrity = await buildHistoricalIntegrityLedger({
        requestId: identity.requestId,
        timeframe,
        candles: partitions.flatMap((partition) => partition.candles),
        sourceEvents: partitions.flatMap((partition) => partition.rejectedEvents),
        calendar: request.calendar
      });
      await this.#writeImmutable("integrity", integrity.ledger.ledgerId, integrity.ledger);
      const seal = Object.freeze({
        timeframe,
        candles: integrity.candles,
        partitionIds: state.partitionIds,
        integrityLedger: integrity.ledger
      });
      seals.push(seal);
      available.set(timeframe, seal);
    }
    let totalPartitionCount = checkpoint.timeframes.reduce(
      (sum, state) => sum + state.partitionIds.length,
      0
    );
    for (const timeframe of request.derivedTimeframes ?? []) {
      if (totalPartitionCount >= this.#options.maximumPartitions) {
        throw new HistoricalDatasetRepositoryError(["historical_partition_bound_exceeded"]);
      }
      const parentTimeframe = selectHistoricalParentTimeframe([...available.keys()], timeframe);
      if (!parentTimeframe) {
        throw new HistoricalDatasetRepositoryError([`historical_${timeframe}_parent_timeframe_missing`]);
      }
      const parent = available.get(parentTimeframe)!;
      const derived = await deriveHistoricalTimeframe({
        parentDatasetRequestId: identity.requestId,
        parentTimeframe,
        parentPartitionIds: parent.partitionIds,
        targetTimeframe: timeframe,
        candles: parent.candles,
        rangeStartUtc: request.startUtc,
        rangeEndUtc: request.endUtc,
        calendar: request.calendar,
        alignment: request.timeframeAlignment
      });
      const derivedPartitionWithoutId = {
        schemaId: HISTORICAL_PARTITION_SCHEMA_ID as typeof HISTORICAL_PARTITION_SCHEMA_ID,
        version: HISTORICAL_PARTITION_SCHEMA_VERSION as typeof HISTORICAL_PARTITION_SCHEMA_VERSION,
        requestId: identity.requestId,
        providerId: providerDescription.providerId,
        providerVersion: providerDescription.providerVersion,
        sourceFingerprint: providerDescription.sourceFingerprint,
        requestedSymbol: request.requestedSymbol,
        brokerSymbol: request.brokerSymbol,
        timeframe,
        pageOrdinal: 0,
        sourcePageFingerprint: derived.lineage.lineageId,
        candles: derived.candles,
        rejectedEvents: Object.freeze([]),
        warnings: derived.lineage.warnings,
        derivedFrom: derived.lineage,
        authority: HISTORICAL_DATASET_AUTHORITY_NONE
      };
      const derivedPartition = Object.freeze({
        ...derivedPartitionWithoutId,
        partitionId: await canonicalHash(derivedPartitionWithoutId)
      });
      await this.#writeImmutable("partition", derivedPartition.partitionId, derivedPartition);
      await this.#writeImmutable("lineage", derived.lineage.lineageId, derived.lineage);
      const integrity = await buildHistoricalIntegrityLedger({
        requestId: identity.requestId,
        timeframe,
        candles: derived.candles,
        sourceEvents: Object.freeze([]),
        calendar: request.calendar
      });
      await this.#writeImmutable("integrity", integrity.ledger.ledgerId, integrity.ledger);
      const seal = Object.freeze({
        timeframe,
        candles: integrity.candles,
        partitionIds: Object.freeze([derivedPartition.partitionId]),
        integrityLedger: integrity.ledger,
        derivedLineage: derived.lineage
      });
      seals.push(seal);
      available.set(timeframe, seal);
      totalPartitionCount += 1;
    }
    const manifest = await buildHistoricalDatasetManifest({
      requestId: identity.requestId,
      request,
      provider: providerDescription,
      timeframes: seals
    });
    await this.#writeImmutable("manifest", manifest.datasetId, manifest);
    const lineageNode = await buildHistoricalDatasetLineageNode(manifest);
    await this.#writeImmutable("lineage", lineageNode.lineageNodeKey, lineageNode);
    const parentManifests = await Promise.all(
      manifest.parentDatasetIds.map((datasetId) => this.readManifest(datasetId))
    );
    const parentEdges = await buildHistoricalDatasetParentEdges({ child: manifest, parents: parentManifests });
    await Promise.all(parentEdges.map((edge) => this.#writeImmutable("lineage", edge.edgeId, edge)));
    checkpoint = Object.freeze({
      ...checkpoint,
      phase: "complete" as const,
      completedDatasetId: manifest.datasetId,
      blockers: manifest.blockers
    });
    await this.#writeCheckpoint(checkpoint);
    await this.#emitProgress({
      eventType: "dataset_complete",
      requestId: identity.requestId,
      pagesCompleted: checkpoint.timeframes.reduce((sum, state) => sum + state.pageCount, 0),
      partitionCount: manifest.timeframes.reduce((sum, state) => sum + state.partitionIds.length, 0),
      barsAccepted: checkpoint.timeframes.reduce((sum, state) => sum + state.acceptedCandleCount, 0),
      barsRejected: checkpoint.timeframes.reduce((sum, state) => sum + state.rejectedEventCount, 0),
      datasetId: manifest.datasetId
    });
    return Object.freeze({ action, manifest, verification: await this.verifyDataset(manifest.datasetId) });
  }

  async #emitProgress(event: HistoricalDatasetProgressEvent) {
    await this.#options.onProgress?.(Object.freeze(event));
  }

  async #upgradeCheckpoint(
    checkpoint: Readonly<HistoricalIngestionCheckpoint>
  ): Promise<Readonly<HistoricalIngestionCheckpoint>> {
    const version = String((checkpoint as { version?: unknown }).version ?? "");
    const countersValid = checkpoint.timeframes.every((state) =>
      Number.isInteger(state.acceptedCandleCount) && state.acceptedCandleCount >= 0 &&
      Number.isInteger(state.rejectedEventCount) && state.rejectedEventCount >= 0);
    if (version === HISTORICAL_CHECKPOINT_SCHEMA_VERSION && countersValid) return checkpoint;
    if (version !== "bt1-v1" && version !== HISTORICAL_CHECKPOINT_SCHEMA_VERSION) {
      throw new HistoricalDatasetRepositoryError(["historical_checkpoint_schema_unsupported"]);
    }
    const timeframes = await Promise.all(checkpoint.timeframes.map(async (state) => {
      const partitions = await Promise.all(state.partitionIds.map((partitionId) => this.#readPartition(partitionId)));
      return Object.freeze({
        ...state,
        acceptedCandleCount: partitions.reduce((sum, partition) => sum + partition.candles.length, 0),
        rejectedEventCount: partitions.reduce((sum, partition) => sum + partition.rejectedEvents.length, 0)
      });
    }));
    const upgraded = Object.freeze({
      ...checkpoint,
      version: HISTORICAL_CHECKPOINT_SCHEMA_VERSION as typeof HISTORICAL_CHECKPOINT_SCHEMA_VERSION,
      timeframes: Object.freeze(timeframes)
    });
    await this.#writeCheckpoint(upgraded);
    return upgraded;
  }

  async readManifest(datasetId: string): Promise<Readonly<HistoricalDatasetManifest>> {
    const stored = await this.#readEnvelope<HistoricalDatasetManifest>(pathFor("manifest", datasetId), "manifest");
    if (!stored) throw new HistoricalDatasetRepositoryError(["historical_manifest_not_found"]);
    if (stored.payload.datasetId !== datasetId) {
      throw new HistoricalDatasetRepositoryError(["historical_manifest_storage_identity_mismatch"]);
    }
    return Object.freeze(stored.payload);
  }

  async readCandles(
    datasetId: string,
    timeframe: HistoricalTimeframe
  ): Promise<readonly Readonly<HistoricalNormalizedCandle>[]> {
    const manifest = await this.readManifest(datasetId);
    const entry = manifest.timeframes.find((value) => value.timeframe === timeframe);
    if (!entry) throw new HistoricalDatasetRepositoryError(["historical_manifest_timeframe_missing"]);
    const partitions = await Promise.all(entry.partitionIds.map((partitionId) => this.#readPartition(partitionId)));
    return this.#canonicalCandles(partitions.flatMap((partition) => partition.candles));
  }

  async verifyDataset(datasetId: string): Promise<Readonly<HistoricalDatasetVerification>> {
    const blockers: string[] = [];
    const warnings: string[] = [];
    let manifest: Readonly<HistoricalDatasetManifest>;
    try {
      manifest = await this.readManifest(datasetId);
    } catch (error) {
      return Object.freeze({
        status: "blocked",
        blockers: error instanceof HistoricalDatasetRepositoryError
          ? error.blockers
          : Object.freeze(["historical_manifest_read_failed"]),
        warnings: Object.freeze([])
      });
    }
    const manifestValidation = await validateHistoricalDatasetManifest(manifest);
    blockers.push(...manifestValidation.blockers);
    warnings.push(...manifestValidation.warnings);
    try {
      const expectedNode = await buildHistoricalDatasetLineageNode(manifest);
      const storedNode = await this.#readEnvelope<unknown>(
        pathFor("lineage", expectedNode.lineageNodeKey),
        "lineage"
      );
      if (!storedNode || canonicalSerialize(storedNode.payload) !== canonicalSerialize(expectedNode)) {
        blockers.push("historical_dataset_lineage_node_missing_or_mismatched");
      }
      const parentManifests = await Promise.all(
        manifest.parentDatasetIds.map((parentId) => this.readManifest(parentId))
      );
      const expectedEdges = await buildHistoricalDatasetParentEdges({ child: manifest, parents: parentManifests });
      for (const edge of expectedEdges) {
        const storedEdge = await this.#readEnvelope<unknown>(pathFor("lineage", edge.edgeId), "lineage");
        if (!storedEdge || canonicalSerialize(storedEdge.payload) !== canonicalSerialize(edge)) {
          blockers.push("historical_dataset_lineage_edge_missing_or_mismatched");
        }
      }
    } catch (error) {
      blockers.push(...(error instanceof HistoricalDatasetRepositoryError
        ? error.blockers
        : ["historical_dataset_lineage_verification_failed"]));
    }
    const checksumEntries: Array<{ timeframe: HistoricalTimeframe; timeframeChecksum: string; candleCount: number }> = [];
    for (const entry of manifest.timeframes) {
      const partitions: HistoricalPartitionPayload[] = [];
      for (const partitionId of entry.partitionIds) {
        try {
          partitions.push(await this.#readPartition(partitionId));
        } catch (error) {
          blockers.push(...(error instanceof HistoricalDatasetRepositoryError
            ? error.blockers
            : ["historical_partition_read_failed"]));
        }
      }
      const candles = this.#canonicalCandles(partitions.flatMap((partition) => partition.candles), blockers);
      const timeframeChecksum = await canonicalHash({
        normalizationVersion: manifest.normalizationVersion,
        timeframe: entry.timeframe,
        candles
      });
      if (timeframeChecksum !== entry.timeframeChecksum) blockers.push("historical_timeframe_checksum_mismatch");
      if (candles.length !== entry.candleCount) blockers.push("historical_timeframe_count_mismatch");
      const ledger = await this.#readEnvelope<HistoricalIntegrityLedger>(
        pathFor("integrity", entry.integrityLedgerId),
        "integrity"
      );
      if (!ledger || ledger.payload.ledgerId !== entry.integrityLedgerId) {
        blockers.push("historical_integrity_ledger_missing_or_mismatched");
      }
      checksumEntries.push({ timeframe: entry.timeframe, timeframeChecksum, candleCount: candles.length });
    }
    const datasetChecksum = await canonicalHash({
      normalizationVersion: manifest.normalizationVersion,
      timeframes: checksumEntries
    });
    if (datasetChecksum !== manifest.datasetChecksum) blockers.push("historical_dataset_checksum_mismatch");
    return Object.freeze({
      status: blockers.length ? "blocked" : "verified",
      ...(blockers.length ? {} : { manifest }),
      blockers: unique(blockers),
      warnings: unique(warnings)
    });
  }

  #validateProvider(provider: Readonly<HistoricalProviderDescription>) {
    assertHistoricalDatasetAuthority(provider.authority);
    if (!provider.providerId || !provider.providerVersion || !hashPattern.test(provider.sourceFingerprint)) {
      throw new HistoricalDatasetRepositoryError(["historical_provider_identity_invalid"]);
    }
    if (provider.readOnly !== true || provider.marketDataOnly !== true) {
      throw new HistoricalDatasetRepositoryError(["historical_provider_capability_invalid"]);
    }
    if (!Number.isInteger(provider.maximumPageCandles) || provider.maximumPageCandles <= 0) {
      throw new HistoricalDatasetRepositoryError(["historical_provider_page_bound_invalid"]);
    }
  }

  #validatePage(
    page: Awaited<ReturnType<HistoricalDatasetProvider["fetchPage"]>>,
    provider: Readonly<HistoricalProviderDescription>,
    request: Readonly<HistoricalDatasetRequest>,
    timeframe: HistoricalTimeframe,
    cursor?: string
  ) {
    assertHistoricalDatasetAuthority(page.authority);
    if (
      page.providerId !== provider.providerId ||
      page.providerVersion !== provider.providerVersion ||
      page.requestedSymbol !== request.requestedSymbol ||
      page.brokerSymbol !== request.brokerSymbol ||
      page.timeframe !== timeframe ||
      page.cursor !== cursor
    ) throw new HistoricalDatasetRepositoryError(["historical_provider_page_identity_mismatch"]);
    if (page.candles.length > request.pageSize) {
      throw new HistoricalDatasetRepositoryError(["historical_provider_page_size_exceeded"]);
    }
    if (page.nextCursor && !Number.isFinite(Date.parse(page.nextCursor))) {
      throw new HistoricalDatasetRepositoryError(["historical_provider_next_cursor_invalid"]);
    }
  }

  async #readPartition(partitionId: string) {
    const stored = await this.#readEnvelope<HistoricalPartitionPayload>(pathFor("partition", partitionId), "partition");
    if (!stored) throw new HistoricalDatasetRepositoryError(["historical_partition_not_found"]);
    if (stored.payload.partitionId !== partitionId) {
      throw new HistoricalDatasetRepositoryError(["historical_partition_storage_identity_mismatch"]);
    }
    const expectedId = await canonicalHash(partitionCore(stored.payload));
    if (expectedId !== partitionId) {
      throw new HistoricalDatasetRepositoryError(["historical_partition_identity_mismatch"]);
    }
    return stored.payload;
  }

  #canonicalCandles(
    candles: readonly Readonly<HistoricalNormalizedCandle>[],
    blockers?: string[]
  ) {
    const byOpen = new Map<string, HistoricalNormalizedCandle>();
    for (const candle of [...candles].sort(
      (left, right) => Date.parse(left.openTimeUtc) - Date.parse(right.openTimeUtc)
    )) {
      const previous = byOpen.get(candle.openTimeUtc);
      if (previous && canonicalSerialize(previous) !== canonicalSerialize(candle)) {
        blockers?.push("historical_partition_cross_conflict");
        if (!blockers) throw new HistoricalDatasetRepositoryError(["historical_partition_cross_conflict"]);
        continue;
      }
      if (!previous) byOpen.set(candle.openTimeUtc, candle);
    }
    return Object.freeze([...byOpen.values()]);
  }

  async #writeCheckpoint(checkpoint: Readonly<HistoricalIngestionCheckpoint>) {
    assertHistoricalDatasetAuthority(checkpoint.authority);
    await this.#writeEnvelope(pathFor("checkpoint", checkpoint.requestId), "checkpoint", checkpoint, false);
  }

  async #writeImmutable(kind: Exclude<HistoricalStorageArtifactKind, "checkpoint">, id: string, payload: unknown) {
    await this.#writeEnvelope(pathFor(kind, id), kind, payload, true);
  }

  async #writeEnvelope(
    relativePath: string,
    kind: HistoricalStorageArtifactKind,
    payload: unknown,
    immutable: boolean
  ) {
    const envelope = Object.freeze({
      schemaVersion:
        HISTORICAL_STORAGE_ENVELOPE_SCHEMA_VERSION as typeof HISTORICAL_STORAGE_ENVELOPE_SCHEMA_VERSION,
      artifactKind: kind,
      integrityHash: await canonicalHash(payload),
      payload
    });
    const serialized = canonicalSerialize(envelope);
    const existing = await this.#options.storage.readText(relativePath);
    if (existing !== undefined && immutable) {
      if (existing !== serialized) {
        throw new HistoricalDatasetRepositoryError(["historical_immutable_artifact_conflict"]);
      }
      return;
    }
    let latest: unknown;
    for (let attempt = 0; attempt <= this.#options.atomicWriteRetries; attempt += 1) {
      try {
        await this.#options.storage.writeTextAtomic(relativePath, serialized);
        const verified = await this.#options.storage.readText(relativePath);
        if (verified !== serialized) {
          throw new HistoricalDatasetRepositoryError(["historical_atomic_write_verification_failed"]);
        }
        return;
      } catch (error) {
        latest = error;
        const code = typeof error === "object" && error && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : "";
        if (!retryableCodes.has(code) || attempt === this.#options.atomicWriteRetries) throw error;
      }
    }
    throw latest;
  }

  async #readEnvelope<T>(
    relativePath: string,
    expectedKind: HistoricalStorageArtifactKind
  ): Promise<Readonly<HistoricalStorageEnvelope<T>> | undefined> {
    const text = await this.#options.storage.readText(relativePath);
    if (text === undefined) return undefined;
    let parsed: HistoricalStorageEnvelope<T>;
    try {
      parsed = JSON.parse(text) as HistoricalStorageEnvelope<T>;
    } catch {
      throw new HistoricalDatasetRepositoryError(["historical_storage_json_invalid"]);
    }
    if (
      parsed.schemaVersion !== HISTORICAL_STORAGE_ENVELOPE_SCHEMA_VERSION ||
      parsed.artifactKind !== expectedKind ||
      !hashPattern.test(parsed.integrityHash)
    ) throw new HistoricalDatasetRepositoryError(["historical_storage_envelope_invalid"]);
    const expectedHash = await canonicalHash(parsed.payload);
    if (expectedHash !== parsed.integrityHash) {
      throw new HistoricalDatasetRepositoryError(["historical_storage_integrity_mismatch"]);
    }
    return Object.freeze(parsed);
  }
}
