/**
 * Per-turn engine. Sequences:
 *   1. Read scripted actions for the turn.
 *   2. Adjudicator generates candidate outcomes.
 *   3. Heuristics decide whether to escalate to a human.
 *      - If yes: persist `pending.json` + ESCALATION_REQUESTED and exit.
 *   4. Otherwise (or after `resumeTurnAfterAnswer`): sample, apply delta,
 *      generate per-faction briefings, write snapshot.
 *
 * The two entry points are `runOneTurn` (start a new turn) and
 * `resumeTurnAfterAnswer` (continue after a human supplies an answer).
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import {
  appendEvent,
  clearPending,
  loadTree,
  readEvents,
  readPending,
  writeBriefing,
  writePending,
  writeStateSnapshot,
  type GameTree,
  type PendingQuestion,
} from "./tree.js";
import {
  applyDelta,
  type EscalationRecord,
  type OutcomeCandidate,
  type WorldState,
} from "./state.js";
import { createRng, normaliseProbabilities, weightedSampleIndex } from "./rng.js";
import { generateCandidates } from "../adjudicator/agent.js";
import { generateBriefing } from "../comms/briefer.js";
import {
  buildEscalationQuestion,
} from "../adjudicator/prompts.js";
import {
  shouldEscalate,
  previousEscalationTurns,
  type HeuristicsConfig,
} from "../adjudicator/heuristics.js";
import type { LlmClient } from "../llm/types.js";
import type { Action, FactionId, Scenario } from "../scenario/types.js";
import type { GameEvent } from "./events.js";

export interface GameConfigFile {
  scenarioId: string;
  scenarioName: string;
  seed: number;
  llmModel: string;
  useMock: boolean;
  heuristics: HeuristicsConfig;
  createdAt: string;
}

export async function readConfig(gameDir: string): Promise<GameConfigFile> {
  const raw = await fs.readFile(path.join(gameDir, "config.json"), "utf8");
  return JSON.parse(raw) as GameConfigFile;
}

export async function writeConfig(
  gameDir: string,
  config: GameConfigFile,
): Promise<void> {
  await fs.mkdir(gameDir, { recursive: true });
  await fs.writeFile(
    path.join(gameDir, "config.json"),
    JSON.stringify(config, null, 2),
    "utf8",
  );
}

/* ---------- Turn execution ------------------------------------------- */

export type StepResult =
  | {
      kind: "advanced";
      turn: number;
      selectedCandidateId: string;
      summary: string;
    }
  | {
      kind: "pending";
      turn: number;
      question: string;
      reasons: string[];
    }
  | {
      kind: "complete";
      finalTurn: number;
    };

export interface RunOneTurnDeps {
  gameDir: string;
  scenario: Scenario;
  client: LlmClient;
  config: GameConfigFile;
}

export async function runOneTurn(deps: RunOneTurnDeps): Promise<StepResult> {
  const { gameDir, scenario, client, config } = deps;
  const events = await readEvents(gameDir);
  const tree = await loadTree(gameDir);

  const pending = await readPending(gameDir);
  if (pending) {
    return {
      kind: "pending",
      turn: pending.turn,
      question: pending.question,
      reasons: pending.reasons,
    };
  }

  const nextTurn = tree.currentState.turn + 1;
  if (nextTurn > scenario.turnCount) {
    return { kind: "complete", finalTurn: tree.currentState.turn };
  }

  const scripted = scenario.scriptedTurns.find((t) => t.turn === nextTurn);
  if (!scripted) {
    throw new Error(
      `Scenario '${scenario.id}' has no scripted actions for turn ${nextTurn}`,
    );
  }

  await appendEvent(gameDir, { kind: "TURN_START", turn: nextTurn });
  await appendEvent(gameDir, {
    kind: "ACTIONS_SUBMITTED",
    turn: nextTurn,
    actions: scripted.actions,
  });

  const { candidates, trace } = await generateCandidates(
    client,
    {
      scenario,
      state: tree.currentState,
      turn: nextTurn,
      actions: scripted.actions,
    },
    "primary",
  );

  await appendEvent(gameDir, {
    kind: "LLM_TRACE",
    turn: nextTurn,
    call: "candidate-gen",
    request: trace.request,
    response: trace.response,
    mock: trace.mock,
  });
  await appendEvent(gameDir, {
    kind: "CANDIDATES_GENERATED",
    turn: nextTurn,
    phase: "primary",
    candidates,
  });

  const decision = shouldEscalate({
    turn: nextTurn,
    candidates,
    config: config.heuristics,
    prevEscalationTurns: previousEscalationTurns(events),
  });

  if (decision.escalate) {
    return finalisePending({
      gameDir,
      turn: nextTurn,
      state: tree.currentState,
      actions: scripted.actions,
      reasons: decision.reasons,
      candidates,
    });
  }

  return finaliseTurn({
    gameDir,
    scenario,
    client,
    config,
    state: tree.currentState,
    turn: nextTurn,
    actions: scripted.actions,
    candidates,
    escalation: undefined,
  });
}

/* ---------- Resume after a human answer ------------------------------ */

export interface ResumeTurnDeps {
  gameDir: string;
  scenario: Scenario;
  client: LlmClient;
  config: GameConfigFile;
  answer: { text?: string; chooseCandidateId?: string };
}

