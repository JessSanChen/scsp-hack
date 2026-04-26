/**
 * Public API for the wargame adjudicator.
 *
 * Both the CLI in `src/cli/` and any future UI should call only these
 * exports. Internal modules under `engine/`, `adjudicator/`, `players/`,
 * `comms/`, `llm/`, `scenario/`, `fork/`, `campaign/` are not part of
 * the stable surface unless re-exported here.
 */

import path from "node:path";
import { promises as fs } from "node:fs";

import { loadScenario } from "./scenario/loader.js";
import { initialWorldState } from "./engine/state.js";
import {
  appendEvent,
  loadTree,
  writeStateSnapshot,
  type GameTree,
} from "./engine/tree.js";
import {
  readConfig,
  runGameToCompletion as engineRunToCompletion,
  runOneTurn,
  writeConfig,
  type GameConfigFile,
  type StepResult,
} from "./engine/runGame.js";
import { makeClient } from "./llm/factory.js";

export type { GameTree } from "./engine/tree.js";
export type { StepResult, GameConfigFile } from "./engine/runGame.js";
export type {
  Scenario,
  Faction,
  Action,
  FactionId,
  CapabilityId,
  Capability,
  ForceLevel,
} from "./scenario/types.js";
export type {
  WorldState,
  OutcomeCandidate,
  TurnNode,
  ForcePatch,
  StateDelta,
} from "./engine/state.js";
export {
  getTurn,
  getAllCandidates,
  getSelectedCandidate,
  getCounterfactuals,
  getBriefing,
} from "./engine/tree.js";

/* ---------- startGame ------------------------------------------------- */

export interface StartGameOptions {
  scenario: string;
  out: string;
  seed?: number;
  /** Use the deterministic mock LLM. Defaults to false. */
  useMock?: boolean;
  /** OpenAI model name (ignored when useMock=true). */
  llmModel?: string;
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
    createdAt: new Date().toISOString(),
  };
  await writeConfig(gameDir, config);

  const initialState = initialWorldState(scenario);
  await writeStateSnapshot(gameDir, initialState);

  await appendEvent(gameDir, {
    kind: "GAME_STARTED",
    scenarioId: scenario.id,
    seed,
    llmModel,
    initialState,
  });

  return { gameDir, config, scenarioId: scenario.id };
}

/* ---------- stepGame / runGameToCompletion --------------------------- */

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

export async function runGameToCompletion(
  gameDir: string,
  options: StepGameOptions = {},
): Promise<{ finalTurn: number; turnsRun: number }> {
  const config = await readConfig(gameDir);
  const scenario = await loadScenario(config.scenarioId, options.scenarioRoot);
  const client = makeClient(config, options);
  return engineRunToCompletion({ gameDir, scenario, client, config });
}

/* ---------- inspectGame ---------------------------------------------- */

export interface InspectOptions {
  turn?: number;
}

export interface GameView {
  config: GameConfigFile;
  tree: GameTree;
  /** When opts.turn is provided, the turn-specific subtree. */
  turnFocus?: {
    turn: number;
    actions: GameTree["turns"][number]["actions"];
    playerRationales: GameTree["turns"][number]["playerRationales"];
    candidates: GameTree["turns"][number]["candidates"];
    selectedCandidateId: string;
    rngRoll: number;
    briefings: Record<string, GameTree["briefings"][string]>;
  };
}

export async function inspectGame(
  gameDir: string,
  opts: InspectOptions = {},
): Promise<GameView> {
  const config = await readConfig(gameDir);
  const tree = await loadTree(gameDir);

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
      playerRationales: t.playerRationales,
      candidates: t.candidates,
      selectedCandidateId: t.selectedCandidateId,
      rngRoll: t.rngRoll,
      briefings,
    };
  }

  return { config, tree, turnFocus };
}

/* ---------- forkGame / campaign re-exports --------------------------- */

export { forkGame } from "./fork/index.js";
export type {
  ForkOptions,
  ForkPerturbation,
  ForkActionsOverride,
  ForkPinCandidateOverride,
} from "./fork/index.js";

export { runCampaign, aggregateCampaign } from "./campaign/index.js";
export type {
  CampaignManifest,
  CampaignArm,
  CampaignReport,
  CampaignArmReport,
} from "./campaign/index.js";

/* ---------- internals ------------------------------------------------- */

export { makeClient } from "./llm/factory.js";

function defaultSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}
