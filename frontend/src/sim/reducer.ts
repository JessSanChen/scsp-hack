/**
 * Pure reducer that turns the engine's append-only event log into a
 * UiGameState the components can render. Each event is applied once,
 * in order; the function never mutates its inputs.
 *
 * Most of the state shape comes straight from STATE_SNAPSHOT events
 * (cheap full snapshots emitted by the engine after every turn), so the
 * reducer only has to translate per-turn UI overlays:
 *   - PLAYER_DECISION    -> news entries + per-turn rationale/actions
 *   - CANDIDATES_GENERATED + OUTCOME_SELECTED -> turns[] + decision tree
 *   - knowledgeAdditions / region incidents on OUTCOME_SELECTED -> news
 */

import type {
  ActionsSubmittedSimEvent,
  CandidatesGeneratedSimEvent,
  ForkFromSimEvent,
  GameCompleteSimEvent,
  GameStartedSimEvent,
  OutcomeSelectedSimEvent,
  PlayerDecisionSimEvent,
  SimAction,
  SimEvent,
  SimFactionState,
  SimOutcomeCandidate,
  SimRegionState,
  SimWorldState,
  StateSnapshotSimEvent,
  TurnStartSimEvent,
  FactionId,
} from './eventTypes';
import {
  emptyUiState,
  projectFactionState,
  type Consequentiality,
  type UiFactionState,
  type UiGameState,
  type UiHistoricalStat,
  type UiNewsItem,
  type UiOutcomeCandidate,
  type UiTurnData,
} from './uiState';

export interface ReducerMeta {
  /** Friendly scenario name (loaded from config.json). */
  scenarioName?: string;
  /** Hardcoded for the demo - engine doesn't emit totalTurns yet. */
  totalTurns?: number;
}

export function initialUiState(meta: ReducerMeta = {}): UiGameState {
  const base = emptyUiState();
  if (meta.scenarioName) base.scenarioName = meta.scenarioName;
  if (typeof meta.totalTurns === 'number') base.totalTurns = meta.totalTurns;
  return base;
}

export function applyEvent(state: UiGameState, ev: SimEvent): UiGameState {
  switch (ev.kind) {
    case 'GAME_STARTED':
      return onGameStarted(state, ev);
    case 'FORK_FROM':
      return onForkFrom(state, ev);
    case 'TURN_START':
      return onTurnStart(state, ev);
    case 'PLAYER_DECISION':
      return onPlayerDecision(state, ev);
    case 'ACTIONS_SUBMITTED':
      return onActionsSubmitted(state, ev);
    case 'CANDIDATES_GENERATED':
      return onCandidatesGenerated(state, ev);
    case 'OUTCOME_SELECTED':
      return onOutcomeSelected(state, ev);
    case 'STATE_SNAPSHOT':
      return onStateSnapshot(state, ev);
    case 'GAME_COMPLETE':
      return onGameComplete(state, ev);
    case 'BRIEFING_DELIVERED':
    case 'LLM_TRACE':
      return state;
    default:
      return state;
  }
}

export function reduceEvents(events: SimEvent[], meta?: ReducerMeta): UiGameState {
  let state = initialUiState(meta);
  for (const ev of events) {
    state = applyEvent(state, ev);
  }
  return state;
}

/* ---------------- handlers ---------------- */

function onGameStarted(state: UiGameState, ev: GameStartedSimEvent): UiGameState {
  const ws = ev.initialState;
  const factions = projectFactionsRecord(ws.factions);
  const regions = cloneRegionsRecord(ws.regions);
  const news: UiNewsItem[] = [...state.news];
  ws.commonKnowledge.forEach((entry, i) => {
    news.push({
      id: `seed-${ev.seq}-${i}`,
      turn: entry.turn,
      text: entry.text,
      tag: 'scenario',
    });
  });
  return {
    ...state,
    scenarioId: ws.scenarioId,
    scenarioName: state.scenarioName || ws.scenarioId,
    currentTurn: ws.turn,
    status: 'running',
    escalationLevel: ws.escalationLevel,
    factions,
    regions,
    historicalStats: [statFromWorld(ws)],
    news,
    worldState: ws,
  };
}

