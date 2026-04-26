/**
 * Scenario types: the static, designer-authored description of a game.
 *
 * In this autonomous-agent build, scenarios declare the cast (factions),
 * geography (regions), the order of battle ("capabilities" + initial
 * "forces"), and the action vocabulary that player agents may select
 * from. Scripted turns are gone: every faction's per-turn actions are
 * decided by an LLM player agent at runtime.
 */

export type FactionId = string;
export type RegionId = string;
export type CapabilityId = string;

/** Posture of a force unit. Tunable via ForcePatch. */
export type ForcePosture = "garrison" | "forward" | "engaged" | "attrited";

export interface Capability {
  id: CapabilityId;
  name: string;
  /** Owning faction. A capability slot belongs to exactly one faction. */
  faction: FactionId;
  description: string;
  /** Unit of measurement, e.g. "platforms", "squadrons", "battalions", "teams", "groups". */
  unit: string;
}

export interface ForceLevel {
  /** Numeric stockpile / order-of-battle count. */
  quantity: number;
  posture: ForcePosture;
  /** 0..100 readiness for this specific capability. */
  readiness: number;
}

export interface Faction {
  id: FactionId;
  name: string;
  shortName: string;
  brief: string;
  objectives: string[];
  initialPosture: string;
}

export interface Region {
  id: RegionId;
  name: string;
  description: string;
  initialPresence: FactionId[];
  initialControl?: FactionId;
}

/**
 * A single action taken by one faction on a given turn. Player agents
 * emit these. Each action declares its kind (drawn from
 * `Scenario.actionKinds`) and the capability ids it employs, so we can
 * mine "which capabilities most often appear in branches that lead to X
 * outcome?" across a Monte Carlo campaign.
 */
export interface Action {
  id: string;
  faction: FactionId;
  summary: string;
  details?: string;
  kind: string;
  capabilitiesUsed: CapabilityId[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  factions: Faction[];
  regions: Region[];
  /** Bullet-point timeline that has happened before turn 1. */
  initialTimeline: string[];
  turnCount: number;
  /** All capability slots across all factions. */
  capabilities: Capability[];
  /** Initial order of battle keyed by faction then capability. */
  initialForces: Record<FactionId, Record<CapabilityId, ForceLevel>>;
  /** Vocabulary of action kinds the player agents must choose from. */
  actionKinds: string[];
  /**
   * Vocabulary of outcome kinds the adjudicator tags candidates with.
   * Used by the campaign aggregator to compute frequency tables.
   */
  outcomeKinds: string[];
}
