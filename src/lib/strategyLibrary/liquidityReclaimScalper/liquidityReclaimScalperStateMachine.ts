import { canonicalHash } from "@/lib/canonical/canonicalValueSerialization";
import type { LrsBlocker, LrsSetupState, LrsTransition } from "./liquidityReclaimScalperTypes";
const legal: Readonly<Record<LrsSetupState, readonly LrsSetupState[]>> = Object.freeze({ SEARCHING: ["LIQUIDITY_OBJECTIVE_IDENTIFIED", "SOURCE_BLOCKED", "CONTEXT_INVALIDATED"],
  LIQUIDITY_OBJECTIVE_IDENTIFIED: ["WAITING_FOR_RAID", "TARGET_CONSUMED", "SETUP_EXPIRED", "CONTEXT_INVALIDATED"],
  WAITING_FOR_RAID: ["RAID_CONFIRMED", "TARGET_CONSUMED", "SESSION_EXPIRED", "SETUP_EXPIRED", "CONTEXT_INVALIDATED"],
  RAID_CONFIRMED: ["DISPLACEMENT_CONFIRMED", "INVALIDATED", "SESSION_EXPIRED", "SETUP_EXPIRED", "CONTEXT_INVALIDATED"],
  DISPLACEMENT_CONFIRMED: ["IFVG_RECLAIMED", "INVALIDATED", "SESSION_EXPIRED", "SETUP_EXPIRED", "CONTEXT_INVALIDATED"],
  IFVG_RECLAIMED: ["WAITING_FOR_ENTRY", "INVALIDATED", "SESSION_EXPIRED", "SETUP_EXPIRED", "CONTEXT_INVALIDATED"],
  WAITING_FOR_ENTRY: ["ENTRY_ELIGIBLE", "NO_FILL", "INVALIDATED", "SESSION_EXPIRED", "SETUP_EXPIRED", "CONTEXT_INVALIDATED"],
  ENTRY_ELIGIBLE: ["ACTIVE", "NO_FILL", "INVALIDATED", "SESSION_EXPIRED", "SETUP_EXPIRED", "CONTEXT_INVALIDATED"], ACTIVE: ["TARGET_REACHED", "INVALIDATED"],
  TARGET_REACHED: [], INVALIDATED: [], NO_FILL: [], TARGET_CONSUMED: [], SESSION_EXPIRED: [], SETUP_EXPIRED: [], SOURCE_BLOCKED: [], CONTEXT_INVALIDATED: [] });
export const canTransitionLrs = (from: LrsSetupState, to: LrsSetupState) => legal[from].includes(to);
export async function buildLrsTransition(input: Omit<LrsTransition, "transitionId">): Promise<Readonly<LrsTransition>> { if (!canTransitionLrs(input.previousState, input.nextState)) throw new Error(`Illegal LRS transition ${input.previousState} -> ${input.nextState}.`);
  if (!Number.isFinite(Date.parse(input.marketTime))) throw new Error("LRS transition marketTime is invalid.");
  const core = Object.freeze({ ...input, triggerFactIds: Object.freeze([...new Set(input.triggerFactIds)].sort()), blockers: Object.freeze([...new Set<LrsBlocker>(input.blockers)].sort()) });
  return Object.freeze({ ...core, transitionId: await canonicalHash(core) }); }
