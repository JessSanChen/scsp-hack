/**
 * Campaign runner.
 *
 * Expands a manifest into seeds * arms games and runs them in parallel
 * with a worker pool capped at `manifest.parallelism`. Each baseline game
 * is a normal `runGameToCompletion`; non-baseline arms are baseline forks
 * with the arm's force perturbations applied at `fromTurn` (default: 1,
 * i.e. perturbed initial conditions).
 *
 * Layout:
 *   <campaignDir>/
 *     manifest.json
 *     games/
 *       <armId>/
 *         <seed>/   (full game directory)
 */

import path from "node:path";
import { promises as fs } from "node:fs";
import {
  loadCampaignManifest,
  manifestPerturbationsToPatches,
  type CampaignManifest,
  type CampaignArm,
} from "./manifest.js";
import { startGame } from "../index.js";
import { runGameToCompletion as engineRunToCompletion, readConfig } from "../engine/runGame.js";
import { loadScenario } from "../scenario/loader.js";
import { makeClient } from "../llm/factory.js";
import { forkGame } from "../fork/index.js";

export interface RunCampaignOptions {
  manifestPath: string;
  campaignDir: string;
  /** Override manifest parallelism. */
  parallelism?: number;
  /** Override manifest useMock. */
  useMock?: boolean;
  scenarioRoot?: string;
}

export interface CampaignRunSummary {
  campaignDir: string;
  manifest: CampaignManifest;
  total: number;
  succeeded: number;
  failed: number;
  failures: Array<{ arm: string; seed: number; error: string }>;
}

export async function runCampaign(opts: RunCampaignOptions): Promise<CampaignRunSummary> {
  const manifest = await loadCampaignManifest(opts.manifestPath);
  const useMock = opts.useMock ?? manifest.useMock;
  const parallelism = Math.max(1, opts.parallelism ?? manifest.parallelism);
  const campaignDir = path.resolve(opts.campaignDir);
  await fs.mkdir(campaignDir, { recursive: true });

  // Persist a copy of the manifest into the campaign dir for provenance.
  await fs.writeFile(
    path.join(campaignDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  const baseline = manifest.arms.find(isBaseline) ?? manifest.arms[0]!;
  const failures: CampaignRunSummary["failures"] = [];
  const tasks: Array<{ arm: CampaignArm; seed: number; baselineDir: string }> = [];
  const baselineDirs: Record<number, string> = {};

  // Phase 1: run baselines for each seed.
  await runWithPool(
    manifest.seeds.map((seed) => async () => {
      const dir = path.join(campaignDir, "games", baseline.id, String(seed));
      try {
        await runOneGameDirect({
          gameDir: dir,
          scenario: manifest.baseScenario,
          seed,
          useMock,
          llmModel: manifest.llmModel,
          scenarioRoot: opts.scenarioRoot,
        });
        baselineDirs[seed] = dir;
      } catch (err) {
        failures.push({ arm: baseline.id, seed, error: errorToString(err) });
      }
    }),
    parallelism,
  );

  // Phase 2: for each non-baseline arm, fork from each baseline at the
  // arm's fromTurn (default 1) with the arm's perturbations applied.
  for (const arm of manifest.arms) {
    if (arm.id === baseline.id) continue;
    for (const seed of manifest.seeds) {
      const baselineDir = baselineDirs[seed];
      if (!baselineDir) continue; // baseline for this seed failed
      tasks.push({ arm, seed, baselineDir });
    }
  }

  await runWithPool(
    tasks.map(({ arm, seed, baselineDir }) => async () => {
      const dir = path.join(campaignDir, "games", arm.id, String(seed));
      const fromTurn = arm.fromTurn ?? 1;
      try {
        await forkGame(baselineDir, {
          out: dir,
          fromTurn,
          perturbations: manifestPerturbationsToPatches(arm),
          seed,
          useMock,
          scenarioRoot: opts.scenarioRoot,
        });
      } catch (err) {
        failures.push({ arm: arm.id, seed, error: errorToString(err) });
      }
    }),
    parallelism,
  );

  const total = manifest.seeds.length * manifest.arms.length;
  const succeeded = total - failures.length;
  return { campaignDir, manifest, total, succeeded, failed: failures.length, failures };
}

interface DirectRunOpts {
  gameDir: string;
  scenario: string;
  seed: number;
  useMock: boolean;
  llmModel?: string;
  scenarioRoot?: string;
}

async function runOneGameDirect(opts: DirectRunOpts): Promise<void> {
  await startGame({
    scenario: opts.scenario,
    out: opts.gameDir,
    seed: opts.seed,
    useMock: opts.useMock,
    ...(opts.llmModel ? { llmModel: opts.llmModel } : {}),
    ...(opts.scenarioRoot ? { scenarioRoot: opts.scenarioRoot } : {}),
  });
  const config = await readConfig(opts.gameDir);
  const scenario = await loadScenario(config.scenarioId, opts.scenarioRoot);
  const client = makeClient(config, { useMock: opts.useMock });
  await engineRunToCompletion({
    gameDir: opts.gameDir,
    scenario,
    client,
    config,
  });
}

function isBaseline(arm: CampaignArm): boolean {
  return (
    arm.id === "baseline" ||
    (arm.perturbations.length === 0 && arm.fromTurn === undefined)
  );
}

function errorToString(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function runWithPool(
  tasks: Array<() => Promise<void>>,
  parallelism: number,
): Promise<void> {
  let nextIdx = 0;
  const workers: Promise<void>[] = [];
  const worker = async (): Promise<void> => {
    while (true) {
      const idx = nextIdx;
      nextIdx += 1;
      if (idx >= tasks.length) return;
      await tasks[idx]!();
    }
  };
  const n = Math.min(parallelism, tasks.length);
  for (let i = 0; i < n; i++) workers.push(worker());
  await Promise.all(workers);
}
