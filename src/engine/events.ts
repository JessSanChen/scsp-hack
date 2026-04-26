/**
 * Event log schema. Every change to the world goes through one of these
 * events, appended to `events.jsonl`. Together they form the queryable
 * tree (single-path) of decisions.
 */

import type { Action, FactionId } from "../scenario/types.js";
import type {
  EscalationRecord,
  OutcomeCandidate,
  StateDelta,
  WorldState,
} from "./state.js";

export type EventKind =
  | "GAME_STARTED"
  | "TURN_START"
  | "ACTIONS_SUBMITTED"
  | "CANDIDATES_GENERATED"
  | "ESCALATION_REQUESTED"
  | "ESCALATION_RESOLVED"
  | "OUTCOME_SELECTED"
  | "STATE_SNAPSHOT"
  | "BRIEFING_DELIVERED"
  | "LLM_TRACE";

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
  heuristics: HeuristicsSnapshot;
  llmModel: string;
  initialState: WorldState;
}

export interface TurnStartEvent extends BaseEvent {
  kind: "TURN_START";
  turn: number;
}

export interface ActionsSubmittedEvent extends BaseEvent {
  kind: "ACTIONS_SUBMITTED";
  turn: number;
  actions: Record<FactionId, Action[]>;
}

export interface CandidatesGeneratedEvent extends BaseEvent {
  kind: "CANDIDATES_GENERATED";
  turn: number;
  /** "primary" for the first generation, "post-escalation" for the second. */
  phase: "primary" | "post-escalation";
  candidates: OutcomeCandidate[];
}

export interface EscalationRequestedEvent extends BaseEvent {
  kind: "ESCALATION_REQUESTED";
  turn: number;
  reasons: string[];
  question: string;
}

export interface EscalationResolvedEvent extends BaseEvent {
  kind: "ESCALATION_RESOLVED";
  turn: number;
  record: EscalationRecord;
}

export interface OutcomeSelectedEvent extends BaseEvent {
  kind: "OUTCOME_SELECTED";
  turn: number;
  candidateId: string;
  rngRoll: number;
  appliedDelta: StateDelta;
}

export interface StateSnapshotEvent extends BaseEvent {
  kind: "STATE_SNAPSHOT";
  turn: number;
  state: WorldState;
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
  /** Logical name of the call site, e.g. "candidate-gen", "post-escalation", "briefer:USA". */
  call: string;
  request: unknown;
  response: unknown;
  /** Whether this came from the mock LLM. */
  mock: boolean;
}

export type GameEvent =
  | GameStartedEvent
  | TurnStartEvent
  | ActionsSubmittedEvent
  | CandidatesGeneratedEvent
  | EscalationRequestedEvent
  | EscalationResolvedEvent
  | OutcomeSelectedEvent
  | StateSnapshotEvent
  | BriefingDeliveredEvent
  | LlmTraceEvent;

/**
 * Heuristic config persisted alongside the game so reproducible runs use
 * the same thresholds. Imported here (and re-declared) to avoid a circular
 * dep with `adjudicator/heuristics.ts`.
 */
export interface HeuristicsSnapshot {
  consequentialityThreshold: number;
  minTopProbability: number;
  confidenceFloor: number;
  maxTurnsBetweenAsks: number;
  askOnExternalActorMention: boolean;
  alwaysAskOnTurns: number[];
}
