import { canonicalSerialize } from "../canonical/canonicalValueSerialization";
import { buildSimulationCheckpoint, validateSimulationCheckpoint } from "./simulationContracts";
import type {
  CanonicalOpportunity,
  SimulationCheckpoint,
  TradeLedgerSeal,
  TradeSimulationRecord
} from "./simulationTypes";

export interface SimulationStorageAdapter {
  readText(path: string): Promise<string | undefined>;
  writeTextAtomic(path: string, value: string): Promise<void>;
}

type ImmutableArtifact = CanonicalOpportunity | TradeSimulationRecord | TradeLedgerSeal;

const artifactPath = (kind: string, id: string) => `${kind}/${id.replace(":", "_")}.json`;

export class SimulationRepository {
  constructor(private readonly storage: Readonly<SimulationStorageAdapter>) {}

  private async writeImmutable(kind: string, id: string, artifact: Readonly<ImmutableArtifact>) {
    const path = artifactPath(kind, id);
    const serialized = `${canonicalSerialize(artifact)}\n`;
    const existing = await this.storage.readText(path);
    if (existing !== undefined) {
      if (existing !== serialized) throw new Error(`Immutable simulation artifact conflict: ${path}`);
      return;
    }
    await this.storage.writeTextAtomic(path, serialized);
  }

  writeOpportunity(opportunity: Readonly<CanonicalOpportunity>) {
    return this.writeImmutable("opportunities", opportunity.opportunityId, opportunity);
  }

  writeRecord(record: Readonly<TradeSimulationRecord>) {
    return this.writeImmutable("records", record.recordId, record);
  }

  writeLedgerSeal(seal: Readonly<TradeLedgerSeal>) {
    return this.writeImmutable("ledgers", seal.ledgerSealId, seal);
  }

  async readCheckpoint(experimentId: string): Promise<Readonly<SimulationCheckpoint> | undefined> {
    const text = await this.storage.readText(`checkpoints/${experimentId.replace(":", "_")}.json`);
    if (text === undefined) return undefined;
    const checkpoint = JSON.parse(text) as SimulationCheckpoint;
    const blockers = await validateSimulationCheckpoint(checkpoint);
    if (blockers.length) throw new Error(`Simulation checkpoint is invalid: ${blockers.join(", ")}`);
    return checkpoint;
  }

  async writeCheckpoint(input: {
    experimentId: string;
    nextOpportunityOrdinal: number;
    committedRecordIds: readonly string[];
  }) {
    const checkpoint = await buildSimulationCheckpoint(input);
    await this.storage.writeTextAtomic(
      `checkpoints/${input.experimentId.replace(":", "_")}.json`,
      `${canonicalSerialize(checkpoint)}\n`
    );
    return checkpoint;
  }
}
