/**
 * UI-facing TypeScript mirrors of the engine's event log shapes
 * (events.jsonl). These types intentionally trail the engine: only the
 * fields the UI consumes are typed; everything else is left as `unknown`
 * so the reducer is forward-compatible if the engine adds fields.
 */

export type FactionId = string;
export type RegionId = string;
export type CapabilityId = string;
export type ForcePosture = 'garrison' | 'forward' | 'engaged' | 'attrited';

export interface ForceLevel {
  quantity: number;
  posture: ForcePosture;
  readiness: number;
}

export interface SimAction {
  id: string;
  faction: FactionId;
  summary: string;
  details?: string;
  kind: string;
  capabilitiesUsed: CapabilityId[];
}

export interface SimFactionState {
  id: FactionId;
  politicalWill: number;
  forceReadiness: number;
  casualties: number;
  posture: string;
  statusFlags: string[];
  forces: Record<CapabilityId, ForceLevel>;
}

export interface SimRegionState {
  id: RegionId;
  presentFactions: FactionId[];
  controllingFaction?: FactionId;
  tensionLevel: number;
  recentIncidents: string[];
}

export interface SimKnowledgeEntry {
  turn: number;
  text: string;
  tag?: string;
}

export interface SimWorldState {
  scenarioId: string;
  turn: number;
  escalationLevel: number;
  factions: Record<FactionId, SimFactionState>;
  regions: Record<RegionId, SimRegionState>;
  commonKnowledge: SimKnowledgeEntry[];
  secretKnowledge: Record<FactionId, SimKnowledgeEntry[]>;
  narrative: string[];
}

export type SimVisibility = 'full' | 'partial' | 'none';

export interface SimOutcomeCandidate {
  id: string;
  summary: string;
  rationale: string;
  probability: number;
  consequentiality: 1 | 2 | 3 | 4 | 5;
  confidence: number;
  outcomeKinds: string[];
  capabilityCitations: string[];
  flagsExternalActor?: string;
  visibility: Record<FactionId, SimVisibility>;
  // stateDelta omitted - reducer doesn't need it; STATE_SNAPSHOT supersedes.
}

export interface SimStateDelta {
  narrativeAppend: string;
  escalationLevelDelta?: number;
  factionPatches?: unknown[];
  regionPatches?: Array<{
    regionId: RegionId;
    addIncidents?: string[];
  }>;
  forcePatches?: unknown[];
  knowledgeAdditions?: unknown[];
}

interface BaseSimEvent {
  seq: number;
  iso: string;
  kind: string;
}

export interface GameStartedSimEvent extends BaseSimEvent {
  kind: 'GAME_STARTED';
  scenarioId: string;
  seed: number;
  llmModel: string;
  initialState: SimWorldState;
}

export interface ForkFromSimEvent extends BaseSimEvent {
  kind: 'FORK_FROM';
  baseGameDir: string;
  fromTurn: number;
  perturbations: unknown[];
  overrides?: {
    kind: 'force-actions' | 'pin-candidate';
    turn: number;
    [key: string]: unknown;
  };
}

export interface TurnStartSimEvent extends BaseSimEvent {
  kind: 'TURN_START';
  turn: number;
}

export interface PlayerDecisionSimEvent extends BaseSimEvent {
  kind: 'PLAYER_DECISION';
  turn: number;
  faction: FactionId;
  actions: SimAction[];
  rationale: string;
  source: 'auto' | 'override';
}

export interface ActionsSubmittedSimEvent extends BaseSimEvent {
  kind: 'ACTIONS_SUBMITTED';
  turn: number;
  actions: Record<FactionId, SimAction[]>;
}

export interface CandidatesGeneratedSimEvent extends BaseSimEvent {
  kind: 'CANDIDATES_GENERATED';
  turn: number;
  candidates: SimOutcomeCandidate[];
}

export interface OutcomeSelectedSimEvent extends BaseSimEvent {
  kind: 'OUTCOME_SELECTED';
  turn: number;
  candidateId: string;
  rngRoll: number;
  appliedDelta: SimStateDelta;
  source: 'auto' | 'pinned';
}

export interface StateSnapshotSimEvent extends BaseSimEvent {
  kind: 'STATE_SNAPSHOT';
  turn: number;
  state: SimWorldState;
  origin?: 'regular' | 'fork-perturbed';
}

export interface BriefingDeliveredSimEvent extends BaseSimEvent {
  kind: 'BRIEFING_DELIVERED';
  turn: number;
  faction: FactionId;
  briefing: { headline: string; body: string; bullets: string[] };
}

export interface LlmTraceSimEvent extends BaseSimEvent {
  kind: 'LLM_TRACE';
  turn: number;
  call: string;
  request: unknown;
  response: unknown;
  mock: boolean;
}

export interface GameCompleteSimEvent extends BaseSimEvent {
  kind: 'GAME_COMPLETE';
  finalTurn: number;
  reason: string;
}

export type SimEvent =
  | GameStartedSimEvent
  | ForkFromSimEvent
  | TurnStartSimEvent
  | PlayerDecisionSimEvent
  | ActionsSubmittedSimEvent
  | CandidatesGeneratedSimEvent
  | OutcomeSelectedSimEvent
  | StateSnapshotSimEvent
  | BriefingDeliveredSimEvent
  | LlmTraceSimEvent
  | GameCompleteSimEvent;
