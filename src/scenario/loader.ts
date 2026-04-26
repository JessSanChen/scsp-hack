/**
 * Loads a scenario from `scenarios/<name>/scenario.json`.
 *
 * Strict schema: any malformed/missing field throws at load time so
 * authors get a clear error before a game starts.
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

const CapabilitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  faction: z.string().min(1),
  description: z.string().min(1),
  unit: z.string().min(1),
});

const ForceLevelSchema = z.object({
  quantity: z.number().nonnegative(),
  posture: z.enum(["garrison", "forward", "engaged", "attrited"]),
  readiness: z.number().min(0).max(100),
});

const ScenarioFileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  factions: z.array(FactionSchema).min(1),
  regions: z.array(RegionSchema).min(1),
  initialTimeline: z.array(z.string()).min(1),
  turnCount: z.number().int().positive(),
  capabilities: z.array(CapabilitySchema).min(1),
  initialForces: z.record(z.string(), z.record(z.string(), ForceLevelSchema)),
  actionKinds: z.array(z.string()).min(1),
  outcomeKinds: z.array(z.string()).min(1),
});

export function resolveScenarioDir(name: string, scenarioRoot?: string): string {
  const root = scenarioRoot ?? path.resolve(process.cwd(), "scenarios");
  return path.join(root, name);
}

export async function loadScenario(name: string, scenarioRoot?: string): Promise<Scenario> {
  const dir = resolveScenarioDir(name, scenarioRoot);
  const scenarioRaw = await fs.readFile(path.join(dir, "scenario.json"), "utf8");
  const parsed = ScenarioFileSchema.parse(JSON.parse(scenarioRaw));

  const factionIds = new Set(parsed.factions.map((f) => f.id));
  const capabilityIds = new Set(parsed.capabilities.map((c) => c.id));

  for (const region of parsed.regions) {
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

  for (const cap of parsed.capabilities) {
    if (!factionIds.has(cap.faction)) {
      throw new Error(
        `Scenario '${name}' capability '${cap.id}' references unknown faction '${cap.faction}'`,
      );
    }
  }

  for (const [factionId, forces] of Object.entries(parsed.initialForces)) {
    if (!factionIds.has(factionId)) {
      throw new Error(
        `Scenario '${name}' initialForces references unknown faction '${factionId}'`,
      );
    }
    for (const capId of Object.keys(forces)) {
      if (!capabilityIds.has(capId)) {
        throw new Error(
          `Scenario '${name}' initialForces['${factionId}'] references unknown capability '${capId}'`,
        );
      }
    }
  }

  return {
    ...parsed,
    regions: parsed.regions.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      initialPresence: r.initialPresence,
      initialControl: r.initialControl ?? undefined,
    })),
  };
}
