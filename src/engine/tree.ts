/**
 * The "tree" of game decisions.
 *
 * On disk, a game is an append-only JSONL event log + per-turn state
 * snapshots in a sibling directory. In memory, we reconstruct a
 * `GameTree`: an ordered list of `TurnNode`s carrying actions,
 * candidates and the selected branch. This is what a future UI will
 * read.
 *
 * No human-in-the-loop: all turns resolve autonomously. Forks store a
 * `FORK_FROM` event recording lineage and any overrides.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Action, FactionId } from "../scenario/types.js";
import type {
  OutcomeCandidate,
  TurnNode,
  WorldState,
} from "./state.js";
import type {
  BriefingDeliveredEvent,
  ForkFromEvent,
  GameEvent,
  LlmTraceEvent,
} from "./events.js";

export interface GameTree {
  scenarioId: string;
  seed: number;
  llmModel: string;
  initialState: WorldState;
  /** Latest known state (may equal initialState if no turn has resolved). */
  currentState: WorldState;
  /** Resolved turns in order. */
  turns: TurnNode[];
  /** Briefings keyed by `${turn}:${faction}`. */
  briefings: Record<string, BriefingDeliveredEvent["briefing"]>;
  /** Set on forks; absent on root games. */
  fork?: {
    baseGameDir: string;
    fromTurn: number;
  };
  /** Set when a GAME_COMPLETE event has been observed. */
  complete: boolean;
  eventCount: number;
}

/**
 * Append a single event to a game directory. Files are created as needed.
 * Sequence numbers are assigned by counting existing newline-terminated
 * lines, which is sufficient for single-process append-only writes.
 */
type DistributiveOmit<T, K extends string> = T extends unknown ? Omit<T, K> : never;
type EventInput = DistributiveOmit<GameEvent, "seq" | "iso"> & { iso?: string };

export async function appendEvent(
  gameDir: string,
  event: EventInput,
): Promise<GameEvent> {
  await fs.mkdir(gameDir, { recursive: true });
  const filePath = path.join(gameDir, "events.jsonl");
  const seq = await nextSeq(filePath);
  const full = {
    ...event,
    seq,
    iso: event.iso ?? new Date().toISOString(),
  } as GameEvent;
  await fs.appendFile(filePath, JSON.stringify(full) + "\n", "utf8");
  return full;
}

async function nextSeq(filePath: string): Promise<number> {
  try {
    const buf = await fs.readFile(filePath, "utf8");
    if (buf.length === 0) return 0;
    let count = 0;
    for (let i = 0; i < buf.length; i++) {
      if (buf.charCodeAt(i) === 10) count++;
    }
    return count;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw err;
  }
}

export async function readEvents(gameDir: string): Promise<GameEvent[]> {
  const filePath = path.join(gameDir, "events.jsonl");
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const events: GameEvent[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    events.push(JSON.parse(line) as GameEvent);
  }
  return events;
}

export async function writeStateSnapshot(
  gameDir: string,
  state: WorldState,
): Promise<void> {
  const dir = path.join(gameDir, "state");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `turn-${state.turn}.json`),
    JSON.stringify(state, null, 2),
    "utf8",
  );
}

export async function writeBriefing(
  gameDir: string,
  turn: number,
  faction: FactionId,
  briefing: BriefingDeliveredEvent["briefing"],
): Promise<void> {
  const dir = path.join(gameDir, "briefings", `turn-${turn}`);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, `${faction}.json`),
    JSON.stringify(briefing, null, 2),
    "utf8",
  );
}

/**
 * Pure reconstruction: given the full event list, produce the in-memory
 * `GameTree`. No filesystem I/O.
 */
