/**
 * World state: the live, mutable model the adjudicator maintains.
 *
 * Two design rules:
 *  1. The LLM never mutates state directly. It proposes a typed
 *     `StateDelta` which `applyDelta` translates into mutations.
 *  2. Knowledge is visibility-scoped. `commonKnowledge` is broadcast to
 *     every faction; `secretKnowledge[factionId]` is only ever shown to
 *     that faction (and the adjudicator).
 */

import type { Action, FactionId, RegionId, Scenario } from "../scenario/types.js";

export type ConfidenceLevel = "low" | "medium" | "high";

export interface FactionState {
  id: FactionId;
  /** 0-100 readiness/morale-style aggregate. Tunable by deltas. */
  politicalWill: number;
  /** 0-100 force readiness. Tunable by deltas. */
  forceReadiness: number;
  /** Cumulative casualties across the game. */
  casualties: number;
  /** Free-form posture summary the adjudicator updates. */
  posture: string;
  /** Status modifiers: e.g. "alert-level-2", "domestic-pressure". */
  statusFlags: string[];
}

export interface RegionState {
  id: RegionId;
  /** Which factions currently have forces here. */
  presentFactions: FactionId[];
  /** Which faction nominally controls the region right now. */
  controllingFaction?: FactionId;
  /** Tension level 0-10. Tunable by deltas. */
  tensionLevel: number;
  /** Recent incident headlines, newest last. */
  recentIncidents: string[];
}

export interface TimelineEntry {
  turn: number;
  /** Short headline-style description. */
  text: string;
  /** Optional tag e.g. "incident", "diplomatic", "military". */
  tag?: string;
}

export interface WorldState {
  scenarioId: string;
  /** The turn that just resolved. State at game start has turn = 0. */
  turn: number;
  factions: Record<FactionId, FactionState>;
  regions: Record<RegionId, RegionState>;
  /** Events visible to every faction. */
  commonKnowledge: TimelineEntry[];
  /** Events visible only to a specific faction (and the adjudicator). */
  secretKnowledge: Record<FactionId, TimelineEntry[]>;
  /** Adjudicator-authored running narrative summary. */
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

export type KnowledgeAddition =
  | { scope: "common"; entry: { text: string; tag?: string } }
  | { scope: "secret"; faction: FactionId; entry: { text: string; tag?: string } };

export interface StateDelta {
  /** Short summary of what happened, appended to the running narrative. */
  narrativeAppend: string;
  factionPatches?: FactionStatePatch[];
  regionPatches?: RegionStatePatch[];
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
  /** 0..1 LLM self-rated confidence in this branch's plausibility. */
  confidence: number;
  stateDelta: StateDelta;
  /** Per-faction visibility into the outcome itself. */
  visibility: Record<FactionId, "full" | "partial" | "none">;
  /** Free-form mention of an actor outside the modelled factions. */
  flagsExternalActor?: string;
}

export interface EscalationRecord {
  /** Why the engine asked the human. */
  reasons: string[];
  /** The question text presented to the human. */
  question: string;
  askedAtTurn: number;
  askedAtIso: string;
  /** Set when the human responds. */
  humanResponseText?: string;
  /** If the human chose a specific candidate id, recorded here. */
  humanChoseCandidateId?: string;
  resolvedAtIso?: string;
}

export interface TurnNode {
  turn: number;
  actions: Record<FactionId, Action[]>;
  candidates: OutcomeCandidate[];
  selectedCandidateId: string;
  /** The 0..1 roll used to weighted-sample the candidate. */
  rngRoll: number;
  escalation?: EscalationRecord;
}

/* ---------- Construction & application -------------------------------- */

export function initialWorldState(scenario: Scenario): WorldState {
  const factions: Record<FactionId, FactionState> = {};
  for (const f of scenario.factions) {
    factions[f.id] = {
      id: f.id,
      politicalWill: 75,
      forceReadiness: 75,
      casualties: 0,
      posture: f.initialPosture,
      statusFlags: [],
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
 * Build a per-faction view of state with knowledge filtered by visibility.
 * Used both for prompting the briefer agent and for any future UI that
 * needs to render what a single player sees.
 */
export function viewForFaction(state: WorldState, faction: FactionId): {
  state: WorldState;
  visibleNarrativeNote: string;
} {
  const view: WorldState = {
    ...state,
    secretKnowledge: { [faction]: [...(state.secretKnowledge[faction] ?? [])] },
  };
  return {
    state: view,
    visibleNarrativeNote:
      "Narrative summary is the adjudicator's full view; only timeline entries below are visible to this faction.",
  };
}

function cloneFactions(src: Record<FactionId, FactionState>): Record<FactionId, FactionState> {
  const out: Record<FactionId, FactionState> = {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = { ...v, statusFlags: [...v.statusFlags] };
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
