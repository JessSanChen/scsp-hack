/**
 * Public API for the wargame adjudicator.
 *
 * Both the CLI in `src/cli/` and any future UI should call only these
 * exports. Internal modules under `engine/`, `adjudicator/`, `comms/`,
 * `llm/`, and `scenario/` are not part of the stable surface.
 */

import path from "node:path";
import { promises as fs } from "node:fs";

import { loadScenario } from "./scenario/loader.js";
import { initialWorldState } from "./engine/state.js";
import {
  appendEvent,
  loadTree,
  readPending,
  writeStateSnapshot,
  type GameTree,
  type PendingQuestion,
} from "./engine/tree.js";
import {
  readConfig,
  resumeTurnAfterAnswer,
  runOneTurn,
  writeConfig,
  type GameConfigFile,
  type StepResult,
} from "./engine/runGame.js";
import { createOpenAiClient } from "./llm/openai.js";
import { createMockClient } from "./llm/mock.js";
import {
  DEFAULT_HEURISTICS,
  type HeuristicsConfig,
} from "./adjudicator/heuristics.js";
import type { LlmClient } from "./llm/types.js";

export type { GameTree, PendingQuestion } from "./engine/tree.js";
export type { StepResult, GameConfigFile } from "./engine/runGame.js";
export type { HeuristicsConfig } from "./adjudicator/heuristics.js";
export type { Scenario, Faction, Action, FactionId } from "./scenario/types.js";
export type {
  WorldState,
  OutcomeCandidate,
  EscalationRecord,
  TurnNode,
} from "./engine/state.js";
export {
  getTurn,
  getAllCandidates,
  getSelectedCandidate,
  getCounterfactuals,
  getEscalations,
  getBriefing,
} from "./engine/tree.js";

/* ---------- startGame ------------------------------------------------- */

export interface StartGameOptions {
  /** Scenario name under `scenarios/`, e.g. "taiwan-2026". */
  scenario: string;
  /** Game directory to create / overwrite. */
  out: string;
  seed?: number;
  heuristics?: Partial<HeuristicsConfig>;
  /** Use the deterministic mock LLM. Defaults to false. */
  useMock?: boolean;
  /** OpenAI model name (ignored when useMock=true). */
  llmModel?: string;
  /** OpenAI API key override (ignored when useMock=true). */
  openAiApiKey?: string;
  /** Override scenarios root for tests. */
  scenarioRoot?: string;
  /** Throw if the game directory already has any non-config files. */
  failIfExists?: boolean;
}

export interface GameHandle {
  gameDir: string;
  config: GameConfigFile;
  scenarioId: string;
}

export async function startGame(opts: StartGameOptions): Promise<GameHandle> {
  const scenario = await loadScenario(opts.scenario, opts.scenarioRoot);
  const seed = opts.seed ?? defaultSeed();
  const useMock = opts.useMock ?? false;
  const heuristics: HeuristicsConfig = {
    ...DEFAULT_HEURISTICS,
    ...(opts.heuristics ?? {}),
  };

  const gameDir = path.resolve(opts.out);

  if (opts.failIfExists) {
    try {
      const stat = await fs.stat(gameDir);
      if (stat.isDirectory()) {
        const entries = await fs.readdir(gameDir);
        if (entries.length > 0) {
          throw new Error(
            `Game directory '${gameDir}' is not empty. Refusing to overwrite.`,
          );
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  await fs.mkdir(gameDir, { recursive: true });

  const llmModel = useMock ? "mock-llm-v1" : opts.llmModel ?? "gpt-4o-mini";

  const config: GameConfigFile = {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    seed,
    llmModel,
    useMock,
    heuristics,
    createdAt: new Date().toISOString(),
  };
  await writeConfig(gameDir, config);

  const initialState = initialWorldState(scenario);
  await writeStateSnapshot(gameDir, initialState);

  await appendEvent(gameDir, {
    kind: "GAME_STARTED",
    scenarioId: scenario.id,
    seed,
    heuristics,
    llmModel,
    initialState,
  });

  return { gameDir, config, scenarioId: scenario.id };
}

/* ---------- stepGame -------------------------------------------------- */

export interface StepGameOptions {
  /** Override mock/openai for this call. Defaults to config.useMock. */
  useMock?: boolean;
  openAiApiKey?: string;
  scenarioRoot?: string;
}

export async function stepGame(
  gameDir: string,
  options: StepGameOptions = {},
): Promise<StepResult> {
  const config = await readConfig(gameDir);
  const scenario = await loadScenario(config.scenarioId, options.scenarioRoot);
  const client = makeClient(config, options);
  return runOneTurn({ gameDir, scenario, client, config });
}

/* ---------- getPending ----------------------------------------------- */

export async function getPending(gameDir: string): Promise<PendingQuestion | null> {
  return readPending(gameDir);
}

/* ---------- answerEscalation ----------------------------------------- */

export interface AnswerEscalationInput {
  text?: string;
  chooseCandidateId?: string;
}

export async function answerEscalation(
  gameDir: string,
  answer: AnswerEscalationInput,
  options: StepGameOptions = {},
): Promise<StepResult> {
  const config = await readConfig(gameDir);
  const scenario = await loadScenario(config.scenarioId, options.scenarioRoot);
  const client = makeClient(config, options);
  return resumeTurnAfterAnswer({
    gameDir,
    scenario,
    client,
    config,
    answer,
  });
}

/* ---------- inspectGame ---------------------------------------------- */

export interface InspectOptions {
  turn?: number;
}

export interface GameView {
  config: GameConfigFile;
  tree: GameTree;
  pending: PendingQuestion | null;
  /** When opts.turn is provided, the turn-specific subtree. */
  turnFocus?: {
    turn: number;
    actions: GameTree["turns"][number]["actions"];
    candidates: GameTree["turns"][number]["candidates"];
    selectedCandidateId: string;
    rngRoll: number;
    escalation?: GameTree["turns"][number]["escalation"];
    briefings: Record<string, GameTree["briefings"][string]>;
  };
}

export async function inspectGame(
  gameDir: string,
  opts: InspectOptions = {},
): Promise<GameView> {
  const config = await readConfig(gameDir);
  const tree = await loadTree(gameDir);
  const pending = await readPending(gameDir);

  let turnFocus: GameView["turnFocus"];
  if (opts.turn !== undefined) {
    const t = tree.turns.find((x) => x.turn === opts.turn);
    if (!t) {
      throw new Error(`Turn ${opts.turn} not found in game tree`);
    }
    const briefings: Record<string, GameTree["briefings"][string]> = {};
    for (const [k, v] of Object.entries(tree.briefings)) {
      const [turnStr] = k.split(":");
      if (turnStr && Number(turnStr) === opts.turn) briefings[k] = v;
    }
    turnFocus = {
      turn: t.turn,
      actions: t.actions,
      candidates: t.candidates,
      selectedCandidateId: t.selectedCandidateId,
      rngRoll: t.rngRoll,
      ...(t.escalation ? { escalation: t.escalation } : {}),
      briefings,
    };
  }

  return { config, tree, pending, turnFocus };
}

/* ---------- internals ------------------------------------------------- */

function makeClient(config: GameConfigFile, opts: StepGameOptions): LlmClient {
  const useMock = opts.useMock ?? config.useMock;
  if (useMock) return createMockClient();
  return createOpenAiClient({
    apiKey: opts.openAiApiKey,
    model: config.llmModel,
  });
}

function defaultSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}