export function reconstructTree(events: GameEvent[]): GameTree {
  const started = events.find((e) => e.kind === "GAME_STARTED");
  if (!started || started.kind !== "GAME_STARTED") {
    throw new Error("Game has no GAME_STARTED event");
  }

  const tree: GameTree = {
    scenarioId: started.scenarioId,
    seed: started.seed,
    llmModel: started.llmModel,
    initialState: started.initialState,
    currentState: started.initialState,
    turns: [],
    briefings: {},
    complete: false,
    eventCount: events.length,
  };

  type WIP = {
    turn: number;
    actions?: Record<FactionId, Action[]>;
    playerRationales: Record<FactionId, string>;
    candidates?: OutcomeCandidate[];
    selectedCandidateId?: string;
    rngRoll?: number;
  };
  const wipByTurn = new Map<number, WIP>();
  const ensure = (turn: number): WIP => {
    let w = wipByTurn.get(turn);
    if (!w) {
      w = { turn, playerRationales: {} };
      wipByTurn.set(turn, w);
    }
    return w;
  };

  for (const e of events) {
    switch (e.kind) {
      case "FORK_FROM":
        tree.fork = { baseGameDir: e.baseGameDir, fromTurn: e.fromTurn };
        break;
      case "TURN_START":
        ensure(e.turn);
        break;
      case "PLAYER_DECISION": {
        const w = ensure(e.turn);
        w.playerRationales[e.faction] = e.rationale;
        break;
      }
      case "ACTIONS_SUBMITTED":
        ensure(e.turn).actions = e.actions;
        break;
      case "CANDIDATES_GENERATED":
        ensure(e.turn).candidates = e.candidates;
        break;
      case "OUTCOME_SELECTED": {
        const w = ensure(e.turn);
        w.selectedCandidateId = e.candidateId;
        w.rngRoll = e.rngRoll;
        break;
      }
      case "STATE_SNAPSHOT":
        tree.currentState = e.state;
        break;
      case "BRIEFING_DELIVERED":
        tree.briefings[`${e.turn}:${e.faction}`] = e.briefing;
        break;
      case "GAME_COMPLETE":
        tree.complete = true;
        break;
      case "LLM_TRACE":
      case "GAME_STARTED":
        break;
    }
  }

  const turns = [...wipByTurn.keys()].sort((a, b) => a - b);
  for (const t of turns) {
    const w = wipByTurn.get(t)!;
    if (
      w.actions &&
      w.candidates &&
      w.selectedCandidateId !== undefined &&
      w.rngRoll !== undefined
    ) {
      tree.turns.push({
        turn: w.turn,
        actions: w.actions,
        playerRationales: w.playerRationales,
        candidates: w.candidates,
        selectedCandidateId: w.selectedCandidateId,
        rngRoll: w.rngRoll,
      });
    }
  }
  return tree;
}

export async function loadTree(gameDir: string): Promise<GameTree> {
  const events = await readEvents(gameDir);
  return reconstructTree(events);
}

/** Locate the FORK_FROM event in a forked game's event log, if any. */
export function findForkFrom(events: GameEvent[]): ForkFromEvent | undefined {
  return events.find((e): e is ForkFromEvent => e.kind === "FORK_FROM");
}

/* ---------- Query helpers (the surface the UI will use) --------------- */

export function getTurn(tree: GameTree, turn: number): TurnNode | undefined {
  return tree.turns.find((t) => t.turn === turn);
}

export function getAllCandidates(tree: GameTree, turn: number): OutcomeCandidate[] {
  return getTurn(tree, turn)?.candidates ?? [];
}

export function getSelectedCandidate(
  tree: GameTree,
  turn: number,
): OutcomeCandidate | undefined {
  const t = getTurn(tree, turn);
  if (!t) return undefined;
  return t.candidates.find((c) => c.id === t.selectedCandidateId);
}

export function getCounterfactuals(
  tree: GameTree,
  turn: number,
): OutcomeCandidate[] {
  const t = getTurn(tree, turn);
  if (!t) return [];
  return t.candidates.filter((c) => c.id !== t.selectedCandidateId);
}

export function getBriefing(
  tree: GameTree,
  turn: number,
  faction: FactionId,
): BriefingDeliveredEvent["briefing"] | undefined {
  return tree.briefings[`${turn}:${faction}`];
}

export function getLlmTraces(events: GameEvent[]): LlmTraceEvent[] {
  return events.filter((e): e is LlmTraceEvent => e.kind === "LLM_TRACE");
}
