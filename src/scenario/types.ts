/**
 * Scenario types: the static, designer-authored description of a game.
 *
 * A scenario defines the cast (factions), the geography (regions), the
 * opening world state, and a pre-scripted set of actions per turn that
 * stand in for live player input during the demo.
 *
 * The runtime never edits scenario data; it only reads it. World state
 * lives separately (see `src/engine/state.ts`).
 */

export type FactionId = string;
export type RegionId = string;

export interface Faction {
  id: FactionId;
  name: string;
  shortName: string;
  /** One-line strategic description handed to the adjudicator LLM. */
  brief: string;
  /** Key strategic objectives, free-form text. */
  objectives: string[];
  /** Initial posture / readiness summary. */
  initialPosture: string;
}

export interface Region {
  id: RegionId;
  name: string;
  description: string;
  /** Faction ids whose forces start present in this region. */
  initialPresence: FactionId[];
  /** Faction id that nominally controls the region at game start, if any. */
  initialControl?: FactionId;
}

/**
 * A single action taken by one faction on a given turn. In the demo these
 * are pre-scripted; in a future UI they will be submitted by real players.
 */
export interface Action {
  id: string;
  faction: FactionId;
  /** Human-readable summary, e.g. "Hold fire unless fired upon". */
  summary: string;
  /** Free-form rationale / orders text the LLM sees verbatim. */
  details?: string;
}

export interface ScriptedTurn {
  turn: number;
  /** Optional narrative the scenario author wants surfaced this turn. */
  narrative?: string;
  /** All faction actions for this turn, keyed by faction id. */
  actions: Record<FactionId, Action[]>;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  factions: Faction[];
  regions: Region[];
  /** Bullet-point timeline that has happened before turn 1 begins. */
  initialTimeline: string[];
  /** How many turns the scripted demo runs for. */
  turnCount: number;
  scriptedTurns: ScriptedTurn[];
}
