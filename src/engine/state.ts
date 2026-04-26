/**
 * World state: the live, mutable model the adjudicator maintains.
 *
 * Two design rules:
 *  1. The LLM never mutates state directly. It proposes a typed
 *     `StateDelta` which `applyDelta` translates into mutations.
 *  2. Knowledge is visibility-scoped. `commonKnowledge` is broadcast to
 *     every faction; `secretKnowledge[factionId]` is only visible to
 *     that faction (and the adjudicator).
 *
 * Force structure (`forces`) is first-class state per faction: capability
 * slots with quantity / posture / readiness. Outcomes can attrite or
 * reposture forces via `ForcePatch`es, and the global `escalationLevel`
 * is the headline outcome metric Monte Carlo campaigns aggregate over.
 */

import type {
  Action,
  CapabilityId,
  FactionId,
  ForceLevel,
  ForcePosture,
  RegionId,
  Scenario,
} from "../scenario/types.js";

export type { Action, CapabilityId, FactionId, ForceLevel, ForcePosture, RegionId };

export interface FactionState {
  id: FactionId;
  /** 0-100 readiness/morale-style aggregate. Tunable by deltas. */
  politicalWill: number;
  /** 0-100 force readiness aggregate (separate from per-capability readiness). */
  forceReadiness: number;
  casualties: number;
  /** Free-form posture summary the adjudicator updates. */
  posture: string;
  statusFlags: string[];
  /** Order of battle: capability slot -> level. */
  forces: Record<CapabilityId, ForceLevel>;
}

export interface RegionState {
  id: RegionId;
  presentFactions: FactionId[];
  controllingFaction?: FactionId;
  /** 0-10 region-specific tension. */
  tensionLevel: number;
  recentIncidents: string[];
}

export interface TimelineEntry {
  turn: number;
  text: string;
  tag?: string;
}

export interface WorldState {
  scenarioId: string;
  /** The turn that just resolved. State at game start has turn = 0. */
  turn: number;
  /** Headline outcome metric. 0 = baseline; 10 = open kinetic war. */
  escalationLevel: number;
  factions: Record<FactionId, FactionState>;
  regions: Record<RegionId, RegionState>;
  commonKnowledge: TimelineEntry[];
  secretKnowledge: Record<FactionId, TimelineEntry[]>;
  narrative: string[];
}

/* ---------- StateDelta: the typed patch applied per turn --------------- */

export type FactionStatePatch = {
  factionId: FactionId;
  politicalWillDelta?: number;
  forceReadinessDelta?: number;
  casualtiesDelta?: number;
  postureSet?: string;
  statusFlagsAdd?: string[];
  statusFlagsRemove?: string[];
};

export type RegionStatePatch = {
  regionId: RegionId;
  tensionLevelDelta?: number;
  setControllingFaction?: FactionId | null;
  addPresentFactions?: FactionId[];
  removePresentFactions?: FactionId[];
  addIncidents?: string[];
};

export interface ForcePatch {
  factionId: FactionId;
  capabilityId: CapabilityId;
  /** Add (or subtract) units from the order of battle. */
  quantityDelta?: number;
  /** Reposture this capability slot. */
  postureSet?: ForcePosture;
  /** Adjust readiness 0..100 (clamped). */
  readinessDelta?: number;
}

export type KnowledgeAddition =
  | { scope: "common"; entry: { text: string; tag?: string } }
  | { scope: "secret"; faction: FactionId; entry: { text: string; tag?: string } };

export interface StateDelta {
  /** 1-2 sentence summary appended to running narrative. */
  narrativeAppend: string;
  /** Increment / decrement the global escalation level. */
  escalationLevelDelta?: number;
  factionPatches?: FactionStatePatch[];
  regionPatches?: RegionStatePatch[];
  forcePatches?: ForcePatch[];
  knowledgeAdditions?: KnowledgeAddition[];
}

/* ---------- Outcome candidates / turn nodes ---------------------------- */

export type Consequentiality = 1 | 2 | 3 | 4 | 5;

