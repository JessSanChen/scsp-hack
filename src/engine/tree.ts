/**
 * The "tree" of game decisions.
 *
 * On disk, a game is an append-only JSONL event log + per-turn state
 * snapshots in a sibling directory. In memory, we reconstruct a
 * `GameTree`: an ordered list of `TurnNode`s carrying actions,
 * candidates, the selected branch, and any escalation. This is what a
 * future UI will read.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Action, FactionId } from "../scenario/types.js";
import type {
  EscalationRecord,
  OutcomeCandidate,
  TurnNode,
  WorldState,
} from "./state.js";
import type {
  BriefingDeliveredEvent,
  GameEvent,
  HeuristicsSnapshot,
  LlmTraceEvent,
} from "./events.js";

export interface GameTree {
  scenarioId: string;
  seed: number;
  llmModel: string;
  heuristics: HeuristicsSnapshot;
  initialState: WorldState;
  /** Latest known state (may equal initialState if no turn has resolved). */
  currentState: WorldState;
  /** Resolved turns in order. */
  turns: TurnNode[];
  /** Briefings keyed by `${turn}:${faction}`. */
  briefings: Record<string, BriefingDeliveredEvent["briefing"]>;
  /** Open escalation, if any, that has not yet resolved. */
  openEscalation?: { turn: number; reasons: string[]; question: string };
  /** Total events appended so far. */
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
    heuristics: started.heuristics,
    initialState: started.initialState,
    currentState: started.initialState,
    turns: [],
    briefings: {},
    eventCount: events.length,
  };

  type WIP = {
    turn: number;
    actions?: Record<FactionId, Action[]>;
    candidates?: OutcomeCandidate[];
    selectedCandidateId?: string;
    rngRoll?: number;
    escalation?: EscalationRecord;
    pendingEscalation?: { reasons: string[]; question: string };
  };
  const wipByTurn = new Map<number, WIP>();
  const ensure = (turn: number): WIP => {
    let w = wipByTurn.get(turn);
    if (!w) {
      w = { turn };
      wipByTurn.set(turn, w);
    }
    return w;
  };

  for (const e of events) {
    switch (e.kind) {
      case "TURN_START":
        ensure(e.turn);
        break;
      case "ACTIONS_SUBMITTED":
        ensure(e.turn).actions = e.actions;
        break;
      case "CANDIDATES_GENERATED":
        ensure(e.turn).candidates = e.candidates;
        break;
      case "ESCALATION_REQUESTED":
        ensure(e.turn).pendingEscalation = {
          reasons: e.reasons,
          question: e.question,
        };
        tree.openEscalation = {
          turn: e.turn,
          reasons: e.reasons,
          question: e.question,
        };
        break;
      case "ESCALATION_RESOLVED": {
        const w = ensure(e.turn);
        w.escalation = e.record;
        delete w.pendingEscalation;
        if (tree.openEscalation && tree.openEscalation.turn === e.turn) {
          tree.openEscalation = undefined;
        }
        break;
      }
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
        candidates: w.candidates,
        selectedCandidateId: w.selectedCandidateId,
        rngRoll: w.rngRoll,
        escalation: w.escalation,
      });
    }
  }
  return tree;
}

export async function loadTree(gameDir: string): Promise<GameTree> {
  const events = await readEvents(gameDir);
  return reconstructTree(events);
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

export function getEscalations(tree: GameTree): Array<{ turn: number; record: EscalationRecord }> {
  return tree.turns
    .filter((t) => t.escalation)
    .map((t) => ({ turn: t.turn, record: t.escalation! }));
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

/* ---------- Pending-question I/O (persisted async escalation) --------- */

export interface PendingQuestion {
  turn: number;
  reasons: string[];
  question: string;
  /** The candidate set at the moment of escalation, for reference. */
  candidates: OutcomeCandidate[];
  /** Concise state summary for the human. */
  stateSummary: string;
  iso: string;
}

export async function writePending(
  gameDir: string,
  pending: PendingQuestion,
): Promise<void> {
  await fs.mkdir(gameDir, { recursive: true });
  await fs.writeFile(
    path.join(gameDir, "pending.json"),
    JSON.stringify(pending, null, 2),
    "utf8",
  );
}

export async function readPending(gameDir: string): Promise<PendingQuestion | null> {
  try {
    const raw = await fs.readFile(path.join(gameDir, "pending.json"), "utf8");
    return JSON.parse(raw) as PendingQuestion;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function clearPending(gameDir: string): Promise<void> {
  try {
    await fs.unlink(path.join(gameDir, "pending.json"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
