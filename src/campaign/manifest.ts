/**
 * Campaign manifest schema.
 *
 * A campaign manifest declares a Monte Carlo experiment: a base scenario,
 * a list of seeds, a set of arms (baseline + counterfactual perturbations),
 * and a parallelism cap. The runner expands this into S * A games.
 */

import { promises as fs } from "node:fs";
import { z } from "zod";
import type { ForkPerturbation } from "../fork/index.js";

const ForcePerturbationSchema = z
  .object({
    kind: z.literal("force"),
    faction: z.string().min(1),
    capability: z.string().min(1),
    quantityDelta: z.number().optional(),
    postureSet: z.enum(["garrison", "forward", "engaged", "attrited"]).optional(),
    readinessDelta: z.number().optional(),
  })
  .strict();

const ArmSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().optional(),
    perturbations: z.array(ForcePerturbationSchema).default([]),
    /**
     * Optional turn at which to apply the perturbations. When omitted,
     * perturbations apply at game start (a forked-from-turn-1 fork).
     */
    fromTurn: z.number().int().min(1).optional(),
  })
  .strict();

export const CampaignManifestSchema = z
  .object({
    baseScenario: z.string().min(1),
    seeds: z.array(z.number().int()).min(1),
    arms: z.array(ArmSchema).min(1),
    parallelism: z.number().int().min(1).default(2),
    useMock: z.boolean().default(true),
    /** Optional OpenAI model name for non-mock runs. */
    llmModel: z.string().optional(),
  })
  .strict();

export type CampaignManifest = z.infer<typeof CampaignManifestSchema>;
export type CampaignArm = z.infer<typeof ArmSchema>;
export type ForcePerturbationDecl = z.infer<typeof ForcePerturbationSchema>;

export async function loadCampaignManifest(filePath: string): Promise<CampaignManifest> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw);
  return CampaignManifestSchema.parse(parsed);
}

/** Resolve manifest perturbations to engine-level ForcePatch list. */
export function manifestPerturbationsToPatches(
  arm: CampaignArm,
): ForkPerturbation[] {
  const out: ForkPerturbation[] = [];
  for (const p of arm.perturbations) {
    out.push({
      factionId: p.faction,
      capabilityId: p.capability,
      ...(p.quantityDelta !== undefined ? { quantityDelta: p.quantityDelta } : {}),
      ...(p.postureSet !== undefined ? { postureSet: p.postureSet } : {}),
      ...(p.readinessDelta !== undefined ? { readinessDelta: p.readinessDelta } : {}),
    });
  }
  return out;
}