export interface OutcomeCandidate {
  id: string;
  summary: string;
  rationale: string;
  /** 0..1; the engine renormalises if the LLM's set doesn't sum to 1. */
  probability: number;
  consequentiality: Consequentiality;
  confidence: number;
  stateDelta: StateDelta;
  /** Per-faction visibility into the outcome itself. */
  visibility: Record<FactionId, "full" | "partial" | "none">;
  /** Tags drawn from `Scenario.outcomeKinds`. */
  outcomeKinds: string[];
  /**
   * Capability ids invoked or stressed by this outcome (mined for
   * "which capabilities most often appear in branches that lead to X?").
   */
  capabilityCitations: string[];
  /** Free-form mention of an actor outside the modelled factions. */
  flagsExternalActor?: string;
}

export interface TurnNode {
  turn: number;
  actions: Record<FactionId, Action[]>;
  /** Per-faction rationale recorded by the player agent. */
  playerRationales: Record<FactionId, string>;
  candidates: OutcomeCandidate[];
  selectedCandidateId: string;
  /** The 0..1 roll used to weighted-sample the candidate. */
  rngRoll: number;
}

/* ---------- Construction & application -------------------------------- */

export function initialWorldState(scenario: Scenario): WorldState {
  const factions: Record<FactionId, FactionState> = {};
  for (const f of scenario.factions) {
    const forces = scenario.initialForces[f.id] ?? {};
    factions[f.id] = {
      id: f.id,
      politicalWill: 75,
      forceReadiness: 75,
      casualties: 0,
      posture: f.initialPosture,
      statusFlags: [],
      forces: cloneForces(forces),
    };
  }
  const regions: Record<RegionId, RegionState> = {};
  for (const r of scenario.regions) {
    regions[r.id] = {
      id: r.id,
      presentFactions: [...r.initialPresence],
      controllingFaction: r.initialControl,
      tensionLevel: 5,
      recentIncidents: [],
    };
  }
  const secretKnowledge: Record<FactionId, TimelineEntry[]> = {};
  for (const f of scenario.factions) {
    secretKnowledge[f.id] = [];
  }
  return {
    scenarioId: scenario.id,
    turn: 0,
    escalationLevel: 0,
    factions,
    regions,
    commonKnowledge: scenario.initialTimeline.map((text) => ({
      turn: 0,
      text,
      tag: "scenario",
    })),
    secretKnowledge,
    narrative: [],
  };
}

/**
 * Apply a delta to produce the next state. Pure: returns a new object,
 * never mutates the input. The new state's `turn` is set by the caller.
 */
export function applyDelta(
  state: WorldState,
  delta: StateDelta,
  nextTurn: number,
): WorldState {
  const next: WorldState = {
    scenarioId: state.scenarioId,
    turn: nextTurn,
    escalationLevel: clamp(
      state.escalationLevel + (delta.escalationLevelDelta ?? 0),
      0,
      10,
    ),
    factions: cloneFactions(state.factions),
    regions: cloneRegions(state.regions),
    commonKnowledge: [...state.commonKnowledge],
    secretKnowledge: cloneSecret(state.secretKnowledge),
    narrative: [...state.narrative, delta.narrativeAppend],
  };

  for (const patch of delta.factionPatches ?? []) {
    const f = next.factions[patch.factionId];
    if (!f) continue;
    if (patch.politicalWillDelta !== undefined) {
      f.politicalWill = clamp(f.politicalWill + patch.politicalWillDelta, 0, 100);
    }
    if (patch.forceReadinessDelta !== undefined) {
      f.forceReadiness = clamp(f.forceReadiness + patch.forceReadinessDelta, 0, 100);
    }
    if (patch.casualtiesDelta !== undefined) {
      f.casualties = Math.max(0, f.casualties + patch.casualtiesDelta);
    }
    if (patch.postureSet !== undefined) {
      f.posture = patch.postureSet;
    }
    if (patch.statusFlagsAdd) {
      for (const flag of patch.statusFlagsAdd) {
        if (!f.statusFlags.includes(flag)) f.statusFlags.push(flag);
      }
    }
    if (patch.statusFlagsRemove) {
      f.statusFlags = f.statusFlags.filter((x) => !patch.statusFlagsRemove!.includes(x));
    }
  }

  for (const patch of delta.regionPatches ?? []) {
    const r = next.regions[patch.regionId];
    if (!r) continue;
    if (patch.tensionLevelDelta !== undefined) {
      r.tensionLevel = clamp(r.tensionLevel + patch.tensionLevelDelta, 0, 10);
    }
    if (patch.setControllingFaction !== undefined) {
      r.controllingFaction = patch.setControllingFaction ?? undefined;
    }
    if (patch.addPresentFactions) {
      for (const f of patch.addPresentFactions) {
        if (!r.presentFactions.includes(f)) r.presentFactions.push(f);
      }
    }
    if (patch.removePresentFactions) {
      r.presentFactions = r.presentFactions.filter(
        (x) => !patch.removePresentFactions!.includes(x),
      );
    }
    if (patch.addIncidents) {
      r.recentIncidents.push(...patch.addIncidents);
      if (r.recentIncidents.length > 8) {
        r.recentIncidents = r.recentIncidents.slice(-8);
      }
    }
  }

  for (const fp of delta.forcePatches ?? []) {
    const f = next.factions[fp.factionId];
    if (!f) continue;
    const slot = f.forces[fp.capabilityId];
    if (!slot) continue;
    if (fp.quantityDelta !== undefined) {
      slot.quantity = Math.max(0, slot.quantity + fp.quantityDelta);
    }
    if (fp.postureSet !== undefined) {
      slot.posture = fp.postureSet;
    }
    if (fp.readinessDelta !== undefined) {
      slot.readiness = clamp(slot.readiness + fp.readinessDelta, 0, 100);
    }
  }

  for (const ka of delta.knowledgeAdditions ?? []) {
    const entry: TimelineEntry = {
      turn: nextTurn,
      text: ka.entry.text,
      tag: ka.entry.tag,
    };
    if (ka.scope === "common") {
      next.commonKnowledge.push(entry);
    } else {
      const target = next.secretKnowledge[ka.faction] ?? [];
      target.push(entry);
      next.secretKnowledge[ka.faction] = target;
    }
  }

  return next;
}

