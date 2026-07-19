import { buildForwardEvidenceEntry } from "./buildForwardEvidenceEntry";
import {
  IFVG_FRESH_RETEST_V3_PROFILE_ID,
  IFVG_FRESH_RETEST_V4_FORK_ID,
  type ForwardEvidenceEntry,
  type ForwardEvidenceProfileId
} from "./forwardEvidenceTypes";

export interface IfvgV3ForwardAssessmentInput {
  eligible: boolean;
  cleanRetest: boolean;
  signalFresh: boolean;
  blockers: string[];
  candidate: {
    side: "long" | "short" | "flat";
    sourceFingerprint?: string;
    retestCandle?: { timestamp: string };
    ifvgBounds?: { low: number; high: number; midpoint: number };
    stop?: number;
    target?: number;
    rr?: number;
    presentConditions: string[];
    missingConditions: string[];
    warnings: string[];
  };
}
export interface CompactClosedCandle {
  timestamp: string;
  high: number;
  low: number;
}

const newYorkDate = (timestamp: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date(timestamp)).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const forwardWindowFor = (profileId: ForwardEvidenceProfileId, date: string) => {
  const [year, month, day] = date.split("-");
  const version = profileId === IFVG_FRESH_RETEST_V4_FORK_ID ? "v4" : "v3";
  return `ifvg_${version}_forward_${year}_${month}_${Number(day) <= 15 ? "h1" : "h2"}`;
};

const deterministicEntryId = (
  profileId: ForwardEvidenceProfileId,
  timestamp: string,
  direction: "long" | "short"
) => {
  const version = profileId === IFVG_FRESH_RETEST_V4_FORK_ID ? "v4" : "v3";
  return `ifvg_${version}_forward_${timestamp.replace(/[^0-9]/g, "")}_${direction}`;
};

const buildIfvgForwardObservation = (
  assessment: IfvgV3ForwardAssessmentInput,
  profileId: ForwardEvidenceProfileId,
  options: { sourceFingerprint?: string; observedAt?: string } = {}
): ForwardEvidenceEntry | undefined => {
  const candidate = assessment.candidate;
  const setupTimestamp = candidate.retestCandle?.timestamp;
  if (
    !assessment.eligible ||
    !assessment.cleanRetest ||
    !assessment.signalFresh ||
    !setupTimestamp ||
    (candidate.side !== "long" && candidate.side !== "short") ||
    !candidate.ifvgBounds ||
    candidate.stop === undefined ||
    candidate.target === undefined ||
    candidate.rr === undefined ||
    candidate.rr < 2
  ) {
    return undefined;
  }
  const independentDate = newYorkDate(setupTimestamp);
  return buildForwardEvidenceEntry({
    profileId,
    entryId: deterministicEntryId(profileId, setupTimestamp, candidate.side),
    timestamp: options.observedAt,
    sourceFingerprint: options.sourceFingerprint ?? candidate.sourceFingerprint ?? "",
    evidenceOrigin: "live_closed_candle",
    causalAtIssue: true,
    setupTimestamp,
    independentDate,
    forwardWindowId: forwardWindowFor(profileId, independentDate),
    direction: candidate.side,
    scenarioFamily: profileId,
    entryZone: {
      lower: candidate.ifvgBounds.low,
      upper: candidate.ifvgBounds.high
    },
    stopReference: candidate.stop,
    targetReferences: [{ label: "next opposing liquidity", price: candidate.target }],
    triggerEvidence: [
      "causal IFVG inversion",
      "unused zone before inversion",
      "fresh clean retest on latest closed candle",
      "minimum 2R target",
      ...candidate.presentConditions
    ],
    missingEvidence: candidate.missingConditions,
    outcome: "pending",
    barsObserved: 0,
    blockerSummary: `Frozen ${profileId} forward observation. Research-only; no readiness promotion or execution authority.`,
    notes: candidate.warnings.join(" ")
  });
};

export function buildIfvgV3ForwardObservation(
  assessment: IfvgV3ForwardAssessmentInput,
  options: { sourceFingerprint?: string; observedAt?: string } = {}
): ForwardEvidenceEntry | undefined {
  return buildIfvgForwardObservation(assessment, IFVG_FRESH_RETEST_V3_PROFILE_ID, options);
}

export function buildIfvgV4ForwardObservation(
  assessment: IfvgV3ForwardAssessmentInput,
  options: { sourceFingerprint?: string; observedAt?: string } = {}
): ForwardEvidenceEntry | undefined {
  return buildIfvgForwardObservation(assessment, IFVG_FRESH_RETEST_V4_FORK_ID, options);
}

const outcomeFor = (entry: ForwardEvidenceEntry, candle: CompactClosedCandle) => {
  const target = entry.targetReferences[0]?.price;
  const stop = entry.stopReference;
  if (target === undefined || stop === undefined) return undefined;
  const targetHit = entry.direction === "long" ? candle.high >= target : candle.low <= target;
  const invalidationHit = entry.direction === "long" ? candle.low <= stop : candle.high >= stop;
  if (targetHit && invalidationHit) return "invalidation_first" as const;
  if (invalidationHit) return "invalidation_first" as const;
  if (targetHit) return "target_first" as const;
  return undefined;
};

const realizedRFor = (entry: ForwardEvidenceEntry, outcome: "target_first" | "invalidation_first") => {
  if (outcome === "invalidation_first") return -1;
  const entryPrice = entry.entryZone
    ? (entry.entryZone.lower + entry.entryZone.upper) / 2
    : undefined;
  const stop = entry.stopReference;
  const target = entry.targetReferences[0]?.price;
  if (entryPrice === undefined || stop === undefined || target === undefined) return undefined;
  const risk = Math.abs(entryPrice - stop);
  return risk > 0 ? Number((Math.abs(target - entryPrice) / risk).toFixed(4)) : undefined;
};

export function resolveIfvgV3ForwardEvidenceWithClosedCandle(
  entries: ForwardEvidenceEntry[],
  candle: CompactClosedCandle,
  options: {
    profileId?: ForwardEvidenceProfileId;
    observedBarsByEntryId?: Record<string, number>;
    maximumBars?: number;
    checkedAt?: string;
  } = {}
) {
  const updatedEntryIds: string[] = [];
  const maximumBars = Math.max(1, options.maximumBars ?? 48);
  const checkedAt = options.checkedAt ?? new Date().toISOString();
  const entriesAfterUpdate = entries.map((entry) => {
    if (options.profileId && entry.profileId !== options.profileId) return entry;
    if (entry.outcome !== "pending" || Date.parse(candle.timestamp) <= Date.parse(entry.setupTimestamp)) {
      return entry;
    }
    const observedBars = Math.max(
      entry.barsObserved + 1,
      options.observedBarsByEntryId?.[entry.entryId] ?? 0
    );
    const resolvedOutcome = outcomeFor(entry, candle);
    const expired = !resolvedOutcome && observedBars >= maximumBars;
    const outcome = resolvedOutcome ?? (expired ? "expired" as const : "pending" as const);
    const next = {
      ...entry,
      outcome,
      realizedR: resolvedOutcome ? realizedRFor(entry, resolvedOutcome) : expired ? 0 : undefined,
      barsObserved: observedBars,
      lastCheckedAt: checkedAt
    };
    if (outcome !== entry.outcome || observedBars !== entry.barsObserved) {
      updatedEntryIds.push(entry.entryId);
    }
    return next;
  });
  return { entries: entriesAfterUpdate, updatedEntryIds };
}
