import type { V2Authority } from "../authority/v2Authority";

export type V2StrategyAdapterStatus = "eligible" | "blocked" | "insufficient_data";

export interface V2StrategyAdapterDiagnostics {
  status: V2StrategyAdapterStatus;
  blockers: readonly string[];
  warnings: readonly string[];
  limitations: readonly string[];
}

export interface V2StrategyAdapterResult<TArtifact> {
  strategyId: string;
  profileId: string;
  adapterId: string;
  adapterVersion: string;
  inputContractVersion: string;
  contextArtifactId: string;
  sourceFingerprint: string;
  artifacts: readonly Readonly<TArtifact>[];
  diagnostics: Readonly<V2StrategyAdapterDiagnostics>;
  shadowOnly: true;
  authority: Readonly<V2Authority>;
}

export interface V2StrategyAdapter<TContext, TArtifact> {
  strategyId: string;
  profileId: string;
  adapterId: string;
  adapterVersion: string;
  inputContractVersion: string;
  requiredFactFamilies: readonly string[];
  requiredTimeframes: readonly string[];

  detect(
    context: Readonly<TContext>
  ): Promise<Readonly<V2StrategyAdapterResult<TArtifact>>>;
}
