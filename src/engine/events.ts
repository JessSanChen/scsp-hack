/**
 * Event log schema. Every change to the world goes through one of these
 * events, appended to `events.jsonl`. Together they form the queryable
 * tree (single-path) of decisions in a game.
 *
 * The autonomous-agent build emits `PLAYER_DECISION` events recording
 * each LLM-driven faction's structured action set + rationale, and adds
 * `FORK_FROM` and `GAME_COMPLETE` for counterfactual / Monte Carlo
 * orchestration.
 */

import type { Action, FactionId, ForcePosture } from "../scenario/types.js";
import type {
  ForcePatch,
  OutcomeCandidate,
  StateDelta,
  WorldState,
} from "./state.js";

export type EventKind =
  | "GAME_STARTED"
  | "FORK_FROM"
  | "TURN_START"
  | "PLAYER_DECISION"
  | "ACTIONS_SUBMITTED"
  | "CANDIDATES_GENERATED"
  | "OUTCOME_SELECTED"
  | "STATE_SNAPSHOT"
  | "BRIEFING_DELIVERED"
  | "LLM_TRACE"
  | "GAME_COMPLETE";

export interface BaseEvent {
  /** Monotonic event sequence within a game. Assigned at append time. */
  seq: number;
  iso: string;
  kind: EventKind;
}

export interface GameStartedEvent extends BaseEvent {
  kind: "GAME_STARTED";
  scenarioId: string;
  seed: number;
  llmModel: string;
  initialState: WorldState;
}

/**
 * Recorded as the second event in a forked game. Captures the
 * counterfactual lineage: where it forked from and what was overridden.
 */
export interface ForkFromEvent extends BaseEvent {
  kind: "FORK_FROM";
  baseGameDir: string;
  fromTurn: number;
  /** Force-structure perturbations applied to the copied state snapshot. */
  perturbations: ForcePatch[];
  /**
   * Optional override for the immediate next turn. Two mutually-exclusive
   * shapes (the engine validates):
   *   - `factionActions`: skip player agents at turn `fromTurn`, use these instead.
   *   - `pinCandidate`: use the supplied candidate set and force-select an id.
   */
  overrides?: ForkOverride;
}

export type ForkOverride =
  | {
      kind: "force-actions";
      turn: number;
      actions: Record<FactionId, Action[]>;
      rationales?: Record<FactionId, string>;
    }
  | {
      kind: "pin-candidate";
      turn: number;
      candidateId: string;
      candidates: OutcomeCandidate[];
      actions: Record<FactionId, Action[]>;
      rationales?: Record<FactionId, string>;
    };

export interface TurnStartEvent extends BaseEvent {
  kind: "TURN_START";
  turn: number;
}

export interface PlayerDecisionEvent extends BaseEvent {
  kind: "PLAYER_DECISION";
  turn: number;
  faction: FactionId;
  actions: Action[];
  rationale: string;
  /** "auto" = LLM player agent; "override" = supplied via fork. */
  source: "auto" | "override";
}

export interface ActionsSubmittedEvent extends BaseEvent {
  kind: "ACTIONS_SUBMITTED";
  turn: number;
  actions: Record<FactionId, Action[]>;
}

export interface CandidatesGeneratedEvent extends BaseEvent {
  kind: "CANDIDATES_GENERATED";
  turn: number;
  candidates: OutcomeCandidate[];
}

export interface OutcomeSelectedEvent extends BaseEvent {
  kind: "OUTCOME_SELECTED";
  turn: number;
  candidateId: string;
  rngRoll: number;
  appliedDelta: StateDelta;
  /** "auto" = weighted sample; "pinned" = forced via fork override. */
  source: "auto" | "pinned";
}

export interface StateSnapshotEvent extends BaseEvent {
  kind: "STATE_SNAPSHOT";
  turn: number;
  state: WorldState;
  /** "regular" = end-of-turn snapshot; "fork-perturbed" = snapshot rewritten by FORK_FROM. */
  origin?: "regular" | "fork-perturbed";
}

export interface BriefingDeliveredEvent extends BaseEvent {
  kind: "BRIEFING_DELIVERED";
  turn: number;
  faction: FactionId;
  briefing: {
    headline: string;
    body: string;
    bullets: string[];
  };
}

export interface LlmTraceEvent extends BaseEvent {
  kind: "LLM_TRACE";
  turn: number;
  /** Logical call site, e.g. "candidate-gen", "player:USA", "briefer:ROC". */
  call: string;
  request: unknown;
  response: unknown;
  mock: boolean;
}

export interface GameCompleteEvent extends BaseEvent {
  kind: "GAME_COMPLETE";
  finalTurn: number;
  reason: "turn-count-reached" | "manual-stop";
}

export type GameEvent =
  | GameStartedEvent
  | ForkFromEvent
  | TurnStartEvent
  | PlayerDecisionEvent
  | ActionsSubmittedEvent
  | CandidatesGeneratedEvent
  | OutcomeSelectedEvent
  | StateSnapshotEvent
  | BriefingDeliveredEvent
  | LlmTraceEvent
  | GameCompleteEvent;

/** Re-export used by ForkFromEvent for ergonomics in callers. */
export type { ForcePatch, ForcePosture };