/**
 * Apply a list of `ForcePatch`es directly to a state without touching
 * other fields. Used by the fork module to apply pre-game perturbations
 * (e.g. -1 CSG) to a copied state snapshot.
 */
export function applyForcePatches(state: WorldState, patches: ForcePatch[]): WorldState {
  const next: WorldState = {
    ...state,
    factions: cloneFactions(state.factions),
  };
  for (const fp of patches) {
    const f = next.factions[fp.factionId];
    if (!f) continue;
    const slot = f.forces[fp.capabilityId];
    if (!slot) continue;
    if (fp.quantityDelta !== undefined) {
      slot.quantity = Math.max(0, slot.quantity + fp.quantityDelta);
    }
    if (fp.postureSet !== undefined) {
      slot.posture = fp.postureSet;
    }
    if (fp.readinessDelta !== undefined) {
      slot.readiness = clamp(slot.readiness + fp.readinessDelta, 0, 100);
    }
  }
  return next;
}

/**
 * Build a per-faction view of state with knowledge and forces filtered
 * by visibility. The faction sees its own forces fully, and only its
 * own secret knowledge timeline.
 */
export function viewForFaction(state: WorldState, faction: FactionId): {
  state: WorldState;
} {
  const view: WorldState = {
    ...state,
    secretKnowledge: { [faction]: [...(state.secretKnowledge[faction] ?? [])] },
  };
  return { state: view };
}

function cloneFactions(src: Record<FactionId, FactionState>): Record<FactionId, FactionState> {
  const out: Record<FactionId, FactionState> = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = {
      ...v,
      statusFlags: [...v.statusFlags],
      forces: cloneForces(v.forces),
    };
  }
  return out;
}

function cloneForces(src: Record<CapabilityId, ForceLevel>): Record<CapabilityId, ForceLevel> {
  const out: Record<CapabilityId, ForceLevel> = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = { ...v };
  }
  return out;
}

function cloneRegions(src: Record<RegionId, RegionState>): Record<RegionId, RegionState> {
  const out: Record<RegionId, RegionState> = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = {
      ...v,
      presentFactions: [...v.presentFactions],
      recentIncidents: [...v.recentIncidents],
    };
  }
  return out;
}

function cloneSecret(
  src: Record<FactionId, TimelineEntry[]>,
): Record<FactionId, TimelineEntry[]> {
  const out: Record<FactionId, TimelineEntry[]> = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = v.map((e) => ({ ...e }));
  }
  return out;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
