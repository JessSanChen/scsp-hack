/**
 * Per-turn engine. Sequences:
 *   1. Fan out to per-faction player agents (parallel) to get this turn's
 *      structured Action[] + rationale per faction.
 *   2. Adjudicator generates candidate outcomes (with capability
 *      citations, outcome-kind tags, escalationLevelDelta, optional
 *      forcePatches).
 *   3. Seeded weighted sample from the candidate set.
 *   4. Apply delta, write state snapshot.
 *   5. Briefer fans out per faction.
 *
 * No human-in-the-loop. Three entry points are exposed:
 *   - `runOneTurn` (advance one turn, single-step)
 *   - `runGameToCompletion` (advance until GAME_COMPLETE)
 *   - the autonomous loop respects `FORK_FROM` overrides (force-actions
 *     or pin-candidate) for the immediate fork turn.
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import {
  appendEvent,
  findForkFrom,
  loadTree,
  readEvents,
  writeBriefing,
  writeStateSnapshot,
} from "./tree.js";
import {
  applyDelta,
  type OutcomeCandidate,
  type WorldState,
} from "./state.js";
import { createRng, normaliseProbabilities, weightedSampleIndex } from "./rng.js";
import { generateCandidates } from "../adjudicator/agent.js";
import { decideFactionActions } from "../players/agent.js";
import { generateBriefing } from "../comms/briefer.js";
import type { LlmClient } from "../llm/types.js";
import type { Action, FactionId, Scenario } from "../scenario/types.js";
import type { ForkOverride } from "./events.js";

export interface GameConfigFile {
  scenarioId: string;
  scenarioName: string;
  seed: number;
  llmModel: string;
  useMock: boolean;
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

  if (tree.complete) {
    return { kind: "complete", finalTurn: tree.currentState.turn };
  }

  const nextTurn = tree.currentState.turn + 1;
  if (nextTurn > scenario.turnCount) {
    await appendEvent(gameDir, {
      kind: "GAME_COMPLETE",
      finalTurn: tree.currentState.turn,
      reason: "turn-count-reached",
    });
    return { kind: "complete", finalTurn: tree.currentState.turn };
  }

  const fork = findForkFrom(events);
  const override =
    fork?.overrides && fork.overrides.turn === nextTurn ? fork.overrides : undefined;

  await appendEvent(gameDir, { kind: "TURN_START", turn: nextTurn });

  // Recent briefings (most recent 2 turns) per faction, for context.
  const recentBriefingsByFaction: Record<FactionId, Array<{ turn: number; headline: string; bullets: string[] }>> = {};
  for (const f of scenario.factions) recentBriefingsByFaction[f.id] = [];
  for (const ev of events) {
    if (ev.kind === "BRIEFING_DELIVERED") {
      recentBriefingsByFaction[ev.faction]?.push({
        turn: ev.turn,
        headline: ev.briefing.headline,
        bullets: ev.briefing.bullets,
      });
    }
  }

  // 1. Player agents fan out (or honour an override).
  const actions: Record<FactionId, Action[]> = {};
  const rationales: Record<FactionId, string> = {};

  if (override?.kind === "force-actions" || override?.kind === "pin-candidate") {
    for (const f of scenario.factions) {
      const fromOverride = override.actions[f.id] ?? [];
      const rat = override.rationales?.[f.id]
        ?? `[override] supplied via fork at turn ${nextTurn}`;
      actions[f.id] = fromOverride;
      rationales[f.id] = rat;
      await appendEvent(gameDir, {
        kind: "PLAYER_DECISION",
        turn: nextTurn,
        faction: f.id,
        actions: fromOverride,
        rationale: rat,
        source: "override",
      });
    }
  } else {
    const playerResults = await Promise.all(
      scenario.factions.map((f) =>
        decideFactionActions(client, {
          scenario,
          faction: f,
          state: tree.currentState,
          turn: nextTurn,
          recentBriefings: recentBriefingsByFaction[f.id]?.slice(-4) ?? [],
        }),
      ),
    );
    for (const r of playerResults) {
      actions[r.faction] = r.actions;
      rationales[r.faction] = r.rationale;
      await appendEvent(gameDir, {
        kind: "LLM_TRACE",
        turn: nextTurn,
        call: `player:${r.faction}`,
        request: r.trace.request,
        response: r.trace.response,
        mock: r.trace.mock,
      });
      await appendEvent(gameDir, {
        kind: "PLAYER_DECISION",
        turn: nextTurn,
        faction: r.faction,
        actions: r.actions,
        rationale: r.rationale,
        source: "auto",
      });
    }
  }

  await appendEvent(gameDir, {
    kind: "ACTIONS_SUBMITTED",
    turn: nextTurn,
    actions,
  });

  // 2. Adjudicator candidates (or copied from override).
  let candidates: OutcomeCandidate[];
  if (override?.kind === "pin-candidate") {
    candidates = override.candidates;
    await appendEvent(gameDir, {
      kind: "CANDIDATES_GENERATED",
      turn: nextTurn,
      candidates,
    });
  } else {
    const result = await generateCandidates(client, {
      scenario,
      state: tree.currentState,
      turn: nextTurn,
      actions,
      playerRationales: rationales,
    });
    candidates = result.candidates;
    await appendEvent(gameDir, {
      kind: "LLM_TRACE",
      turn: nextTurn,
      call: "candidate-gen",
      request: result.trace.request,
      response: result.trace.response,
      mock: result.trace.mock,
    });
    await appendEvent(gameDir, {
      kind: "CANDIDATES_GENERATED",
      turn: nextTurn,
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
    actions,
    candidates,
    forcedCandidateId:
      override?.kind === "pin-candidate" ? override.candidateId : undefined,
    forcedCandidateSource:
      override?.kind === "pin-candidate" ? "pinned" : "auto",
  });
}

export async function runGameToCompletion(deps: RunOneTurnDeps): Promise<{
  finalTurn: number;
  turnsRun: number;
}> {
  let turnsRun = 0;
  for (;;) {
    const r = await runOneTurn(deps);
    if (r.kind === "complete") {
      return { finalTurn: r.finalTurn, turnsRun };
    }
    turnsRun += 1;
  }
}

/* ---------- Shared finishers ----------------------------------------- */

