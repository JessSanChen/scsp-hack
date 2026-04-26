/**
 * Loads a scenario from `scenarios/<name>/`.
 *
 * Each scenario is two files:
 *  - `scenario.json`  static config (factions, regions, initial timeline)
 *  - `actions.json`   pre-scripted player actions per turn (demo stand-in)
 *
 * Loader is deliberately strict: any malformed/missing field throws so
 * scenario authors get a clear error at game-start time rather than mid-turn.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Scenario } from "./types.js";

const FactionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  brief: z.string().min(1),
  objectives: z.array(z.string()).min(1),
  initialPosture: z.string().min(1),
});

const RegionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  initialPresence: z.array(z.string()),
  initialControl: z.string().nullable().optional(),
});

const ActionSchema = z.object({
  id: z.string().min(1),
  faction: z.string().min(1),
  summary: z.string().min(1),
  details: z.string().optional(),
});

const ScenarioFileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  factions: z.array(FactionSchema).min(1),
  regions: z.array(RegionSchema).min(1),
  initialTimeline: z.array(z.string()).min(1),
  turnCount: z.number().int().positive(),
});

const ScriptedTurnSchema = z.object({
  turn: z.number().int().positive(),
  narrative: z.string().optional(),
  actions: z.record(z.string(), z.array(ActionSchema).min(1)),
});

const ActionsFileSchema = z.object({
  scriptedTurns: z.array(ScriptedTurnSchema).min(1),
});

/** Resolve a scenario by name from the bundled `scenarios/` directory. */
export function resolveScenarioDir(name: string, scenarioRoot?: string): string {
  const root = scenarioRoot ?? path.resolve(process.cwd(), "scenarios");
  return path.join(root, name);
}

export async function loadScenario(name: string, scenarioRoot?: string): Promise<Scenario> {
  const dir = resolveScenarioDir(name, scenarioRoot);
  const [scenarioRaw, actionsRaw] = await Promise.all([
    fs.readFile(path.join(dir, "scenario.json"), "utf8"),
    fs.readFile(path.join(dir, "actions.json"), "utf8"),
  ]);
  const parsedScenario = ScenarioFileSchema.parse(JSON.parse(scenarioRaw));
  const parsedActions = ActionsFileSchema.parse(JSON.parse(actionsRaw));

  const factionIds = new Set(parsedScenario.factions.map((f) => f.id));

  for (const turn of parsedActions.scriptedTurns) {
    for (const factionId of Object.keys(turn.actions)) {
      if (!factionIds.has(factionId)) {
        throw new Error(
          `Scenario '${name}' turn ${turn.turn} references unknown faction '${factionId}'`,
        );
      }
    }
  }

  for (const region of parsedScenario.regions) {
    for (const f of region.initialPresence) {
      if (!factionIds.has(f)) {
        throw new Error(
          `Scenario '${name}' region '${region.id}' references unknown faction '${f}'`,
        );
      }
    }
    if (region.initialControl && !factionIds.has(region.initialControl)) {
      throw new Error(
        `Scenario '${name}' region '${region.id}' has unknown initialControl '${region.initialControl}'`,
      );
    }
  }

  return {
    ...parsedScenario,
    regions: parsedScenario.regions.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      initialPresence: r.initialPresence,
      initialControl: r.initialControl ?? undefined,
    })),
    scriptedTurns: parsedActions.scriptedTurns,
  };
}