function onForkFrom(state: UiGameState, ev: ForkFromSimEvent): UiGameState {
  return {
    ...state,
    forkInfo: {
      baseGameDir: ev.baseGameDir,
      fromTurn: ev.fromTurn,
    },
    news: [
      ...state.news,
      {
        id: `fork-${ev.seq}`,
        turn: ev.fromTurn,
        text: `Forked from baseline at turn ${ev.fromTurn} (override: ${ev.overrides?.kind ?? 'none'})`,
        tag: 'system',
      },
    ],
  };
}

function onTurnStart(state: UiGameState, ev: TurnStartSimEvent): UiGameState {
  const turns = ensureTurn(state.turns, ev.turn);
  return {
    ...state,
    currentTurn: ev.turn,
    status: 'running',
    pendingTurn: ev.turn,
    turns,
  };
}

function onPlayerDecision(
  state: UiGameState,
  ev: PlayerDecisionSimEvent,
): UiGameState {
  const turns = ensureTurn(state.turns, ev.turn).map((t) =>
    t.turn === ev.turn
      ? {
          ...t,
          rationales: { ...t.rationales, [ev.faction]: ev.rationale },
          actions: { ...t.actions, [ev.faction]: ev.actions },
        }
      : t,
  );
  const news: UiNewsItem[] = [
    ...state.news,
    {
      id: `pd-${ev.seq}-rationale`,
      turn: ev.turn,
      faction: ev.faction,
      text: ev.rationale,
      tag: 'rationale',
    },
    ...ev.actions.map<UiNewsItem>((a, i) => ({
      id: `pd-${ev.seq}-${i}`,
      turn: ev.turn,
      faction: ev.faction,
      text: `${ev.faction}: ${a.summary}`,
      tag: kindToTag(a.kind),
    })),
  ];
  return { ...state, turns, news };
}

function onActionsSubmitted(
  state: UiGameState,
  _ev: ActionsSubmittedSimEvent,
): UiGameState {
  return state;
}

function onCandidatesGenerated(
  state: UiGameState,
  ev: CandidatesGeneratedSimEvent,
): UiGameState {
  const candidates = ev.candidates.map(toUiCandidate);
  const turns = ensureTurn(state.turns, ev.turn).map((t) =>
    t.turn === ev.turn ? { ...t, candidates } : t,
  );
  return {
    ...state,
    status: 'pending',
    pendingTurn: ev.turn,
    pendingCandidates: candidates,
    turns,
  };
}

function onOutcomeSelected(
  state: UiGameState,
  ev: OutcomeSelectedSimEvent,
): UiGameState {
  const turns = state.turns.map((t) =>
    t.turn === ev.turn
      ? { ...t, selectedCandidateId: ev.candidateId, outcomeSource: ev.source }
      : t,
  );
  const news: UiNewsItem[] = [...state.news];
  const incidents = ev.appliedDelta.regionPatches ?? [];
  const seenIncident = new Set<string>();
  for (const rp of incidents) {
    for (const inc of rp.addIncidents ?? []) {
      const key = `${rp.regionId}::${inc}`;
      if (seenIncident.has(key)) continue;
      seenIncident.add(key);
      news.push({
        id: `inc-${ev.seq}-${rp.regionId}-${news.length}`,
        turn: ev.turn,
        text: `[${rp.regionId}] ${inc}`,
        tag: 'incident',
      });
    }
  }
  if (ev.appliedDelta.narrativeAppend) {
    news.push({
      id: `outcome-${ev.seq}`,
      turn: ev.turn,
      text: ev.appliedDelta.narrativeAppend,
      tag: 'system',
    });
  }
  return {
    ...state,
    status: 'running',
    pendingCandidates: [],
    pendingTurn: undefined,
    turns,
    news,
  };
}