async function finaliseTurn(input: {
  gameDir: string;
  scenario: Scenario;
  client: LlmClient;
  config: GameConfigFile;
  state: WorldState;
  turn: number;
  actions: Record<FactionId, Action[]>;
  candidates: OutcomeCandidate[];
  forcedCandidateId?: string;
  forcedCandidateSource: "auto" | "pinned";
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
    forcedCandidateSource,
  } = input;

  const normalised = normaliseProbabilities(candidates);
  const rng = createRng(config.seed, `turn-${turn}`);
  const roll = rng.next();
  let selectedIdx: number;
  if (forcedCandidateId) {
    selectedIdx = normalised.findIndex((c) => c.id === forcedCandidateId);
    if (selectedIdx < 0) {
      throw new Error(
        `Pinned candidate '${forcedCandidateId}' not found in candidate set`,
      );
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
    source: forcedCandidateSource,
  });

  const newState = applyDelta(state, selected.stateDelta, turn);
  await writeStateSnapshot(gameDir, newState);
  await appendEvent(gameDir, {
    kind: "STATE_SNAPSHOT",
    turn,
    state: newState,
    origin: "regular",
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

  if (turn >= scenario.turnCount) {
    await appendEvent(gameDir, {
      kind: "GAME_COMPLETE",
      finalTurn: turn,
      reason: "turn-count-reached",
    });
  }

  return {
    kind: "advanced",
    turn,
    selectedCandidateId: selected.id,
    summary: selected.summary,
  };
}

/* ---------- Used by `wargame new` ------------------------------------ */

export type { ForkOverride };