export async function resumeTurnAfterAnswer(
  deps: ResumeTurnDeps,
): Promise<StepResult> {
  const { gameDir, scenario, client, config, answer } = deps;
  const pending = await readPending(gameDir);
  if (!pending) {
    throw new Error(
      "No pending escalation to resume. Use 'wargame step' to start a new turn.",
    );
  }
  const turn = pending.turn;

  const tree = await loadTree(gameDir);
  // The state we're stepping FROM is the state after turn-1, i.e. before this turn ran.
  const stateBefore = tree.currentState;
  const scripted = scenario.scriptedTurns.find((t) => t.turn === turn);
  if (!scripted) {
    throw new Error(`Scenario has no scripted actions for turn ${turn}`);
  }

  let candidates: OutcomeCandidate[] = pending.candidates;
  let humanChoseCandidateId: string | undefined;

  if (answer.chooseCandidateId) {
    const exists = candidates.find((c) => c.id === answer.chooseCandidateId);
    if (!exists) {
      throw new Error(
        `Candidate id '${answer.chooseCandidateId}' not found in pending question`,
      );
    }
    humanChoseCandidateId = answer.chooseCandidateId;
  } else if (answer.text && answer.text.trim().length > 0) {
    const { candidates: regenerated, trace } = await generateCandidates(
      client,
      {
        scenario,
        state: stateBefore,
        turn,
        actions: scripted.actions,
        humanGuidance: answer.text,
      },
      "post-escalation",
    );
    candidates = regenerated;
    await appendEvent(gameDir, {
      kind: "LLM_TRACE",
      turn,
      call: "post-escalation",
      request: trace.request,
      response: trace.response,
      mock: trace.mock,
    });
    await appendEvent(gameDir, {
      kind: "CANDIDATES_GENERATED",
      turn,
      phase: "post-escalation",
      candidates,
    });
  } else {
    throw new Error(
      "answerEscalation requires either { text: string } or { chooseCandidateId: string }",
    );
  }

  const escalation: EscalationRecord = {
    reasons: pending.reasons,
    question: pending.question,
    askedAtTurn: turn,
    askedAtIso: pending.iso,
    humanResponseText: answer.text,
    humanChoseCandidateId,
    resolvedAtIso: new Date().toISOString(),
  };

  await appendEvent(gameDir, {
    kind: "ESCALATION_RESOLVED",
    turn,
    record: escalation,
  });
  await clearPending(gameDir);

  return finaliseTurn({
    gameDir,
    scenario,
    client,
    config,
    state: stateBefore,
    turn,
    actions: scripted.actions,
    candidates,
    escalation,
    forcedCandidateId: humanChoseCandidateId,
  });
}

/* ---------- Shared finishers ----------------------------------------- */

async function finalisePending(input: {
  gameDir: string;
  turn: number;
  state: WorldState;
  actions: Record<FactionId, Action[]>;
  reasons: string[];
  candidates: OutcomeCandidate[];
}): Promise<StepResult> {
  const { gameDir, turn, state, actions, reasons, candidates } = input;
  const { question, stateSummary } = buildEscalationQuestion({
    turn,
    state,
    actions,
    reasons,
    candidates: candidates.map((c) => ({
      summary: `[${c.id}] ${c.summary}`,
      probability: c.probability,
      consequentiality: c.consequentiality,
    })),
  });

  await appendEvent(gameDir, {
    kind: "ESCALATION_REQUESTED",
    turn,
    reasons,
    question,
  });

  const pending: PendingQuestion = {
    turn,
    reasons,
    question,
    candidates,
    stateSummary,
    iso: new Date().toISOString(),
  };
  await writePending(gameDir, pending);

  return { kind: "pending", turn, question, reasons };
}

async function finaliseTurn(input: {
  gameDir: string;
  scenario: Scenario;
  client: LlmClient;
  config: GameConfigFile;
  state: WorldState;
  turn: number;
  actions: Record<FactionId, Action[]>;
  candidates: OutcomeCandidate[];
  escalation?: EscalationRecord;
  forcedCandidateId?: string;
}): Promise<StepResult> {
  const {
    gameDir,
    scenario,
    client,
    config,
    state,
    turn,
    actions,
    candidates,
    forcedCandidateId,
  } = input;

  const normalised = normaliseProbabilities(candidates);
  const rng = createRng(config.seed, `turn-${turn}`);
  const roll = rng.next();
  let selectedIdx: number;
  if (forcedCandidateId) {
    selectedIdx = normalised.findIndex((c) => c.id === forcedCandidateId);
    if (selectedIdx < 0) {
      throw new Error(`Forced candidate '${forcedCandidateId}' not found in normalised set`);
    }
  } else {
    selectedIdx = weightedSampleIndex(normalised, roll);
  }
  const selected = normalised[selectedIdx]!;

  await appendEvent(gameDir, {
    kind: "OUTCOME_SELECTED",
    turn,
    candidateId: selected.id,
    rngRoll: roll,
    appliedDelta: selected.stateDelta,
  });

  const newState = applyDelta(state, selected.stateDelta, turn);
  await writeStateSnapshot(gameDir, newState);
  await appendEvent(gameDir, {
    kind: "STATE_SNAPSHOT",
    turn,
    state: newState,
  });

  for (const f of scenario.factions) {
    const factionActions = actions[f.id] ?? [];
    const briefingResp = await generateBriefing(client, {
      scenario,
      faction: f.id,
      turn,
      state: newState,
      selected,
      factionActions,
    });
    await appendEvent(gameDir, {
      kind: "LLM_TRACE",
      turn,
      call: `briefer:${f.id}`,
      request: { faction: f.id },
      response: briefingResp.raw,
      mock: briefingResp.mock,
    });
    await appendEvent(gameDir, {
      kind: "BRIEFING_DELIVERED",
      turn,
      faction: f.id,
      briefing: briefingResp.parsed,
    });
    await writeBriefing(gameDir, turn, f.id, briefingResp.parsed);
  }

  return {
    kind: "advanced",
    turn,
    selectedCandidateId: selected.id,
    summary: selected.summary,
  };
}
