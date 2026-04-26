/**
 * forkGame: produce a counterfactual game branch.
 *
 * A fork is a brand-new game directory whose `events.jsonl` starts as
 * a copy of the base game's events through the STATE_SNAPSHOT for
 * `fromTurn - 1`, plus a `FORK_FROM` event that records lineage and any
 * overrides. Subsequent turns are then resolved autonomously.
 *
 * Three counterfactual axes are supported:
 *   - Force-structure perturbations applied to the snapshot before
 *     `fromTurn` runs (e.g. -1 CSG, +4 SSN, repostured cyber teams).
 *   - Force-actions override at `fromTurn`: skip the player agents and
 *     use the supplied actions for that turn.
 *   - Pin-candidate override at `fromTurn`: use the supplied candidate
 *     set and force-select the chosen candidate id.
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import {
  type GameEvent,
  type ForkOverride,
  type ForcePatch,
} from "../engine/events.js";
import { copyBasePrefix, writeForkSeam } from "./replay.js";
import {
  readConfig,
  runGameToCompletion as engineRunToCompletion,
  writeConfig,
  type GameConfigFile,
} from "../engine/runGame.js";
import { loadScenario } from "../scenario/loader.js";
import { makeClient } from "../llm/factory.js";
import type { Action, FactionId } from "../scenario/types.js";
import type { OutcomeCandidate } from "../engine/state.js";
import { readEvents } from "../engine/tree.js";

export type ForkPerturbation = ForcePatch;

export interface ForkActionsOverride {
  kind: "force-actions";
  actions: Record<FactionId, Action[]>;
  rationales?: Record<FactionId, string>;
}

export interface ForkPinCandidateOverride {
  kind: "pin-candidate";
  candidateId: string;
  /**
   * Candidate set used for the pinned turn. If not supplied, the fork
   * loader copies the candidates from the base game's CANDIDATES_GENERATED
   * event at `fromTurn`.
   */
  candidates?: OutcomeCandidate[];
  /** Likewise, optional override of the actions for this turn. */
  actions?: Record<FactionId, Action[]>;
  rationales?: Record<FactionId, string>;
}

export interface ForkOptions {
  /** Resolve to a fresh game directory. */
  out: string;
  /** Turn at which the counterfactual takes effect (>= 1). */
  fromTurn: number;
  /** Force-structure patches applied to the snapshot before the fork turn. */
  perturbations?: ForkPerturbation[];
  /** Optional override for the immediate fork turn. */
  override?: ForkActionsOverride | ForkPinCandidateOverride;
  /** Override the seed for the forked game (default: base.seed XOR fromTurn). */
  seed?: number;
  /** Drive the forked game's runner with the mock LLM. */
  useMock?: boolean;
  /** Resolve scenarios from a non-default root (used by tests). */
  scenarioRoot?: string;
  /** When true, run all remaining turns; when false, just write seam. */
  resume?: boolean;
}

export interface ForkResult {
  forkDir: string;
  baseGameDir: string;
  fromTurn: number;
  finalTurn?: number;
  turnsRun?: number;
}

export async function forkGame(
  baseGameDir: string,
  opts: ForkOptions,
): Promise<ForkResult> {
  const forkDir = path.resolve(opts.out);
  const baseAbs = path.resolve(baseGameDir);
  if (forkDir === baseAbs) {
    throw new Error(`Fork output directory must differ from the base game directory`);
  }
  await fs.mkdir(forkDir, { recursive: true });
  const baseConfig = await readConfig(baseAbs);
  const seed = opts.seed ?? (baseConfig.seed ^ (opts.fromTurn * 0x9e3779b1)) >>> 0;
  const useMock = opts.useMock ?? baseConfig.useMock;

  // Copy event prefix and state snapshots.
  const { stateAfterPrefix } = await copyBasePrefix(baseAbs, opts.fromTurn, forkDir);

  // Resolve overrides. For pin-candidate without supplied candidates, pull
  // them from the base game's CANDIDATES_GENERATED at the target turn.
  let resolvedOverride: ForkOverride | undefined;
  if (opts.override) {
    if (opts.override.kind === "force-actions") {
      resolvedOverride = {
        kind: "force-actions",
        turn: opts.fromTurn,
        actions: opts.override.actions,
        ...(opts.override.rationales ? { rationales: opts.override.rationales } : {}),
      };
    } else {
      const pinOverride = opts.override;
      const baseEvents = await readEvents(baseAbs);
      const candidates = pinOverride.candidates
        ?? extractCandidatesAt(baseEvents, opts.fromTurn);
      const actions = pinOverride.actions
        ?? extractActionsAt(baseEvents, opts.fromTurn);
      if (!candidates || candidates.length === 0) {
        throw new Error(
          `Cannot pin candidate at turn ${opts.fromTurn}: base game has no CANDIDATES_GENERATED for that turn`,
        );
      }
      if (!actions) {
        throw new Error(
          `Cannot pin candidate at turn ${opts.fromTurn}: base game has no ACTIONS_SUBMITTED for that turn`,
        );
      }
      if (!candidates.some((c) => c.id === pinOverride.candidateId)) {
        throw new Error(
          `Pinned candidate id '${pinOverride.candidateId}' not found in base candidate set at turn ${opts.fromTurn}`,
        );
      }
      resolvedOverride = {
        kind: "pin-candidate",
        turn: opts.fromTurn,
        candidateId: pinOverride.candidateId,
        candidates,
        actions,
        ...(pinOverride.rationales ? { rationales: pinOverride.rationales } : {}),
      };
    }
  }

  const config: GameConfigFile = {
    scenarioId: baseConfig.scenarioId,
    scenarioName: baseConfig.scenarioName,
    seed,
    llmModel: useMock ? "mock-llm-v1" : baseConfig.llmModel,
    useMock,
    createdAt: new Date().toISOString(),
  };
  await writeConfig(forkDir, config);

  await writeForkSeam(forkDir, {
    baseGameDir: baseAbs,
    fromTurn: opts.fromTurn,
    perturbations: opts.perturbations ?? [],
    overrides: resolvedOverride,
    stateBefore: stateAfterPrefix,
  });

  if (opts.resume === false) {
    return { forkDir, baseGameDir: baseAbs, fromTurn: opts.fromTurn };
  }

  // Run forked turns to completion.
  const scenario = await loadScenario(config.scenarioId, opts.scenarioRoot);
  const client = makeClient(config, { useMock });
  const summary = await engineRunToCompletion({
    gameDir: forkDir,
    scenario,
    client,
    config,
  });
  return {
    forkDir,
    baseGameDir: baseAbs,
    fromTurn: opts.fromTurn,
    finalTurn: summary.finalTurn,
    turnsRun: summary.turnsRun,
  };
}

function extractCandidatesAt(
  events: GameEvent[],
  turn: number,
): OutcomeCandidate[] | undefined {
  for (const e of events) {
    if (e.kind === "CANDIDATES_GENERATED" && e.turn === turn) return e.candidates;
  }
  return undefined;
}

function extractActionsAt(
  events: GameEvent[],
  turn: number,
): Record<FactionId, Action[]> | undefined {
  for (const e of events) {
    if (e.kind === "ACTIONS_SUBMITTED" && e.turn === turn) return e.actions;
  }
  return undefined;
}
