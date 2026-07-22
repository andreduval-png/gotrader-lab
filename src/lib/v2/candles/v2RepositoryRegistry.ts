import type { V2SourceKind } from "../identity/v2IdentityTypes";
import {
  V2CandleRepositoryError,
  type V2CandleRepository,
  type V2CanonicalCandleQuery
} from "./v2CandleTypes";

export interface V2CandleRepositoryRegistry {
  getWindow(query: V2CanonicalCandleQuery): ReturnType<V2CandleRepository["getWindow"]>;
  getRepository(sourceKind: V2SourceKind): V2CandleRepository;
  supportedSourceKinds(): readonly V2SourceKind[];
}

export function createV2CandleRepositoryRegistry(
  repositories: Readonly<Partial<Record<V2SourceKind, V2CandleRepository>>>
): V2CandleRepositoryRegistry {
  const entries = Object.entries(repositories).filter((entry): entry is [V2SourceKind, V2CandleRepository] => Boolean(entry[1]));
  const registry = new Map<V2SourceKind, V2CandleRepository>(entries);
  const getRepository = (sourceKind: V2SourceKind) => {
    const repository = registry.get(sourceKind);
    if (!repository) {
      throw new V2CandleRepositoryError(
        "adapter_unavailable",
        `No V2 candle adapter is registered for explicit source kind ${sourceKind}.`
      );
    }
    return repository;
  };
  return Object.freeze({
    getWindow(query: V2CanonicalCandleQuery) {
      return getRepository(query.source.sourceKind).getWindow(query);
    },
    getRepository,
    supportedSourceKinds() {
      return Object.freeze([...registry.keys()].sort());
    }
  });
}
