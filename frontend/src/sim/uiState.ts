/**
 * UI-shaped game state. Built incrementally by the events reducer
 * (sim/reducer.ts). Components downstream consume this shape.
 *
 * Replaces the old static src/mockData.ts. Only fields the UI actually
 * renders are kept; everything else lives in the underlying SimWorldState
 * (accessible via `worldState`).
 */

import type {
  SimAction,
  SimFactionState,
  SimRegionState,
  SimWorldState,
  FactionId,
} from './eventTypes';

export type Consequentiality = 1 | 2 | 3 | 4 | 5;

export interface UiOutcomeCandidate {
  id: string;
  summary: string;
  rationale: string;
  probability: number;
  consequentiality: Consequentiality;
  confidence: number;
  outcomeKinds: string[];
  capabilityCitations: string[];
}

export interface UiTurnData {
  turn: number;
  candidates: UiOutcomeCandidate[];
  /** undefined while candidates are pending, set once OUTCOME_SELECTED arrives. */
  selectedCandidateId?: string;
  /** faction -> rationale, harvested from PLAYER_DECISION events. */
  rationales: Record<FactionId, string>;
  /** faction -> action set, harvested from PLAYER_DECISION events. */
  actions: Record<FactionId, SimAction[]>;
  /** outcome picker source for the divergence highlight. */
  outcomeSource?: 'auto' | 'pinned';
}

export interface UiFactionState {
  id: FactionId;
  politicalWill: number;
  forceReadiness: number;
  casualties: number;
  posture: string;
  statusFlags: string[];
}

export type UiRegionState = SimRegionState;

export interface UiNewsItem {
  /** Monotonic key for React lists; stable across renders. */
  id: string;
  turn: number;
  text: string;
  tag: 'military' | 'diplomatic' | 'incident' | 'rationale' | 'scenario' | 'system';
  faction?: FactionId;
}

export interface UiHistoricalStat {
  turn: number;
  /** 0..10. Master narrative metric from STATE_SNAPSHOT.escalationLevel. */
  escalationLevel: number;
  /** Cumulative casualties per faction. */
  USA_casualties: number;
  PRC_casualties: number;
  ROC_casualties: number;
  /** Average region tension across the four scenario regions. */
  avgTension: number;
  /** Sum of normalised force readiness across the three factions (raw 0..100 each). */
  USA_ready: number;
  PRC_ready: number;
  ROC_ready: number;
  /** Political will, kept as a secondary signal. */
  USA_will: number;
  PRC_will: number;
  ROC_will: number;
}

export type UiStatus = 'idle' | 'running' | 'pending' | 'complete';

export interface UiForkInfo {
  baseGameDir: string;
  fromTurn: number;
  /** Pretty label - resolved by App from manifest. */
  title?: string;
}

export interface UiGameState {
  scenarioId: string;
  scenarioName: string;
  /** Highest turn observed so far. */
  currentTurn: number;
  totalTurns: number;
  status: UiStatus;
  escalationLevel: number;
  factions: Record<FactionId, UiFactionState>;
  regions: Record<string, UiRegionState>;
  /** Resolved + in-flight turns, indexed by turn number (1-based). */
  turns: UiTurnData[];
  /**
   * Candidates currently awaiting OUTCOME_SELECTED. Populated when a
   * CANDIDATES_GENERATED event has arrived but its OUTCOME_SELECTED has
   * not. Cleared the moment the outcome arrives.
   */
  pendingCandidates: UiOutcomeCandidate[];
  pendingTurn?: number;
  news: UiNewsItem[];
  historicalStats: UiHistoricalStat[];
  /** Latest full world state, mostly here for components that want forces. */
  worldState?: SimWorldState;
  /** Set if the game is a fork (FORK_FROM event observed). */
  forkInfo?: UiForkInfo;
}

export const FACTION_IDS: FactionId[] = ['USA', 'PRC', 'ROC'];

export function emptyUiState(): UiGameState {
  return {
    scenarioId: '',
    scenarioName: '',
    currentTurn: 0,
    totalTurns: 0,
    status: 'idle',
    escalationLevel: 0,
    factions: {},
    regions: {},
    turns: [],
    pendingCandidates: [],
    news: [],
    historicalStats: [],
  };
}

export function projectFactionState(s: SimFactionState): UiFactionState {
  return {
    id: s.id,
    politicalWill: s.politicalWill,
    forceReadiness: s.forceReadiness,
    casualties: s.casualties,
    posture: s.posture,
    statusFlags: s.statusFlags,
  };
}