function onStateSnapshot(
  state: UiGameState,
  ev: StateSnapshotSimEvent,
): UiGameState {
  const ws = ev.state;
  const factions = projectFactionsRecord(ws.factions);
  const regions = cloneRegionsRecord(ws.regions);
  const stats = state.historicalStats.filter((s) => s.turn !== ws.turn);
  stats.push(statFromWorld(ws));
  stats.sort((a, b) => a.turn - b.turn);
  return {
    ...state,
    currentTurn: ws.turn,
    escalationLevel: ws.escalationLevel,
    factions,
    regions,
    worldState: ws,
    historicalStats: stats,
  };
}

function onGameComplete(
  state: UiGameState,
  ev: GameCompleteSimEvent,
): UiGameState {
  return {
    ...state,
    status: 'complete',
    currentTurn: ev.finalTurn,
    totalTurns: state.totalTurns || ev.finalTurn,
  };
}

/* ---------------- helpers ---------------- */

function ensureTurn(turns: UiTurnData[], turn: number): UiTurnData[] {
  if (turns.some((t) => t.turn === turn)) return turns;
  return [
    ...turns,
    {
      turn,
      candidates: [],
      rationales: {},
      actions: {},
    },
  ].sort((a, b) => a.turn - b.turn);
}

function toUiCandidate(c: SimOutcomeCandidate): UiOutcomeCandidate {
  return {
    id: c.id,
    summary: c.summary,
    rationale: c.rationale,
    probability: c.probability,
    consequentiality: c.consequentiality as Consequentiality,
    confidence: c.confidence,
    outcomeKinds: c.outcomeKinds ?? [],
    capabilityCitations: c.capabilityCitations ?? [],
  };
}

function statFromWorld(ws: SimWorldState): UiHistoricalStat {
  const f = ws.factions;
  const regions = Object.values(ws.regions ?? {});
  const avgTension =
    regions.length === 0
      ? 0
      : regions.reduce((sum, r) => sum + (r.tensionLevel ?? 0), 0) / regions.length;
  return {
    turn: ws.turn,
    escalationLevel: ws.escalationLevel,
    USA_casualties: f['USA']?.casualties ?? 0,
    PRC_casualties: f['PRC']?.casualties ?? 0,
    ROC_casualties: f['ROC']?.casualties ?? 0,
    avgTension,
    USA_ready: f['USA']?.forceReadiness ?? 0,
    PRC_ready: f['PRC']?.forceReadiness ?? 0,
    ROC_ready: f['ROC']?.forceReadiness ?? 0,
    USA_will: f['USA']?.politicalWill ?? 0,
    PRC_will: f['PRC']?.politicalWill ?? 0,
    ROC_will: f['ROC']?.politicalWill ?? 0,
  };
}

function projectFactionsRecord(
  factions: Record<FactionId, SimFactionState>,
): Record<FactionId, UiFactionState> {
  const out: Record<FactionId, UiFactionState> = {};
  for (const [id, f] of Object.entries(factions)) {
    out[id] = projectFactionState(f);
  }
  return out;
}

function cloneRegionsRecord(
  regions: Record<string, SimRegionState>,
): Record<string, SimRegionState> {
  const out: Record<string, SimRegionState> = {};
  for (const [id, r] of Object.entries(regions)) {
    out[id] = {
      ...r,
      presentFactions: [...r.presentFactions],
      recentIncidents: [...r.recentIncidents],
    };
  }
  return out;
}

const KIND_TAG_MAP: Record<string, UiNewsItem['tag']> = {
  'military-deter': 'military',
  'military-defend': 'military',
  'military-strike': 'military',
  mobilisation: 'military',
  diplomatic: 'diplomatic',
  economic: 'diplomatic',
  cyber: 'incident',
  'info-ops': 'diplomatic',
  clandestine: 'incident',
};

function kindToTag(kind: string): UiNewsItem['tag'] {
  return KIND_TAG_MAP[kind] ?? 'system';
}

/** Test/util re-exports used by the replay player. */
export type { SimAction };
